# Testing Guide - Distributed Communication System

## How to Test with Multiple Users (Before Hosting)

This guide explains how to allow others to test the application on your local network before deploying to a public server.

---

## Option 1: Local Network Testing (Recommended for Testing)

### Step 1: Find Your Computer's IP Address

#### On Windows:
```powershell
# Method 1: Using PowerShell
ipconfig | findstr IPv4

# Method 2: Detailed information
ipconfig /all

# Look for "IPv4 Address" under your network adapter (WiFi or Ethernet)
```

#### On Mac/Linux:
```bash
ifconfig | grep "inet "
# or
ip addr show
```

You'll see something like: `192.168.1.100` or `10.0.0.50`

### Step 2: Configure Server to Accept External Connections

The server is already configured to accept connections from any IP address (`0.0.0.0`), but let's verify the server listens on all interfaces.

**Current server.js already listens on all interfaces by default!** ✅

### Step 3: Start the Server

```bash
# In the project directory
npm start
# or
node server.js
```

You should see:
```
Distributed Communication System Server running on port 8080
Access the application at http://localhost:8080
Server is ready to handle distributed connections...
```

### Step 4: Allow Firewall Access (IMPORTANT!)

#### Windows Firewall:
1. Open **Windows Defender Firewall**
2. Click **"Allow an app or feature through Windows Firewall"**
3. Click **"Change Settings"** → **"Allow another app..."**
4. Browse to Node.js (usually in `C:\Program Files\nodejs\node.exe`)
5. Check both **Private** and **Public** networks
6. Click **OK**

**OR use PowerShell (Run as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "Node.js Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### Step 5: Share Connection Details

Tell your testers to:
1. **Make sure they're on the same WiFi/Network** as you
2. Open their browser and go to: `http://YOUR_IP_ADDRESS:8080`
   - Replace `YOUR_IP_ADDRESS` with your actual IP (e.g., `http://192.168.1.100:8080`)

### Step 6: Test!

- Each person opens the URL in their browser
- Each person enters a different username
- Create groups and send messages
- Test private messaging between users

---

## Option 2: Using Localhost Tunneling (For Remote Testers)

If testers are not on the same network, use a tunneling service:

### Using ngrok (Recommended)

1. **Install ngrok:**
   - Download from: https://ngrok.com/download
   - Or use: `choco install ngrok` (if you have Chocolatey)

2. **Start your server:**
   ```bash
   node server.js
   ```

3. **In a new terminal, start ngrok:**
   ```bash
   ngrok http 8080
   ```

4. **Share the ngrok URL:**
   - ngrok will show something like: `https://abc123.ngrok.io`
   - Share this URL with testers
   - They access: `https://abc123.ngrok.io`
   - **Note:** Update the WebSocket URL in client code if using HTTPS (see below)

### Alternative: Using localtunnel

```bash
# Install
npm install -g localtunnel

# Start server
node server.js

# In another terminal, create tunnel
lt --port 8080

# Share the URL provided (e.g., https://random-name.loca.lt)
```

---

## Option 3: Testing on Same Computer (Quick Test)

You can test with multiple users on the same computer:

1. Open multiple browser windows/tabs
2. Open: `http://localhost:8080`
3. Use different usernames in each window
4. Test group and private messaging

**Or use different browsers:**
- Chrome, Firefox, Edge, etc.
- Each browser = different session
- Use different usernames

---

## Important: WebSocket URL Configuration

### Current Configuration (Works for Local Network)

The client automatically uses the correct WebSocket URL:

```javascript
// From client/app.js
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
```

This means:
- If accessing via `http://192.168.1.100:8080` → WebSocket uses `ws://192.168.1.100:8080`
- If accessing via `http://localhost:8080` → WebSocket uses `ws://localhost:8080`

**This works automatically!** ✅

---

## Troubleshooting

### Problem: "Connection refused" or "Can't connect"

**Solutions:**
1. **Check if server is running:**
   ```bash
   netstat -ano | findstr :8080
   ```

2. **Check firewall settings:**
   - Ensure port 8080 is allowed
   - Try temporarily disabling firewall to test

3. **Check IP address:**
   - Make sure you're using the correct IP
   - IP might change if you reconnect to WiFi

4. **Check same network:**
   - All testers must be on the same WiFi/network
   - Corporate/school networks might block connections

### Problem: WebSocket connection fails

**Solutions:**
1. **Check browser console** (F12) for errors
2. **Verify server is running** and accessible
3. **If using ngrok with HTTPS**, ensure client uses `wss://` protocol

### Problem: Can't see other users

**Solutions:**
1. **Refresh the page** to reconnect
2. **Check server console** for connection logs
3. **Verify all users are registered** (entered usernames)
4. **Check same server URL** - all must use the same address

---

## Testing Checklist

Use this checklist when testing:

- [ ] Server starts without errors
- [ ] Can access `http://localhost:8080` on host computer
- [ ] Can access `http://YOUR_IP:8080` on other devices (same network)
- [ ] Multiple users can connect simultaneously
- [ ] Users can create groups
- [ ] Users can join groups
- [ ] Group messages work (multicast) - all members receive
- [ ] Private messages work (unicast) - only recipient receives
- [ ] Member join/leave notifications work
- [ ] Messages are logged to `message_log.txt`
- [ ] Connection handling works (disconnect/reconnect)

---

## Quick Start Commands

### For Local Network Testing:

```bash
# 1. Find your IP
ipconfig | findstr IPv4

# 2. Start server
npm start

# 3. Allow firewall (Run PowerShell as Admin)
New-NetFirewallRule -DisplayName "Node.js Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow

# 4. Share URL with testers
# http://YOUR_IP:8080
```

### For Remote Testing (ngrok):

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Start ngrok
ngrok http 8080

# Share the ngrok HTTPS URL with testers
```

---

## Notes for Testers

When sharing with testers, provide these instructions:

1. **Make sure you're on the same WiFi network** (for local testing)
2. **Open your browser** (Chrome, Firefox, or Edge recommended)
3. **Go to:** `http://[IP_ADDRESS]:8080`
4. **Enter a unique username** (no spaces)
5. **Click "Connect"**
6. **Start testing:**
   - Create or join a group
   - Send group messages
   - Send private messages to other users
7. **If connection fails**, check:
   - Server IP address is correct
   - You're on the same network
   - Firewall isn't blocking

---

## Next Steps: Production Hosting

After testing, you can deploy to:
- **Heroku** (free tier available)
- **AWS EC2**
- **DigitalOcean**
- **Railway**
- **Render** (free tier available)

See deployment documentation for hosting instructions.

