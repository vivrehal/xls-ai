# Functional Requirements Document

## 1. Overview
This project is a **chat-driven analytics platform** that lets users upload Excel files, store them in a backend, and then query the data using natural language.  
The backend summarizes the data and generates chart-ready datasets (pie, line, bar) using an LLM or a fallback summarizer.  
The frontend provides a **ChatGPT-like interface** where users can:
- Upload Excel files
- Select uploaded files for querying
- Ask free-text questions
- View summarized answers + charts

---

## 2. Goals
- Allow users to upload Excel files and persist them.
- Store files in a **free storage solution** (MongoDB GridFS).
- Maintain file metadata in MongoDB for easy retrieval.
- Provide a chat interface to query uploaded files.
- Generate **summarized answers + chart data** (pie, bar, line) from Excel content.
- Ensure system works with **free LLMs** (fallback summarizer) but allows plugging in OpenAI/HuggingFace/local LLM.

---

## 3. User Stories
1. As a user, I want to **upload an Excel file** so that I can analyze its data later.
2. As a user, I want to **see a list of uploaded Excel files** with details (name, size, date).
3. As a user, I want to **select one or more files** to use as a data source for my query.
4. As a user, I want to **ask free-text questions** about the selected Excel files.
5. As a user, I want to receive a **summarized text answer** to my query.
6. As a user, I want to receive **charts (pie, line, bar)** that visualize the data relevant to my query.
7. As a user, I want to **download original Excel files** after uploading them.

---

## 4. Functional Requirements

### 4.1 Backend
- **File Management**
  - Accept Excel/CSV uploads (`.xlsx`, `.xls`, `.csv`).
  - Store uploaded files in **MongoDB GridFS**.
  - Store file metadata (id, name, type, size, upload date).
  - Provide API to list all uploaded files.
  - Provide API to stream/download a file by ID.

- **Query Processing**
  - Accept request with:
    - Selected `fileIds`
    - Natural language `query`
    - Optional `charts` types (default: `pie, line, bar`)
  - Parse Excel into JSON (using `xlsx` package).
  - Prepare compact preview (first N rows per sheet).
  - Call **LLM adapter**:
    - Default fallback summarizer (extractive).
    - Optional integrations: OpenAI, HuggingFace, local LLM.
  - Generate structured chart data:
    - **Pie chart** → counts of categories.
    - **Line chart** → time-series if date column exists.
    - **Bar chart** → top values grouped by category.
  - Return JSON response:  
    ```json
    {
      "summary": "string",
      "charts": [
        { "type": "pie", "title": "string", "data": {...} },
        { "type": "line", "title": "string", "data": {...} },
        { "type": "bar", "title": "string", "data": {...} }
      ],
      "tablePreview": "string"
    }
    ```

- **APIs**
  - `POST /upload` → upload file
  - `GET /files` → list files
  - `GET /files/:id` → download file
  - `POST /query` → run query on files

---

### 4.2 Frontend
- **Upload**
  - UI for selecting and uploading Excel files.
  - Show success/error message.

- **File List**
  - Show list of uploaded files with metadata.
  - Checkbox to select one or more files.
  - Download link for each file.

- **Chat Interface**
  - Minimilistic clean UI (dark themed)
  - Textarea for free-text queries.
  - Button to submit query.
  - Loading state while backend processes query.
  - Display summarized text response.
  - Display multiple charts (pie/line/bar) using **Chart.js**.

- **Charts**
  - Render charts from backend JSON:
    - Pie → categorical counts
    - Line → date vs numeric
    - Bar → grouped numeric
  - Handle multiple charts in a scrollable/flex layout.

---

## 5. Non-Functional Requirements
- **Scalability**: Must handle multiple concurrent users on free-tier resources.
- **Storage**: Use **MongoDB Atlas free tier** with GridFS for file persistence.
- **Portability**: Backend in Node.js/Express, frontend in React.
- **Extensibility**: LLM adapter must be swappable (OpenAI/HF/local).
- **Performance**: Limit Excel preview rows to avoid memory overload.
- **Cost**: Must run entirely on free-tier services.

---

## 6. Acceptance Criteria
- Users can upload `.xlsx` files and see them in a list.
- Uploaded files are retrievable from `/files/:id`.
- Selecting a file + asking a query returns:
  - A text summary
  - At least one chart (if data allows).
- Charts render correctly in frontend.
- System runs with **no external API key** (fallback summarizer works).
- If an OpenAI key is provided, summaries improve automatically.

---

## 7. Future Enhancements
- Multi-user auth (users see only their files).
- Advanced chart selection (user chooses column mappings).
- Pagination for large datasets.
- Vector database for semantic search inside spreadsheets.
- Export charts to PNG/PDF.
