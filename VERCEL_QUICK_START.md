# 🚀 Vercel Deployment - Quick Start Guide

## Prerequisites
- GitHub account
- Vercel account (free) - https://vercel.com
- OpenAI API key - https://platform.openai.com/api-keys

---

## Method 1: Vercel Dashboard (Easiest - 10 minutes)

### STEP 1: Deploy Backend ⚙️

1. **Login to Vercel**
   - Go to: https://vercel.com
   - Click "Sign Up" with GitHub

2. **Import Project**
   - Click "Add New..." → "Project"
   - Click "Import Git Repository"
   - Select: `N-Saipraveen/turbo1`
   - Click "Import"

3. **Configure Backend**
   ```
   Project Name: turbodbx-backend
   Framework Preset: Other
   Root Directory: apps/backend    ← Click "Edit" to set this!
   Build Command: npm run build
   Output Directory: (leave default)
   Install Command: npm install
   ```

4. **Add Environment Variables**

   Click "Environment Variables" section and add:

   | Variable Name | Value |
   |--------------|-------|
   | `NODE_ENV` | `production` |
   | `OPENAI_API_KEY` | `sk-your-actual-key-here` |
   | `OPENAI_MODEL` | `gpt-4o-mini` |
   | `OPENAI_ENDPOINT` | `https://api.openai.com/v1/chat/completions` |

   **Get OpenAI Key:** https://platform.openai.com/api-keys

5. **Deploy**
   - Click "Deploy" button
   - Wait 1-2 minutes
   - **SAVE YOUR BACKEND URL!** (e.g., `https://turbodbx-backend.vercel.app`)

---

### STEP 2: Deploy Frontend 🎨

1. **Create New Project**
   - Go to: https://vercel.com/dashboard
   - Click "Add New..." → "Project"
   - Import **SAME repository**: `N-Saipraveen/turbo1`

2. **Configure Frontend**
   ```
   Project Name: turbodbx-frontend
   Framework Preset: Vite
   Root Directory: apps/frontend    ← Click "Edit" to set this!
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

3. **Add Environment Variables**

   | Variable Name | Value |
   |--------------|-------|
   | `VITE_API_URL` | `https://turbodbx-backend.vercel.app` |

   ⚠️ **Use YOUR backend URL from Step 1!**

4. **Deploy**
   - Click "Deploy"
   - Wait 1-2 minutes
   - **YOUR APP IS LIVE! 🎉**

---

### STEP 3: Test Your App ✅

1. **Test Backend Health**

   Visit: `https://your-backend-url.vercel.app/health`

   Should return:
   ```json
   {"ok": true, "timestamp": "...", "service": "TurboDbx API"}
   ```

2. **Test Frontend**

   Visit: `https://your-frontend-url.vercel.app`

   - Home page should load
   - Click "Convert" in navigation
   - Paste SQL code:
     ```sql
     CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       name VARCHAR(100),
       email VARCHAR(255)
     );
     ```
   - Select: SQL → JSON
   - Click "Convert"
   - See converted output!

---

## Method 2: Vercel CLI (For Developers)

### Install Vercel CLI

```bash
npm install -g vercel
```

### Deploy Backend

```bash
# Navigate to backend
cd apps/backend

# Login to Vercel (first time only)
vercel login

# Deploy to production
vercel --prod

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (Your account)
# - Link to existing project? No
# - Project name? turbodbx-backend
# - In which directory? ./
```

**After deployment:**
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add the environment variables (see Method 1, Step 1.4)
- Redeploy: `vercel --prod`

**Save the deployment URL!**

### Deploy Frontend

```bash
# Navigate to frontend
cd apps/frontend

# Deploy to production
vercel --prod

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (Your account)
# - Link to existing project? No
# - Project name? turbodbx-frontend
# - In which directory? ./
```

**After deployment:**
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add: `VITE_API_URL` = `https://your-backend-url.vercel.app`
- Redeploy: `vercel --prod`

---

## Environment Variables Reference

### Backend Variables (Required)

```bash
NODE_ENV=production
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_ENDPOINT=https://api.openai.com/v1/chat/completions
```

### Backend Variables (Optional - for database features)

```bash
POSTGRES_URL=postgresql://user:pass@host:5432/db
MYSQL_URL=mysql://user:pass@host:3306/db
MONGODB_URL=mongodb://host:27017/db
REDIS_HOST=your-redis.upstash.io
REDIS_PORT=6379
```

### Frontend Variables (Required)

```bash
VITE_API_URL=https://your-backend-url.vercel.app
```

---

## Troubleshooting

### Issue: "Failed to fetch" or CORS errors

**Solution:**
1. Check `VITE_API_URL` in frontend environment variables
2. Make sure backend URL is correct
3. Redeploy frontend after adding env vars

### Issue: Backend returns 500 errors

**Solution:**
1. Check Vercel logs: Dashboard → Project → Deployments → View Logs
2. Verify `OPENAI_API_KEY` is set correctly
3. Check OpenAI API has credits: https://platform.openai.com/usage

### Issue: Build fails

**Solution:**
1. Check build logs in Vercel dashboard
2. Test build locally first:
   ```bash
   cd apps/backend
   npm install
   npm run build

   cd ../frontend
   npm install
   npm run build
   ```

### Issue: 404 on frontend routes

**Solution:**
1. Make sure `apps/frontend/vercel.json` exists
2. Redeploy frontend

### Issue: Environment variables not working

**Solution:**
1. After adding/changing environment variables in Vercel Dashboard
2. You MUST redeploy the project
3. Go to Deployments → Click "..." → Redeploy

---

## Quick Commands

```bash
# Check deployment status
vercel ls

# View logs
vercel logs [deployment-url]

# Add environment variable
vercel env add VARIABLE_NAME production

# List environment variables
vercel env ls

# Remove deployment
vercel rm [deployment-name]
```

---

## Deployment Checklist

### Backend Checklist ✅

- [ ] Deployed to Vercel
- [ ] Root directory set to `apps/backend`
- [ ] Environment variables added:
  - [ ] `NODE_ENV=production`
  - [ ] `OPENAI_API_KEY=sk-...`
  - [ ] `OPENAI_MODEL=gpt-4o-mini`
  - [ ] `OPENAI_ENDPOINT=https://api.openai.com/v1/chat/completions`
- [ ] Health check works: `/health` returns `{"ok": true}`
- [ ] Backend URL saved

### Frontend Checklist ✅

- [ ] Deployed to Vercel
- [ ] Root directory set to `apps/frontend`
- [ ] Environment variable added:
  - [ ] `VITE_API_URL=https://your-backend-url.vercel.app`
- [ ] Redeployed after adding env var
- [ ] All pages load (/, /convert, /visualize, /migrate)
- [ ] API connection works (test on Convert page)

---

## Cost (Vercel Free Tier)

**Free tier includes:**
- ✅ 100 GB bandwidth/month
- ✅ Unlimited serverless function invocations
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Auto-deploy from Git

**Estimated cost: $0/month** (unless you exceed free tier limits)

**OpenAI API cost:** ~$0.001 per conversion (GPT-4o-mini)

---

## URLs After Deployment

**Backend:** `https://turbodbx-backend.vercel.app`
**Frontend:** `https://turbodbx-frontend.vercel.app`

(Your actual URLs will be different)

---

## Next Steps

1. ✅ Test all features (Convert, Visualize, Migrate)
2. ✅ Share your app URL with others
3. ✅ (Optional) Add custom domain in Vercel Dashboard
4. ✅ Monitor usage in Vercel Analytics

---

## Need More Help?

- **Full Deployment Guide:** See `VERCEL_DEPLOYMENT.md`
- **Vercel Docs:** https://vercel.com/docs
- **Project README:** See `README.md`
- **Issues:** https://github.com/N-Saipraveen/turbo1/issues

---

**That's it! Your TurboDBX is now live! 🚀**
