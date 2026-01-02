# Distributed Communication System

A distributed communication application that supports group messaging (multicast) and private messaging (unicast) across multiple nodes. Built for CSBC 311 - Distributed Systems course project.

## Features

### Core Requirements

✅ **Group Management**
- Create new groups
- Join existing groups
- Leave groups
- Active membership tracking

✅ **Group Communication (Multicast)**
- Send messages to entire group
- All online group members receive messages in real-time

✅ **Private Messaging (Unicast)**
- Send direct private messages to specific users
- Only the intended recipient receives the message
- Retry mechanism for message delivery

✅ **Distributed Operation**
- WebSocket-based communication (message passing)
- Can run multiple server instances
- No shared memory model - pure message passing architecture

✅ **Reliability Features**
- Member join/leave detection and notifications
- Message retry mechanism for private messages (up to 3 retries)
- Message logging to file (`message_log.txt`)
- Heartbeat mechanism for connection health monitoring

✅ **Web Interface**
- Modern, responsive UI
- Real-time updates
- Easy-to-use chat interface

## System Architecture

```
┌─────────────┐
│   Client 1  │──┐
└─────────────┘  │
                 │
┌─────────────┐  │    ┌──────────────┐
│   Client 2  │──┼───▶│ WebSocket    │
└─────────────┘  │    │    Server    │
                 │    │  (Node.js)   │
┌─────────────┐  │    │              │
│   Client 3  │──┘    │ - Groups     │
└─────────────┘       │ - Clients    │
                      │ - Messages   │
                      └──────────────┘
                            │
                            ▼
                      ┌──────────────┐
                      │ Message Log  │
                      │  (File)      │
                      └──────────────┘
```

### Distributed Concepts Demonstrated

1. **Message Passing**: Communication via WebSocket messages (no shared memory)
2. **Multicast**: Group messages delivered to all group members
3. **Unicast**: Private messages delivered to specific recipients
4. **Membership Management**: Active tracking of online users and group members
5. **Fault Detection**: Heartbeat mechanism to detect disconnected clients
6. **Message Logging**: Persistent logging of all messages for reliability

## Installation

### Prerequisites

- Node.js (version 14.0.0 or higher)
- npm (comes with Node.js)

### Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   
   Or alternatively:
   ```bash
   node server.js
   ```

3. **Access the Application**
   - Open your web browser
   - Navigate to `http://localhost:8080`
   - Enter a username to connect

4. **Testing with Multiple Users (Local Network)**
   - **Find your IP address:** Run `ipconfig | findstr IPv4` (Windows) or see `get-ip.ps1`
   - **Allow firewall:** Run PowerShell as Admin: `New-NetFirewallRule -DisplayName "Node.js Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow`
   - **Share URL:** Give testers `http://YOUR_IP:8080` (e.g., `http://192.168.1.100:8080`)
   - **Important:** All testers must be on the same WiFi/network
   - See `TESTING_GUIDE.md` for detailed instructions

5. **Run Multiple Instances (Distributed Setup)**
   - To simulate distributed nodes, start multiple server instances on different ports:
   ```bash
   PORT=8080 node server.js
   PORT=8081 node server.js
   PORT=8082 node server.js
   ```
   - Access each instance via its respective port (e.g., `http://localhost:8080`, `http://localhost:8081`)

## Usage

### Getting Started

1. **Connect to the System**
   - Enter a unique username
   - Click "Connect" to join the distributed network

2. **Create a Group**
   - Enter a group name in the "Group name" field
   - Click "Create" button
   - The group will be visible to all users

3. **Join a Group**
   - Click on any group in the Groups list
   - You'll automatically join and can start messaging

4. **Send Group Messages**
   - Select a group you've joined
   - Type your message in the input field
   - Press Enter or click "Send"
   - All group members will receive your message

5. **Send Private Messages**
   - Click on a user in the "Online Users" list
   - Type your private message
   - Press Enter or click "Send"
   - Only that user will receive the message

6. **Leave a Group**
   - While viewing a group chat, click "Leave Group"
   - You'll be removed from the group

### Features in Action

- **Member Detection**: When users join or leave groups, all members are notified
- **Message Logging**: All messages are logged to `message_log.txt` in the server directory
- **Retry Mechanism**: Private messages automatically retry up to 3 times if the recipient is temporarily unavailable
- **Connection Health**: The system automatically detects and removes dead connections

## File Structure

```
distributed-communication-system/
│
├── server.js              # Node.js WebSocket server
├── package.json           # Project dependencies
├── README.md             # This file
├── message_log.txt       # Message log (generated at runtime)
│
└── client/               # Client-side files
    ├── index.html        # Main HTML interface
    ├── style.css         # Styling
    └── app.js            # Client-side JavaScript
```

## Technologies Used

- **Backend**: Node.js, WebSocket (ws library)
- **Frontend**: Pure HTML5, CSS3, JavaScript (Vanilla JS)
- **Communication**: WebSocket protocol (TCP-based)
- **Architecture**: Message-passing distributed system

## Distributed Systems Concepts

1. **Message Passing**: All communication uses explicit message passing via WebSocket
2. **Multicast Communication**: Group messages are broadcasted to all members
3. **Unicast Communication**: Private messages sent to specific recipients
4. **Active Membership**: Real-time tracking of online users and group membership
5. **Fault Tolerance**: Connection monitoring and automatic cleanup
6. **Message Reliability**: Retry mechanisms and message logging

## Limitations

1. **Single Server**: Currently runs on a single server instance (can be scaled by running multiple instances)
2. **No Persistence**: Messages are not persisted in a database (only logged to file)
3. **No Encryption**: Messages are not encrypted (optional enhancement mentioned in requirements)
4. **No Message Ordering**: Group messages may arrive in different order to different clients (optional enhancement)

## Future Improvements

- Message ordering within groups (sequencing/vector clocks)
- Acknowledgments for delivered messages
- Persistent chat history in database
- End-to-end encryption for private messages
- Advanced fault detection (heartbeat checks with configurable timeouts)
- Load balancing for multiple server instances
- Message queue system for better reliability
- User authentication and authorization

## Troubleshooting

### Port Already in Use
If port 8080 is already in use, you can specify a different port:
```bash
PORT=3000 node server.js
```

### Connection Errors
- Ensure the server is running before accessing the web interface
- Check firewall settings if connecting from different machines
- Verify WebSocket support in your browser

### Message Delivery Issues
- Check browser console for error messages
- Verify both users are connected and online
- Check server logs for delivery errors

## Deployment (Hosting)

To deploy your application for others to test:

### Quick Deploy with Railway (Recommended)

1. Push your code to GitHub
2. Go to https://railway.app
3. Sign up with GitHub
4. Click "New Project" → "Deploy from GitHub repo"
5. Select your repository
6. Railway auto-deploys!
7. Get your URL and share with testers

See `DEPLOYMENT_GUIDE.md` for detailed instructions on:
- Railway deployment
- Render deployment
- Fly.io deployment
- Heroku deployment

### Other Free Hosting Options

- **Render.com** - Free tier available
- **Fly.io** - Great for WebSocket apps
- **Railway** - Easiest deployment
- **Heroku** - Classic option (paid now)

## License

MIT License - Free to use for educational purposes

## Author

Developed for CSBC 311 - Distributed Systems course project
Ghana Communication Technology University

