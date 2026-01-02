# Quick Start - Testing Guide

## 🚀 Fast Setup for Testing with Others

### Step 1: Find Your IP Address

**Windows (PowerShell):**
```powershell
ipconfig | findstr IPv4
```
Copy the IPv4 address (e.g., `192.168.1.100`)

### Step 2: Allow Firewall Access

**Run PowerShell as Administrator:**
```powershell
New-NetFirewallRule -DisplayName "Node.js Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### Step 3: Start the Server

```bash
npm start
```

### Step 4: Share with Testers

**Tell testers to:**
1. Make sure they're on the **same WiFi network**
2. Open browser and go to: `http://YOUR_IP:8080`
   - Replace `YOUR_IP` with your actual IP from Step 1
   - Example: `http://192.168.1.100:8080`

### Step 5: Test!

- Each person uses a different username
- Create groups and send messages
- Test private messaging

---

## 🌐 Testing with Remote Users (Different Network)

Use **ngrok** for remote testing:

1. **Install ngrok:** https://ngrok.com/download

2. **Start your server:**
   ```bash
   npm start
   ```

3. **Start ngrok (new terminal):**
   ```bash
   ngrok http 8080
   ```

4. **Share the ngrok URL** with testers (e.g., `https://abc123.ngrok.io`)

---

## 💻 Testing on Same Computer

- Open multiple browser windows/tabs
- Go to: `http://localhost:8080`
- Use different usernames in each window

---

## ⚠️ Troubleshooting

**Can't connect?**
- Check firewall settings (Step 2)
- Verify IP address is correct
- Ensure same network for local testing
- Check server is running: `netstat -ano | findstr :8080`

**Need help?** See `TESTING_GUIDE.md` for detailed instructions.

