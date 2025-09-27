# XLS AI Deployment Guide

## Prerequisites
1. GitHub account
2. Render account (free)
3. Google AI Studio account for Gemini API key

## Step-by-Step Deployment

### 1. Push to GitHub
```bash
cd /Users/vivek.dhiman/Desktop/xls-ai
git init
git add .
git commit -m "Initial commit - XLS AI application"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Get Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Create API key
4. Copy the key (keep it safe!)

### 3. Deploy on Render

#### Option A: Using Blueprint (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file
5. Set environment variables:
   - `GEMINI_API_KEY`: Your Gemini API key
6. Click "Apply"

#### Option B: Manual Setup
1. **Create MongoDB Database**
   - New → Database → MongoDB
   - Name: `xls-ai-mongodb`
   - Plan: Free
   - Note the connection string

2. **Create Backend Service**
   - New → Web Service
   - Connect GitHub repo
   - Name: `xls-ai-backend`
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables:
     - `MONGODB_URI`: [Your MongoDB connection string]
     - `GEMINI_API_KEY`: [Your Gemini API key]
     - `ENABLE_GEMINI`: `true`
     - `GEMINI_MODEL`: `gemini-1.5-flash-latest`
     - `NODE_ENV`: `production`

3. **Create Frontend Service**
   - New → Static Site
   - Connect GitHub repo
   - Name: `xls-ai-frontend`
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Environment Variables:
     - `VITE_API_URL`: `https://YOUR_BACKEND_URL.onrender.com`

### 4. Update Frontend API URL
After backend is deployed, update frontend environment variable:
- `VITE_API_URL`: Your actual backend URL from Render

### 5. Test Deployment
1. Visit your frontend URL
2. Upload an Excel file
3. Ask a question
4. Verify charts and table preview work

## Troubleshooting

### Common Issues:
1. **Build failures**: Check build logs in Render dashboard
2. **API connection**: Verify CORS settings and API URLs
3. **MongoDB connection**: Ensure connection string is correct
4. **Gemini API**: Verify API key is valid and has quota

### Logs:
- Backend logs: Render dashboard → Backend service → Logs
- Frontend logs: Browser developer tools

## Cost Breakdown (All Free Tier):
- Render: Free tier (750 hours/month)
- MongoDB Atlas: Free tier (512MB storage)
- Gemini API: Free tier (generous quota)

## Production Tips:
1. Set up custom domain in Render
2. Enable auto-deploy on GitHub push
3. Monitor usage in Render dashboard
4. Set up health checks for reliability

## Environment Variables Summary:
### Backend:
- `MONGODB_URI`: Database connection string
- `GEMINI_API_KEY`: Your Google AI API key
- `ENABLE_GEMINI`: `true`
- `GEMINI_MODEL`: `gemini-1.5-flash-latest`
- `NODE_ENV`: `production`

### Frontend:
- `VITE_API_URL`: Backend service URL
