# TurboDBX - Vercel Deployment Guide

This guide will walk you through deploying TurboDBX on Vercel, with the frontend and backend hosted separately.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure Overview](#project-structure-overview)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Environment Variables Setup](#environment-variables-setup)
6. [Testing Your Deployment](#testing-your-deployment)
7. [Troubleshooting](#troubleshooting)
8. [Optional: Custom Domain](#optional-custom-domain)

---

## Prerequisites

Before you begin, make sure you have:

- ✅ A [Vercel account](https://vercel.com/signup) (free tier works fine)
- ✅ [Vercel CLI](https://vercel.com/docs/cli) installed (optional but recommended)
  ```bash
  npm i -g vercel
  ```
- ✅ GitHub account (for connecting your repository)
- ✅ OpenAI API key (for AI features) - [Get one here](https://platform.openai.com/api-keys)
- ✅ Your code pushed to GitHub

---

## Project Structure Overview

TurboDBX is a monorepo with two apps:

```
turbo1/
├── apps/
│   ├── backend/          # Express API (Node.js serverless functions)
│   │   ├── api/
│   │   │   └── index.ts  # Vercel serverless entry point
│   │   ├── src/
│   │   │   ├── app.ts    # Express app (exported for serverless)
│   │   │   └── server.ts # Local development server
│   │   └── vercel.json   # Backend Vercel configuration
│   │
│   └── frontend/         # React + Vite SPA
│       ├── src/
│       └── vercel.json   # Frontend Vercel configuration
```

**Deployment Strategy:**
- Deploy backend and frontend as **separate Vercel projects**
- Backend runs as **serverless functions**
- Frontend is a **static site** with SPA routing

---

## Backend Deployment

### Step 1: Prepare Backend

The backend has already been configured for Vercel serverless deployment with:
- `apps/backend/api/index.ts` - Serverless entry point
- `apps/backend/vercel.json` - Vercel configuration
- `apps/backend/src/app.ts` - Express app export

### Step 2: Deploy Backend to Vercel

#### Option A: Using Vercel Dashboard (Recommended for First Time)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**

2. **Click "Add New Project"**

3. **Import your GitHub repository**
   - Select your repository (e.g., `N-Saipraveen/turbo1`)
   - Click "Import"

4. **Configure the project:**
   ```
   Framework Preset: Other
   Root Directory: apps/backend
   Build Command: npm run build
   Output Directory: dist (or leave default)
   Install Command: npm install
   ```

5. **Add Environment Variables** (see [Environment Variables Setup](#environment-variables-setup))

6. **Click "Deploy"**

7. **Save your backend URL** (e.g., `https://turbodbx-backend.vercel.app`)

#### Option B: Using Vercel CLI

```bash
# Navigate to backend directory
cd apps/backend

# Login to Vercel (first time only)
vercel login

# Deploy to production
vercel --prod

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (Select your account)
# - Link to existing project? No
# - What's your project's name? turbodbx-backend
# - In which directory is your code located? ./
```

### Step 3: Note Your Backend URL

After deployment, Vercel will give you a URL like:
```
https://turbodbx-backend.vercel.app
```

**Save this URL** - you'll need it for the frontend configuration!

---

## Frontend Deployment

### Step 1: Prepare Frontend

The frontend has been configured with:
- `apps/frontend/vercel.json` - SPA routing configuration
- Environment variable setup for API URL

### Step 2: Deploy Frontend to Vercel

#### Option A: Using Vercel Dashboard

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**

2. **Click "Add New Project"**

3. **Import the SAME GitHub repository again**
   - Select your repository
   - Click "Import"

4. **Configure the project:**
   ```
   Framework Preset: Vite
   Root Directory: apps/frontend
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

5. **Add Environment Variables:**
   ```
   Name: VITE_API_URL
   Value: https://turbodbx-backend.vercel.app
   ```
   (Use the backend URL from Step 3 above)

6. **Click "Deploy"**

7. **Your frontend is now live!** (e.g., `https://turbodbx.vercel.app`)

#### Option B: Using Vercel CLI

```bash
# Navigate to frontend directory
cd apps/frontend

# Deploy to production
vercel --prod

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (Select your account)
# - Link to existing project? No
# - What's your project's name? turbodbx-frontend
# - In which directory is your code located? ./

# After deployment, add environment variable
vercel env add VITE_API_URL production
# When prompted, enter: https://turbodbx-backend.vercel.app

# Redeploy to apply environment variables
vercel --prod
```

---

## Environment Variables Setup

### Backend Environment Variables

Add these in Vercel Dashboard → Your Backend Project → Settings → Environment Variables:

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NODE_ENV` | `production` | ✅ Yes | Set to production |
| `OPENAI_API_KEY` | `sk-xxx...` | ✅ Yes | Get from [OpenAI Platform](https://platform.openai.com/api-keys) |
| `OPENAI_MODEL` | `gpt-4o-mini` | ⚠️ Recommended | AI model to use |
| `OPENAI_ENDPOINT` | `https://api.openai.com/v1/chat/completions` | ⚠️ Recommended | OpenAI API endpoint |
| `ENABLE_AI_ENHANCEMENT` | `true` | ⚠️ Optional | Enable AI features |
| `POSTGRES_URL` | `postgresql://user:pass@host:5432/db` | ⚠️ Optional | Only if using PostgreSQL |
| `MYSQL_URL` | `mysql://user:pass@host:3306/db` | ⚠️ Optional | Only if using MySQL |
| `MONGODB_URL` | `mongodb://host:27017` | ⚠️ Optional | Only if using MongoDB |
| `REDIS_HOST` | `your-redis-host.upstash.io` | ⚠️ Optional | For job queue (use Upstash) |
| `REDIS_PORT` | `6379` | ⚠️ Optional | Redis port |

**Important Notes:**
- ✅ **Required Variables:** You MUST set `NODE_ENV` and `OPENAI_API_KEY`
- ⚠️ **Database URLs:** Only needed if you want to enable live database migrations
- 💡 **Redis:** Optional, used for background job processing (can use [Upstash Redis](https://upstash.com/) free tier)

### Frontend Environment Variables

Add these in Vercel Dashboard → Your Frontend Project → Settings → Environment Variables:

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `VITE_API_URL` | `https://turbodbx-backend.vercel.app` | ✅ Yes | Your backend URL from deployment |

**⚠️ Important:** After adding environment variables, you MUST redeploy for changes to take effect!

---

## Testing Your Deployment

### 1. Test Backend Health Check

```bash
curl https://your-backend-url.vercel.app/health
```

Expected response:
```json
{
  "ok": true,
  "timestamp": "2025-11-08T10:30:00.000Z",
  "service": "TurboDbx API"
}
```

### 2. Test Frontend

Visit your frontend URL: `https://your-frontend-url.vercel.app`

You should see:
- ✅ Home page loads
- ✅ Navigation works (Convert, Visualize, Migrate pages)
- ✅ No console errors related to API URL

### 3. Test API Integration

1. Go to the **Convert** page
2. Paste a sample SQL schema:
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     name VARCHAR(100),
     email VARCHAR(255)
   );
   ```
3. Select conversion: SQL → JSON
4. Click "Convert"
5. You should see the converted JSON schema

### 4. Test AI Features (if enabled)

1. On the Convert page, check the "Enable AI Enhancement" option
2. Convert a schema
3. You should see AI suggestions in the output

---

## Troubleshooting

### Issue 1: "Failed to fetch" or CORS errors

**Problem:** Frontend can't connect to backend

**Solutions:**
1. Check that `VITE_API_URL` is set correctly in frontend environment variables
2. Verify backend URL is accessible: `curl https://your-backend-url.vercel.app/health`
3. Check browser console for actual error message
4. Make sure you redeployed frontend after adding environment variables

### Issue 2: "Internal Server Error" on backend

**Problem:** Backend crashes or returns 500 errors

**Solutions:**
1. Check Vercel logs: Dashboard → Your Backend Project → Deployments → Click deployment → View Function Logs
2. Verify all required environment variables are set (`NODE_ENV`, `OPENAI_API_KEY`)
3. Check that `OPENAI_API_KEY` is valid and has credits
4. Review error logs for specific error messages

### Issue 3: Build fails

**Problem:** Deployment fails during build

**Solutions:**
1. Check build logs in Vercel dashboard
2. Common fixes:
   ```bash
   # Make sure dependencies are in package.json, not devDependencies
   # TypeScript errors will fail the build - fix them locally first
   npm run build  # Test build locally
   npm run lint   # Fix linting errors
   ```

### Issue 4: 404 errors on frontend routes

**Problem:** Navigating to `/convert` or `/migrate` gives 404

**Solutions:**
1. Verify `apps/frontend/vercel.json` exists with SPA rewrites:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
2. Redeploy frontend

### Issue 5: AI features not working

**Problem:** AI enhancement returns errors

**Solutions:**
1. Verify `OPENAI_API_KEY` is set in backend environment variables
2. Check OpenAI API key has credits: [OpenAI Usage](https://platform.openai.com/usage)
3. Test API key manually:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```
4. Check backend logs for OpenAI-specific errors

### Issue 6: Database connections fail

**Problem:** Can't connect to databases for migration

**Solutions:**
1. Verify database URLs are correct and accessible from Vercel's servers
2. Check database firewall allows connections from Vercel IPs
3. For cloud databases:
   - **PostgreSQL:** Use services like [Neon](https://neon.tech/), [Supabase](https://supabase.com/)
   - **MySQL:** Use [PlanetScale](https://planetscale.com/), [Railway](https://railway.app/)
   - **MongoDB:** Use [MongoDB Atlas](https://www.mongodb.com/atlas)
4. Make sure connection strings use SSL if required

---

## Deployment Checklist

Use this checklist to ensure everything is configured correctly:

### Backend Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] Backend deployed to Vercel
- [ ] Environment variables added in Vercel Dashboard:
  - [ ] `NODE_ENV=production`
  - [ ] `OPENAI_API_KEY=sk-xxx...`
  - [ ] `OPENAI_MODEL=gpt-4o-mini`
  - [ ] `OPENAI_ENDPOINT=https://api.openai.com/v1/chat/completions`
- [ ] Health check endpoint works: `/health` returns `{"ok": true}`
- [ ] Backend URL saved for frontend configuration

### Frontend Deployment Checklist

- [ ] Frontend deployed to Vercel
- [ ] Environment variables added:
  - [ ] `VITE_API_URL=https://your-backend-url.vercel.app`
- [ ] Frontend redeployed after adding environment variables
- [ ] Frontend loads without errors
- [ ] All routes work (`/`, `/convert`, `/visualize`, `/migrate`)
- [ ] API connection works (test on Convert page)

---

## Optional: Custom Domain

Want to use your own domain? (e.g., `turbodbx.com`)

### For Frontend:

1. Go to Vercel Dashboard → Your Frontend Project → Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `turbodbx.com` or `www.turbodbx.com`)
4. Follow DNS configuration instructions (add CNAME or A record)
5. Wait for DNS propagation (5 minutes to 24 hours)

### For Backend:

1. Go to Vercel Dashboard → Your Backend Project → Settings → Domains
2. Click "Add Domain"
3. Enter your subdomain (e.g., `api.turbodbx.com`)
4. Configure DNS
5. **Update frontend environment variable:**
   - Change `VITE_API_URL` to `https://api.turbodbx.com`
   - Redeploy frontend

---

## Vercel CLI Quick Reference

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (development)
vercel

# Deploy to production
vercel --prod

# Add environment variable
vercel env add VARIABLE_NAME production

# List environment variables
vercel env ls

# Pull environment variables to local
vercel env pull

# View deployment logs
vercel logs [deployment-url]

# Remove deployment
vercel rm [deployment-name]
```

---

## Updating Your Deployment

### Update Backend

```bash
# Make changes to code
git add .
git commit -m "Update backend"
git push

# Vercel will auto-deploy from GitHub
# Or manually deploy:
cd apps/backend
vercel --prod
```

### Update Frontend

```bash
# Make changes to code
git add .
git commit -m "Update frontend"
git push

# Vercel will auto-deploy from GitHub
# Or manually deploy:
cd apps/frontend
vercel --prod
```

### Update Environment Variables

```bash
# Using Vercel Dashboard (recommended)
# Go to Project Settings → Environment Variables → Edit

# Or using CLI
vercel env add VARIABLE_NAME production
# Then redeploy
vercel --prod
```

---

## Cost Estimate

Vercel Free Tier includes:
- ✅ 100 GB bandwidth per month
- ✅ Serverless function executions
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic deployments from Git

**Cost Breakdown:**
- **Vercel Free Tier:** $0/month (sufficient for most use cases)
- **OpenAI API (GPT-4o-mini):** ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Database (if using cloud):**
  - Neon PostgreSQL: Free tier available
  - MongoDB Atlas: Free tier (512MB)
  - PlanetScale MySQL: Free tier available
- **Redis (optional):**
  - Upstash Redis: Free tier (10K commands/day)

**Estimated Total:** $0-10/month depending on usage

---

## Production Best Practices

1. **Environment Variables:**
   - Never commit `.env` files
   - Use different values for production vs development
   - Rotate API keys periodically

2. **Monitoring:**
   - Check Vercel Analytics in dashboard
   - Set up error tracking (e.g., Sentry)
   - Monitor OpenAI usage and costs

3. **Security:**
   - Keep dependencies updated: `npm audit fix`
   - Use strong database passwords
   - Enable rate limiting if possible

4. **Performance:**
   - Monitor serverless function execution times
   - Use edge caching where appropriate
   - Optimize bundle size: `npm run build` and check `dist` size

5. **Backups:**
   - Regular database backups if using live migrations
   - Keep Git repository up to date
   - Document your configuration

---

## Support and Resources

- **Vercel Documentation:** https://vercel.com/docs
- **Vercel Guides:** https://vercel.com/guides
- **Vercel Community:** https://github.com/vercel/vercel/discussions
- **TurboDBX Repository:** https://github.com/N-Saipraveen/turbo1
- **Project README:** See `/README.md` for full project documentation
- **Usage Guide:** See `/USAGE.md` for API and feature documentation

---

## Quick Start Summary

**In 5 minutes:**

1. **Deploy Backend:**
   ```bash
   cd apps/backend
   vercel --prod
   # Save the URL: https://your-backend.vercel.app
   # Add environment variables in dashboard
   ```

2. **Deploy Frontend:**
   ```bash
   cd apps/frontend
   vercel --prod
   # Add VITE_API_URL environment variable
   # Redeploy
   ```

3. **Test:**
   ```bash
   # Backend health
   curl https://your-backend.vercel.app/health

   # Frontend
   open https://your-frontend.vercel.app
   ```

**That's it! Your TurboDBX is now live on Vercel! 🚀**

---

## Need Help?

If you encounter issues not covered in this guide:

1. Check Vercel deployment logs
2. Review browser console errors
3. Test API endpoints individually
4. Check environment variables are set correctly
5. Consult Vercel documentation
6. Open an issue on GitHub: https://github.com/N-Saipraveen/turbo1/issues

**Happy deploying! 🎉**
