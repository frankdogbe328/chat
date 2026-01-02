# Deployment Guide - Host Your Distributed Communication System

## Quick Deploy Options (FREE)

Since you need to host it before testing with others, here are the easiest free hosting options:

---

## Option 1: Render (Recommended - Easiest) ⭐

**Render offers free hosting with automatic HTTPS!**

### Step-by-Step:

1. **Create Account**
   - Go to: https://render.com
   - Sign up with GitHub (recommended) or email

2. **Prepare Your Code**
   - Push your code to GitHub (if not already):
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin YOUR_GITHUB_REPO_URL
     git push -u origin main
     ```

3. **Deploy on Render**
   - Go to Render dashboard → Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Configure:
     - **Name:** `distributed-communication-system`
     - **Environment:** `Node`
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Plan:** Free
   - Add Environment Variable:
     - Key: `PORT`
     - Value: `10000` (Render uses PORT env variable)
   - Click **"Create Web Service"**

4. **Update Server for Render**
   - Render uses PORT environment variable automatically
   - Your server.js already supports this: `const PORT = process.env.PORT || 8080;` ✅

5. **Get Your URL**
   - Render provides: `https://your-app-name.onrender.com`
   - Share this URL with testers!

6. **Important for WebSocket:**
   - Render free tier may sleep after 15 minutes of inactivity
   - First request might be slow (wake up time)
   - WebSocket works, but connection might drop after inactivity

---

## Option 2: Railway (Fast & Easy)

### Step-by-Step:

1. **Create Account**
   - Go to: https://railway.app
   - Sign up with GitHub

2. **Deploy**
   - Click **"New Project"** → **"Deploy from GitHub repo"**
   - Select your repository
   - Railway auto-detects Node.js and deploys!

3. **Environment Variables**
   - Railway auto-sets PORT (no configuration needed)
   - Your code already uses `process.env.PORT` ✅

4. **Get Your URL**
   - Railway provides: `https://your-app-name.up.railway.app`
   - Share with testers!

5. **WebSocket Support**
   - Railway supports WebSocket out of the box
   - Better for real-time apps than Render

---

## Option 3: Fly.io (Good for WebSocket)

### Step-by-Step:

1. **Install Fly CLI**
   ```bash
   # Windows (PowerShell)
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Login**
   ```bash
   fly auth login
   ```

3. **Create App**
   ```bash
   fly launch
   ```
   - Follow prompts
   - Create fly.toml automatically

4. **Deploy**
   ```bash
   fly deploy
   ```

5. **Get URL**
   ```bash
   fly open
   ```

---

## Option 4: Heroku (Classic Option)

### Step-by-Step:

1. **Install Heroku CLI**
   - Download: https://devcenter.heroku.com/articles/heroku-cli

2. **Login**
   ```bash
   heroku login
   ```

3. **Create App**
   ```bash
   heroku create your-app-name
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **Open**
   ```bash
   heroku open
   ```

**Note:** Heroku free tier is discontinued, but paid plans available.

---

## Quick Setup Files for Hosting

### For Render/Railway/Fly.io:

Create `Procfile` (if needed):
```
web: node server.js
```

### Update package.json (Already done ✅)

Your package.json already has:
- `"start": "node server.js"` ✅
- `"engines": { "node": ">=14.0.0" }` ✅

---

## Testing After Deployment

1. **Get your hosted URL** (e.g., `https://your-app.onrender.com`)

2. **Share with testers:**
   - Send them the URL
   - Anyone can access from anywhere
   - No network restrictions!

3. **Test features:**
   - Multiple users connect simultaneously
   - Create groups
   - Send group messages (multicast)
   - Send private messages (unicast)
   - Member join/leave notifications

---

## Troubleshooting Deployment

### Problem: WebSocket not working on Render

**Solution:**
- Render free tier might have WebSocket limitations
- Try Railway or Fly.io instead (better WebSocket support)

### Problem: App sleeps after inactivity

**Solution (Render):**
- Use a pinger service like: https://www.cron-job.org
- Ping your URL every 10 minutes to keep it awake

### Problem: PORT error

**Solution:**
- All platforms set PORT automatically
- Your code already handles: `process.env.PORT || 8080` ✅

### Problem: Build fails

**Solution:**
- Check that `package.json` has correct scripts
- Ensure Node.js version is >= 14
- Check build logs on hosting platform

---

## Recommended: Railway or Fly.io

For WebSocket apps like yours, **Railway** or **Fly.io** are best because:
- ✅ Better WebSocket support
- ✅ No sleeping (free tier)
- ✅ Easy deployment
- ✅ HTTPS included
- ✅ Free tier available

---

## Quick Deploy Checklist

Before deploying:
- [ ] Code pushed to GitHub
- [ ] `package.json` has start script ✅
- [ ] `server.js` uses `process.env.PORT` ✅
- [ ] Tested locally first
- [ ] `.gitignore` excludes `node_modules/` ✅

After deploying:
- [ ] Test connection from browser
- [ ] Test WebSocket connection (login works)
- [ ] Share URL with testers
- [ ] Monitor logs for errors

---

## Example Deployment URLs

After deployment, your app will be accessible at:
- **Render:** `https://distributed-chat.onrender.com`
- **Railway:** `https://distributed-chat.up.railway.app`
- **Fly.io:** `https://your-app.fly.dev`

Share these URLs - anyone can test from anywhere! 🌍
