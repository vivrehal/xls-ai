import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { MongoClient, ObjectId, GridFSBucket } from 'mongodb';
import xlsx from 'xlsx';
import dayjs from 'dayjs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',');
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json({ limit: '4mb' }));

// Mongo
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/xlsai';
const client = new MongoClient(mongoUri);
let db, filesCol, bucket;

async function initMongo() {
  await client.connect();
  db = client.db();
  filesCol = db.collection('files');
  bucket = new GridFSBucket(db, { bucketName: 'uploads' });
}
initMongo().catch(console.error);

// LLM Adapters
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const ENABLE_GEMINI = String(process.env.ENABLE_GEMINI || 'true').toLowerCase() === 'true';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';


async function summarizeWithGemini(prompt) {
  if (!ENABLE_GEMINI) return null;
  if (!process.env.GEMINI_API_KEY) return null; // no key
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    return content.trim();
  } catch (e) {
    console.error('Gemini error', e.message);
    return null;
  }
}

async function generateChartSuggestionsWithGemini(query, previewText) {
  if (!ENABLE_GEMINI || !process.env.GEMINI_API_KEY) return null;
  
  const chartPrompt = `Analyze this spreadsheet data and suggest which specific columns/fields would be best for creating charts to answer the user's question.

User Question: ${query}

Data Preview:
${previewText.slice(0, 3000)}

Respond with a JSON object containing chart suggestions. For each chart type, specify the exact column names to use:

{
  "pie": { "column": "column_name", "reason": "why this makes sense" },
  "bar": { "categoryColumn": "column_name", "valueColumn": "column_name", "reason": "why this makes sense" },
  "line": { "xColumn": "column_name", "yColumn": "column_name", "reason": "why this makes sense" }
}

Only suggest charts that would help answer the user's question. If a chart type isn't relevant, omit it.`;

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(chartPrompt);
    const response = await result.response;
    const content = response.text();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Gemini chart suggestion error', e.message);
  }
  return null;
}

function fallbackSummarizer(text, question) {
  // Naive extractive: pick top lines with query keywords
  const q = (question || '').toLowerCase();
  const terms = q.split(/\W+/).filter(Boolean);
  const lines = text.split(/\n+/);
  const scored = lines.map(line => ({
    line,
    score: terms.reduce((acc, t) => acc + (line.toLowerCase().includes(t) ? 1 : 0), 0)
  }));
  return scored
    .sort((a,b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.line)
    .join('\n');
}

// Multer in-memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helpers
async function saveBufferToGridFS(filename, buffer, mimeType) {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType
    });
    
    uploadStream.on('finish', () => {
      // The uploadStream.id contains the GridFS file _id
      resolve({ _id: uploadStream.id, filename });
    });
    
    uploadStream.on('error', reject);
    uploadStream.end(buffer);
  });
}

function parseWorkbookToPreviewAndJSON(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheets = {};
  let previewLines = [];
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const json = xlsx.utils.sheet_to_json(ws, { defval: null });
    sheets[name] = json;
    previewLines.push(`Sheet: ${name}`);
    json.slice(0, 5).forEach((row, i) => previewLines.push(`${i+1}. ${JSON.stringify(row)}`));
  });
  return { sheets, preview: previewLines.join('\n') };
}

function generateChartsFromSheets(sheets, chartSuggestions = null, query = '') {
  const charts = [];
  
  // If we have Claude suggestions, use them
  if (chartSuggestions) {
    if (chartSuggestions.pie) {
      const chart = createPieChart(sheets, chartSuggestions.pie.column, chartSuggestions.pie.reason);
      if (chart) charts.push(chart);
    }
    if (chartSuggestions.bar) {
      const chart = createBarChart(sheets, chartSuggestions.bar.categoryColumn, chartSuggestions.bar.valueColumn, chartSuggestions.bar.reason);
      if (chart) charts.push(chart);
    }
    if (chartSuggestions.line) {
      const chart = createLineChart(sheets, chartSuggestions.line.xColumn, chartSuggestions.line.yColumn, chartSuggestions.line.reason);
      if (chart) charts.push(chart);
    }
  }
  
  // Fallback to automatic generation if no suggestions or charts failed
  if (charts.length === 0) {
    // Pie: pick first sheet, first column categorical counts
    const firstSheet = Object.values(sheets)[0] || [];
    if (firstSheet.length) {
      const firstRow = firstSheet[0];
      const columns = Object.keys(firstRow);
      if (columns.length) {
        const col = columns[0];
        const counts = {};
        firstSheet.forEach(r => {
          const k = String(r[col] ?? 'Unknown');
          counts[k] = (counts[k] || 0) + 1;
        });
        charts.push({
          type: 'pie',
          title: `Distribution of ${col}`,
          data: {
            labels: Object.keys(counts),
            datasets: [{ label: col, data: Object.values(counts) }]
          }
        });
      }
    }

    // Line: find a date column and a numeric column
    for (const rows of Object.values(sheets)) {
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const dateCol = columns.find(c => rows.some(r => isDateLike(r[c])));
      const numCol = columns.find(c => rows.some(r => typeof r[c] === 'number'));
      if (dateCol && numCol) {
        const byDay = {};
        rows.forEach(r => {
          const d = normalizeDate(r[dateCol]);
          const v = Number(r[numCol]);
          if (!isFinite(v) || !d) return;
          byDay[d] = (byDay[d] || 0) + v;
        });
        const labels = Object.keys(byDay).sort();
        charts.push({
          type: 'line',
          title: `${numCol} over time`,
          data: {
            labels,
            datasets: [{ label: numCol, data: labels.map(l => byDay[l]) }]
          }
        });
        break;
      }
    }

    // Bar: pick a categorical and numeric column pair
    for (const rows of Object.values(sheets)) {
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const catCol = columns.find(c => rows.some(r => typeof r[c] === 'string'));
      const numCol = columns.find(c => rows.some(r => typeof r[c] === 'number'));
      if (catCol && numCol) {
        const sums = {};
        rows.forEach(r => {
          const k = String(r[catCol] ?? 'Unknown');
          const v = Number(r[numCol]);
          if (!isFinite(v)) return;
          sums[k] = (sums[k] || 0) + v;
        });
        const entries = Object.entries(sums).sort((a,b) => b[1]-a[1]).slice(0, 10);
        charts.push({
          type: 'bar',
          title: `Top ${catCol} by ${numCol}`,
          data: {
            labels: entries.map(e => e[0]),
            datasets: [{ label: numCol, data: entries.map(e => e[1]) }]
          }
        });
        break;
      }
    }
  }

  return charts;
}

function createPieChart(sheets, columnName, reason) {
  for (const rows of Object.values(sheets)) {
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    if (!columns.includes(columnName)) continue;
    
    const counts = {};
    rows.forEach(r => {
      const k = String(r[columnName] ?? 'Unknown');
      counts[k] = (counts[k] || 0) + 1;
    });
    
    if (Object.keys(counts).length > 1) {
      return {
        type: 'pie',
        title: `Distribution of ${columnName}`,
        data: {
          labels: Object.keys(counts),
          datasets: [{ label: columnName, data: Object.values(counts) }]
        }
      };
    }
  }
  return null;
}

function createBarChart(sheets, categoryColumn, valueColumn, reason) {
  for (const rows of Object.values(sheets)) {
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    if (!columns.includes(categoryColumn) || !columns.includes(valueColumn)) continue;
    
    const sums = {};
    rows.forEach(r => {
      const k = String(r[categoryColumn] ?? 'Unknown');
      const v = Number(r[valueColumn]);
      if (!isFinite(v)) return;
      sums[k] = (sums[k] || 0) + v;
    });
    
    const entries = Object.entries(sums).sort((a,b) => b[1]-a[1]).slice(0, 10);
    if (entries.length > 0) {
      return {
        type: 'bar',
        title: `${valueColumn} by ${categoryColumn}`,
        data: {
          labels: entries.map(e => e[0]),
          datasets: [{ label: valueColumn, data: entries.map(e => e[1]) }]
        }
      };
    }
  }
  return null;
}

function createLineChart(sheets, xColumn, yColumn, reason) {
  for (const rows of Object.values(sheets)) {
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    if (!columns.includes(xColumn) || !columns.includes(yColumn)) continue;
    
    const data = {};
    rows.forEach(r => {
      let x = r[xColumn];
      const y = Number(r[yColumn]);
      if (!isFinite(y)) return;
      
      // Try to normalize x-axis if it's date-like
      if (isDateLike(x)) {
        x = normalizeDate(x);
      } else {
        x = String(x ?? 'Unknown');
      }
      
      data[x] = (data[x] || 0) + y;
    });
    
    const labels = Object.keys(data).sort();
    if (labels.length > 1) {
      return {
        type: 'line',
        title: `${yColumn} vs ${xColumn}`,
        data: {
          labels,
          datasets: [{ label: yColumn, data: labels.map(l => data[l]) }]
        }
      };
    }
  }
  return null;
}

function isDateLike(v) {
  if (!v) return false;
  if (v instanceof Date) return true;
  if (typeof v === 'number') return false; // likely numeric
  const d = dayjs(v);
  return d.isValid();
}
function normalizeDate(v) {
  if (!isDateLike(v)) return null;
  return dayjs(v).format('YYYY-MM-DD');
}

// Routes
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const { originalname, mimetype, buffer, size } = req.file;
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if(!allowedTypes.includes(mimetype)) {
      console.log(mimetype);
      return res.status(400).json({ error: 'Invalid file type' });
    }
    const file = await saveBufferToGridFS(originalname, buffer, mimetype);
    await filesCol.insertOne({
      fileId: file._id,
      name: originalname,
      size,
      type: mimetype,
      uploadedAt: new Date()
    });
    res.json({ id: file._id, name: originalname });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/files', async (req, res) => {
  try {
    const items = await filesCol
      .find({}, { projection: { _id: 0 } })
      .sort({ uploadedAt: -1 })
      .toArray();
    res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'List failed' });
  }
});

app.get('/files/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const _id = new ObjectId(id);
    const cursor = bucket.find({ _id });
    const file = await cursor.next();
    if (!file) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    bucket.openDownloadStream(_id).pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.post('/query', async (req, res) => {
  try {
    const { fileIds = [], query = '', charts: chartTypes } = req.body || {};
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'fileIds required' });
    }
    // Aggregate text from all files
    let combinedPreview = [];
    let mergedSheets = {};
    for (const id of fileIds) {
      const _id = new ObjectId(id);
      const chunks = [];
      await new Promise((resolve, reject) => {
        bucket.openDownloadStream(_id)
          .on('data', d => chunks.push(d))
          .on('error', reject)
          .on('end', resolve);
      });
      const buf = Buffer.concat(chunks);
      const { sheets, preview } = parseWorkbookToPreviewAndJSON(buf);
      combinedPreview.push(preview);
      // naive merge: keep only first sheet of first file for charts, else append sheets with prefixes
      mergedSheets = { ...mergedSheets, ...sheets };
    }

    const previewText = combinedPreview.join('\n\n');
    
    // Get chart suggestions based on user query
    const chartSuggestions = await generateChartSuggestionsWithGemini(query, previewText);
    if(!chartSuggestions) {
      console.log('No chart suggestions from Gemini');
    }
    
    // Try Gemini first for summary
    const prompt = `You are an analyst. Given spreadsheet previews and a user question, answer succinctly in 3-6 sentences.\n\nQuestion: ${query}\n\nPreview:\n${previewText}`;
    let summary = await summarizeWithGemini(prompt);
    if (!summary) summary = fallbackSummarizer(previewText, query) || 'Unable to summarize.';
    let charts = [];
    if(chartSuggestions) {
        charts = generateChartsFromSheets(mergedSheets, chartSuggestions, query);
        if (Array.isArray(chartTypes) && chartTypes.length) {
        charts = charts.filter(c => chartTypes.includes(c.type));
        }
    } else {
        charts = generateChartsFromSheets(mergedSheets, null, query);
    }

    res.json({ summary, charts, tablePreview: previewText.slice(0, 4000) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Query failed' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on :${port}`));
