# Railway Deployment Troubleshooting

## Common Issues and Fixes

### Issue 1: Build Failed

**Error:** Build command failed or npm install failed

**Solution:**
- Check Railway logs for specific error
- Ensure `package.json` has all dependencies
- Verify Node.js version compatibility

**Check:**
```bash
# Your package.json should have:
{
  "engines": {
    "node": ">=14.0.0"
  },
  "dependencies": {
    "ws": "^8.14.2"
  }
}
```

---

### Issue 2: Port Already in Use

**Error:** EADDRINUSE or port binding error

**Solution:**
✅ **Fixed!** Server now handles this error gracefully.

Your server uses:
```javascript
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    // Railway automatically sets PORT
});
```

---

### Issue 3: Server Crashes on Start

**Error:** Process exits immediately

**Check:**
1. **View Railway Logs:**
   - Go to Railway dashboard
   - Click on your project
   - Click "Deployments" tab
   - Click on latest deployment
   - Check "Logs" section

2. **Common causes:**
   - Missing dependencies
   - Syntax errors in server.js
   - PORT not set (should be auto-set by Railway)

---

### Issue 4: 404 Not Found

**Error:** Can't access the application

**Check:**
1. **Is server running?**
   - Check Railway logs for "Server is ready"
   - Should see: "Server running on port XXXX"

2. **Is port correct?**
   - Railway sets PORT automatically
   - Your code uses `process.env.PORT`

3. **Service Type:**
   - Make sure it's deployed as **"Web Service"** not "Worker"
   - Railway should auto-detect, but verify

---

### Issue 5: WebSocket Connection Fails

**Error:** WebSocket can't connect

**Check:**
1. **Is server listening?**
   - Check logs show server started
   
2. **Railway Domain:**
   - Use Railway-provided domain
   - WebSocket works on Railway's HTTPS domain

3. **Client Connection:**
   - Make sure client uses `wss://` for HTTPS domains
   - Your client code auto-detects: `ws://` or `wss://`

---

## Step-by-Step Railway Deployment

### 1. Push Latest Code

Make sure your latest code is on GitHub:

```bash
git add .
git commit -m "Fix Railway deployment"
git push origin main
```

### 2. Deploy on Railway

1. Go to: https://railway.app
2. Open your project (or create new)
3. Click **"Deploy from GitHub repo"**
4. Select: `frankdogbe328/chat`
5. Railway auto-detects and builds

### 3. Check Deployment Logs

1. Click on your deployment
2. Go to **"Logs"** tab
3. Look for:
   - ✅ `npm install` success
   - ✅ `Server running on port XXXX`
   - ✅ `Server is ready to handle distributed connections`

### 4. Get Your URL

1. Click on your service
2. Go to **"Settings"** tab
3. Scroll to **"Domains"**
4. Copy your Railway URL (e.g., `https://chat-production.up.railway.app`)

### 5. Test

1. Open your Railway URL in browser
2. Should see login page
3. Test connection with a username
4. Check browser console (F12) for errors

---

## Railway-Specific Settings

### Environment Variables

Railway automatically sets:
- `PORT` - Railway assigns this automatically ✅

**You don't need to set PORT manually!**

### Build Settings

Railway auto-detects:
- ✅ Node.js runtime
- ✅ Build command: `npm install`
- ✅ Start command: `npm start` (from package.json)

### Service Type

Make sure it's set as:
- ✅ **Web Service** (not Worker)
- ✅ Public (if you want external access)

---

## If Still Failing

### Check Railway Logs

1. Railway dashboard → Your project
2. Click latest deployment
3. Check **"Logs"** tab
4. Look for error messages
5. Copy error and check:
   - Missing files?
   - Dependencies issue?
   - Port binding error?
   - Syntax error?

### Common Log Messages

**Good (Success):**
```
✓ npm install completed
✓ Server running on port 3000
✓ Server is ready to handle distributed connections
```

**Bad (Error):**
```
✗ npm install failed
✗ Port already in use
✗ Cannot find module 'ws'
✗ Syntax error in server.js
```

---

## Alternative: Try Render.com

If Railway continues to fail, try Render:

1. Go to: https://render.com
2. New → Web Service
3. Connect GitHub repo: `frankdogbe328/chat`
4. Configure:
   - Build: `npm install`
   - Start: `npm start`
   - Add env: `PORT=10000`
5. Deploy

---

## Need More Help?

Share the Railway logs and I can help diagnose the specific error!

To view logs:
1. Railway dashboard
2. Your project → Deployments
3. Latest deployment → Logs tab
4. Copy error messages

