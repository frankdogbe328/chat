# How the Distributed Communication System Works

## 1. How Users Connect from Different Places (Distributed Connections)

### WebSocket-Based Connection Architecture

The system uses **WebSocket protocol** over TCP/IP, which allows clients from anywhere in the world to connect to the server as long as they have network access.

```
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket Server                         │
│              (Listening on Port 8080)                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Client Store │  │ Groups Store │  │ Message Log  │    │
│  │ (Map)        │  │ (Map)        │  │ (Array/File) │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
          ▲                    ▲                    ▲
          │                    │                    │
    ┌─────┴─────┐        ┌─────┴─────┐        ┌─────┴─────┐
    │  User 1   │        │  User 2   │        │  User N   │
    │ (Location │        │ (Location │        │ (Location │
    │   A)      │        │   B)      │        │   Z)      │
    └───────────┘        └───────────┘        └───────────┘
```

### Connection Process

1. **Client Initiates Connection**
   ```javascript
   // From client/app.js (lines 43-47)
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   const wsUrl = `${protocol}//${window.location.host}`;
   ws = new WebSocket(wsUrl);
   ```
   - Client opens a WebSocket connection to the server
   - Works over the internet, LAN, or localhost
   - Uses TCP/IP protocol (reliable connection)

2. **Server Accepts Connection**
   ```javascript
   // From server.js (lines 211-212)
   wss.on('connection', (socket, req) => {
       console.log('New WebSocket connection');
   ```
   - Server accepts the WebSocket connection
   - Each connection is stored in the `clients` Map
   - Connection is identified by the WebSocket socket object

3. **User Registration**
   ```javascript
   // From server.js (lines 219-248)
   case 'register':
       const username = message.username.trim();
       clients.set(socket, new ClientInfo(username, socket));
   ```
   - Client sends a registration message with username
   - Server stores: `clients.set(socket, new ClientInfo(username, socket))`
   - Each user gets a unique entry in the clients Map

### Distributed Connection Features

- **No Geographic Limitation**: Users can connect from anywhere (different cities, countries, networks)
- **Real-time Communication**: WebSocket maintains persistent bidirectional connection
- **Automatic Reconnection**: If connection drops, client can reconnect
- **Heartbeat Monitoring**: Server checks connection health every 30 seconds

```javascript
// From server.js (lines 197-208)
setInterval(() => {
    const now = Date.now();
    for (const [socket, clientInfo] of clients.entries()) {
        if (socket.readyState !== WebSocket.OPEN) {
            handleDisconnection(socket);
        } else if (now - clientInfo.lastHeartbeat > 60000) {
            socket.terminate();
            handleDisconnection(socket);
        }
    }
}, 30000);
```

---

## 2. How Private Messaging Works (Unicast)

### Private Message Flow

**Unicast** = One-to-one communication. Message sent from one user to a specific recipient.

```
User A ──[Private Message]──> Server ──[Private Message]──> User B
         "Hello Bob"                          "Hello Bob"
         (recipient: "Bob")                   (from: "User A")
```

### Step-by-Step Process

1. **User Sends Private Message**
   ```javascript
   // From client/app.js (when user types and sends)
   ws.send(JSON.stringify({
       type: 'private_message',
       to: 'Bob',           // Target username
       content: 'Hello Bob'
   }));
   ```

2. **Server Receives and Routes Message**
   ```javascript
   // From server.js (lines 446-494)
   case 'private_message':
       const recipient = message.to;  // "Bob"
       const privateContent = message.content;  // "Hello Bob"
       
       const privateMsg = {
           type: 'private_message',
           from: clientInfo5.username,  // "User A"
           content: privateContent,
           timestamp: new Date().toISOString()
       };
   ```

3. **Server Finds Recipient's Connection**
   ```javascript
   // From server.js (lines 103-112)
   function sendToClient(targetUsername, message) {
       for (const [socket, clientInfo] of clients.entries()) {
           if (clientInfo.username === targetUsername && 
               socket.readyState === WebSocket.OPEN) {
               socket.send(JSON.stringify(message));
               return true;  // Success!
           }
       }
       return false;  // User not found or offline
   }
   ```
   - Server searches the `clients` Map for username "Bob"
   - Finds Bob's WebSocket connection
   - Sends message directly to Bob's socket

4. **Reliability: Retry Mechanism**
   ```javascript
   // From server.js (lines 467-494)
   let retries = 3;
   let privateDelivered = false;
   
   const attemptDelivery = () => {
       privateDelivered = sendToClient(recipient, privateMsg);
       
       if (privateDelivered) {
           // Success! Log and notify sender
           logMessage('private', clientInfo5.username, recipient, privateContent);
       } else {
           retries--;
           if (retries > 0) {
               setTimeout(attemptDelivery, 1000);  // Retry after 1 second
           }
       }
   };
   ```
   - If recipient is temporarily unavailable, retry up to 3 times
   - Wait 1 second between retries
   - Ensures message delivery even if user briefly disconnects

5. **Recipient Receives Message**
   ```javascript
   // From client/app.js (lines 58-61)
   ws.onmessage = (event) => {
       const message = JSON.parse(event.data);
       handleServerMessage(message);  // Displays message in UI
   };
   ```

### Key Features of Private Messaging

✅ **Unicast**: Message goes to exactly ONE recipient  
✅ **Direct Routing**: Server finds recipient by username  
✅ **Retry Logic**: Automatic retry if recipient temporarily unavailable  
✅ **Secure**: Only the intended recipient receives the message  
✅ **Logged**: All private messages logged to `message_log.txt`

---

## 3. How Group Messaging Works (Multicast)

### Group Message Flow

**Multicast** = One-to-many communication. Message sent to a group, received by ALL group members.

```
User A ──[Group Message]──> Server ──┐
         "Hello Group!"               │
         (groupId: "Team1")           │
                                      ├──> Broadcast to all group members
                                      │
                    ┌─────────────────┼──> User B (Member)
                    │                 │    "Hello Group!" (from: User A)
                    │                 │
                    │                 ├──> User C (Member)
                    │                 │    "Hello Group!" (from: User A)
                    │                 │
                    │                 └──> User D (Member)
                    │                      "Hello Group!" (from: User A)
                    │
        Group "Team1" = [User A, User B, User C, User D]
```

### Step-by-Step Process

1. **User Joins or Creates Group**
   ```javascript
   // From server.js (lines 320-345)
   case 'create_group':
       groups.set(groupId, new Set([socket]));  // Create group with creator
       clientInfo1.joinedGroups.add(groupId);   // Mark user as member
   
   case 'join_group':
       groups.get(joinGroupId).add(socket);      // Add socket to group
       clientInfo2.joinedGroups.add(joinGroupId); // Mark user as member
   ```
   - Groups stored as: `groups = Map<groupId, Set<WebSocket>>`
   - Each group contains Set of WebSocket connections (members)
   - Each user tracks which groups they've joined

2. **User Sends Group Message**
   ```javascript
   // From client/app.js (user sends message)
   ws.send(JSON.stringify({
       type: 'group_message',
       groupId: 'Team1',
       content: 'Hello Group!'
   }));
   ```

3. **Server Validates Membership**
   ```javascript
   // From server.js (lines 407-424)
   case 'group_message':
       const msgGroupId = message.groupId;
       
       // Check if user is member of this group
       if (!clientInfo4.joinedGroups.has(msgGroupId)) {
           socket.send(JSON.stringify({
               type: 'error',
               message: `You are not a member of "${msgGroupId}"`
           }));
           break;
       }
   ```

4. **Server Broadcasts to All Group Members**
   ```javascript
   // From server.js (lines 85-101)
   function broadcastToGroup(groupId, message, excludeSocket = null) {
       const group = groups.get(groupId);  // Get Set of member sockets
       if (!group) return false;
       
       const messageStr = JSON.stringify(message);
       
       // Iterate through ALL sockets in the group
       group.forEach((socket) => {
           if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
               socket.send(messageStr);  // Send to each member
               delivered = true;
           }
       });
       
       return delivered;
   }
   ```
   - Gets the Set of WebSocket connections for the group
   - Loops through each member's socket
   - Sends message to each active member
   - Excludes sender (so they don't see their own message twice)

5. **All Group Members Receive Message**
   ```javascript
   // From server.js (lines 426-443)
   const groupMsg = {
       type: 'group_message',
       groupId: msgGroupId,
       from: clientInfo4.username,  // "User A"
       content: message.content,    // "Hello Group!"
       timestamp: new Date().toISOString()
   };
   
   const groupDelivered = broadcastToGroup(msgGroupId, groupMsg, socket);
   ```
   - All online members receive the same message
   - Each member sees: "User A: Hello Group!"

### Key Features of Group Messaging

✅ **Multicast**: One message delivered to ALL group members  
✅ **Membership-Based**: Only group members receive messages  
✅ **Real-time**: All members receive message simultaneously  
✅ **Automatic Updates**: When members join/leave, others are notified  
✅ **Logged**: All group messages logged with group ID

### Member Management

```javascript
// From server.js (lines 145-184)
function handleDisconnection(socket) {
    const clientInfo = clients.get(socket);
    
    // Remove from all groups
    clientInfo.joinedGroups.forEach((groupId) => {
        const group = groups.get(groupId);
        group.delete(socket);  // Remove socket from group
        
        // Notify remaining members
        broadcastToGroup(groupId, {
            type: 'member_left',
            username: clientInfo.username
        });
    });
}
```

When a user disconnects:
- Removed from all groups automatically
- Other members notified: "User X left the group"
- Group deleted if it becomes empty

---

## Summary: Distributed Communication Patterns

| Pattern | How It Works | Implementation |
|---------|-------------|----------------|
| **Connection** | WebSocket TCP/IP connections | Any client can connect from anywhere via `ws://server:8080` |
| **Unicast (Private)** | One-to-one message routing | Server finds recipient by username in `clients` Map, sends to their socket |
| **Multicast (Group)** | One-to-many broadcasting | Server gets group's Set of sockets, loops through and sends to each |

### Data Structures Used

1. **`clients` Map**: `Map<WebSocket, ClientInfo>`
   - Stores all connected users
   - Key: WebSocket connection
   - Value: User info (username, joined groups)

2. **`groups` Map**: `Map<groupId, Set<WebSocket>>`
   - Stores all groups and their members
   - Key: Group ID (string)
   - Value: Set of WebSocket connections (members)

3. **Message Routing**:
   - Private: Lookup username → find socket → send
   - Group: Lookup groupId → get Set of sockets → broadcast to all

This architecture allows the system to handle distributed connections from anywhere while maintaining reliable one-to-one (unicast) and one-to-many (multicast) communication patterns.

