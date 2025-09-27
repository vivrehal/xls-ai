import React, { useEffect, useMemo, useState } from 'react'
import { Chart, ArcElement, LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, DoughnutController, PieController, LineController, BarController } from 'chart.js'

Chart.register(ArcElement, LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, DoughnutController, PieController, LineController, BarController)

function FileList({ files, selected, setSelected }) {
  return (
    <div className="filelist">
      {files.map(f => (
        <div key={f.fileId} style={{marginBottom:15}}>
        <label key={f.fileId} className="row" style={{alignItems:'center',justifyContent:'space-between', gap:8}}>
          <div className="flex" style={{gap:12}}>
            <input
              type="checkbox"
              checked={selected.includes(String(f.fileId))}
              onChange={e => {
                const id = String(f.fileId)
                if (e.target.checked) setSelected([...selected, id])
                else setSelected(selected.filter(x => x !== id))
              }}
            />
            <div>
              <div>{f.name}</div>
              <div className="small">{Math.round((f.size||0)/1024)} KB • {new Date(f.uploadedAt).toLocaleString()}</div>
            </div>
          </div>
          <a className="btn" href={`${API_BASE}/files/${f.fileId}`}>Download</a>
        </label>
        </div>
      ))}
      {files.length===0 && <div className="small">No files uploaded.</div>}
    </div>
  )
}

function useChart(canvasRef, config) {
  useEffect(() => {
    if (!canvasRef.current) return
    
    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvasRef.current)
    if (existingChart) {
      existingChart.destroy()
    }
    
    const ctx = canvasRef.current.getContext('2d')
    const chart = new Chart(ctx, config)
    return () => {
      if (chart) chart.destroy()
    }
  }, [canvasRef, JSON.stringify(config)])
}

function TablePreview({ data }) {
  const parsedData = useMemo(() => {
    if (!data) return { sheets: [], rows: [] }
    
    const lines = data.split('\n')
    const sheets = []
    const allRows = []
    
    let currentSheet = null
    
    lines.forEach(line => {
      if (line.startsWith('Sheet: ')) {
        currentSheet = line.replace('Sheet: ', '')
        sheets.push(currentSheet)
      } else if (line.match(/^\d+\. \{/)) {
        try {
          const jsonStr = line.replace(/^\d+\. /, '')
          const rowData = JSON.parse(jsonStr)
          allRows.push({ sheet: currentSheet, data: rowData })
        } catch (e) {
          // Skip invalid JSON
        }
      }
    })
    
    return { sheets, rows: allRows }
  }, [data])
  
  if (parsedData.rows.length === 0) {
    return <pre className="small" style={{whiteSpace:'pre-wrap'}}>{data}</pre>
  }
  
  // Get all unique columns across all rows
  const allColumns = [...new Set(parsedData.rows.flatMap(row => Object.keys(row.data)))]
  const displayColumns = allColumns.slice(0, 8) // Limit to first 8 columns for readability
  
  return (
    <div style={{ maxHeight: '400px', overflow: 'auto', margin: '20px 0' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
        backgroundColor: '#0f172a',
        border: '1px solid #1f2937'
      }}>
        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1f2937' }}>
          <tr>
            {displayColumns.map(col => (
              <th key={col} style={{
                padding: '8px 6px',
                textAlign: 'left',
                borderBottom: '1px solid #374151',
                color: '#e5e7eb',
                fontWeight: '600'
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsedData.rows.slice(0, 20).map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
              {displayColumns.map(col => (
                <td key={col} style={{
                  padding: '6px',
                  borderRight: '1px solid #1f2937',
                  color: '#9ca3af',
                  maxWidth: '150px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {formatCellValue(row.data[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {parsedData.rows.length > 20 && (
        <div className="small" style={{ marginTop: '8px', textAlign: 'center' }}>
          Showing first 20 rows of {parsedData.rows.length} total rows
        </div>
      )}
      {allColumns.length > 8 && (
        <div className="small" style={{ marginTop: '4px', textAlign: 'center' }}>
          Showing first 8 columns of {allColumns.length} total columns
        </div>
      )}
    </div>
  )
}

function formatCellValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' && value.length > 30) {
    return value.substring(0, 30) + '...'
  }
  if (typeof value === 'number') {
    // Format large numbers (likely Excel dates) as dates
    if (value > 40000 && value < 50000) {
      try {
        // Excel date format: days since 1900-01-01
        const excelEpoch = new Date(1900, 0, 1)
        const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000)
        return date.toLocaleDateString()
      } catch {
        return value
      }
    }
    return value.toLocaleString()
  }
  return String(value)
}

function ChartCard({ c }) {
  const ref = React.useRef(null)
  const colors = useMemo(() => ({
    bg: 'rgba(59,130,246,0.3)',
    border: 'rgba(59,130,246,1)'
  }), [])

  const config = useMemo(() => ({
    type: c.type,
    data: {
      labels: c.data.labels,
      datasets: c.data.datasets.map(d => ({
        ...d,
        backgroundColor: d.backgroundColor || (c.type==='pie' ? c.data.labels.map((_,i)=>`hsl(${i*57%360} 80% 50% / 0.6)`) : colors.bg),
        borderColor: d.borderColor || colors.border,
        borderWidth: 1,
        tension: 0.3
      }))
    },
    options: {
      plugins: { legend: { labels: { color: '#e5e7eb' } } },
      scales: c.type!=='pie' ? { x: { ticks:{ color:'#9ca3af' } }, y: { ticks:{ color:'#9ca3af' } } } : {}
    }
  }), [c, colors])

  useChart(ref, config)

  return (
    <div className="chart">
      <div style={{marginBottom:8}}>{c.title?.toUpperCase()}</div>
      <canvas ref={ref} width={320} height={220} />
    </div>
  )
}

export default function App() {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState([])
  const [query, setQuery] = useState('What are the key trends?')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [msg, setMsg] = useState('')

  const API_BASE = import.meta.env.VITE_API_URL || ''
  
  async function refreshFiles() {
    const res = await fetch(`${API_BASE}/files`)
    const data = await res.json()
    setFiles(data)
  }
  useEffect(() => { refreshFiles() }, [])

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setMsg('Uploading...')
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form })
    if (res.ok) {
      setMsg('Uploaded successfully.')
      refreshFiles()
    } else {
      setMsg('Upload failed.')
    }
  }

  async function runQuery() {
    setLoading(true)
    setResult(null)
    setMsg('')
    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: selected, query })
      })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setMsg('Query failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h2>XLS AI</h2>
        <div className="flex">
          <label className="btn" htmlFor="file">Upload</label>
          <input id="file" type="file" accept=".xlsx,.xls,.csv" onChange={onUpload} style={{display:'none'}} />
          <span className="badge">Backend: {API_BASE || 'http://localhost:4000'}</span>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Files</h3>
          <FileList files={files} selected={selected} setSelected={setSelected} />
        </div>
        <div className="card">
          <h3>Ask</h3>
          <textarea className="textarea" value={query} onChange={e=>setQuery(e.target.value)} />
          <div className="flex" style={{marginTop:8}}>
            <button className="btn" onClick={runQuery} disabled={loading || selected.length===0}>
              {loading ? 'Thinking...' : 'Submit'}
            </button>
            <span className="small">{selected.length} files selected</span>
          </div>
          {msg && <div className="small" style={{marginTop:8}}>{msg}</div>}
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3>SUMMARY HERE</h3>
        {!result && <div className="small">No summarized result yet.</div>}
        {result && (
          <>
            <p style={{whiteSpace:'pre-wrap'}}>{result.summary}</p>
            <div className="charts">
              {result.charts?.map((c,i)=>(<ChartCard key={i} c={c} />))}
            </div>
            <details style={{marginTop:12}}>
              <summary>TABLE PREVIEW</summary>
              <TablePreview data={result.tablePreview} />
            </details>
          </>
        )}
      </div>
    </div>
  )
}
