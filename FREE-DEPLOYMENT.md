# Deploy to Railway (Free, No Credit Card Required)

## Railway Setup - Backend + Database

### 1. Push to GitHub (if not done already)
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### 2. Deploy Backend on Railway
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub (free, no credit card)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `xls-ai` repository
5. Railway will detect it's a Node.js project

### 3. Configure Backend Service
In Railway dashboard:
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `GEMINI_API_KEY`: Your Gemini API key
  - `ENABLE_GEMINI`: `true`  
  - `GEMINI_MODEL`: `gemini-1.5-flash-latest`
  - `MONGODB_URI`: (Railway will provide this)

### 4. Add MongoDB Database
In same Railway project:
- Click "New" → "Database" → "Add MongoDB"
- Railway automatically connects it to your backend

### 5. Deploy Frontend on Vercel
1. Go to [Vercel.com](https://vercel.com)
2. Sign up with GitHub (free, no credit card)
3. Click "New Project" → Import your GitHub repo
4. **Framework Preset**: Vite
5. **Root Directory**: `frontend`
6. **Environment Variables**:
   - `VITE_API_URL`: Your Railway backend URL

## Alternative: Netlify + Railway

### Backend on Railway (same as above)
### Frontend on Netlify
1. Go to [Netlify.com](https://netlify.com) 
2. Sign up with GitHub
3. "New site from Git" → Select your repo
4. **Base directory**: `frontend`
5. **Build command**: `npm run build`
6. **Publish directory**: `dist`
7. **Environment Variables**: `VITE_API_URL`

## Alternative: All-in-One with Cyclic

### Single Platform Deployment
1. Go to [Cyclic.sh](https://cyclic.sh)
2. Connect GitHub repo
3. Deploy backend automatically
4. Use Cyclic's built-in database

## Recommended: Railway + Vercel

**Why this combo:**
✅ Railway: Great for Node.js backends + MongoDB
✅ Vercel: Excellent for React frontends  
✅ Both: No credit card required
✅ Both: Generous free tiers
✅ Both: Easy GitHub integration

## Free Tier Limits:
- **Railway**: 500 hours/month, 1GB memory
- **Vercel**: 100GB bandwidth, unlimited sites
- **Netlify**: 300 build minutes, 100GB bandwidth

Would you like me to create the specific config files for Railway deployment?
