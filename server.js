const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Server configuration
const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
    // Serve static files
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'client', 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'client', 'style.css'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    } else if (req.url === '/app.js') {
        fs.readFile(path.join(__dirname, 'client', 'app.js'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active connections and groups
const clients = new Map(); // Map<WebSocket, ClientInfo>
const groups = new Map(); // Map<groupId, Set<WebSocket>>
const messageLog = []; // Log of all messages

// Client information structure
class ClientInfo {
    constructor(username, socket) {
        this.username = username;
        this.socket = socket;
        this.joinedGroups = new Set();
        this.lastHeartbeat = Date.now();
    }
}

// Message logging function
function logMessage(type, from, to, content, groupId = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: type, // 'group', 'private', 'system'
        from: from,
        to: to,
        content: content,
        groupId: groupId
    };
    messageLog.push(logEntry);
    
    // Write to log file (append mode)
    const logLine = `${logEntry.timestamp} [${type}] ${from} -> ${to || groupId || 'all'}: ${content}\n`;
    fs.appendFile(path.join(__dirname, 'message_log.txt'), logLine, (err) => {
        if (err) console.error('Failed to write to log file:', err);
    });
}

// Broadcast message to all members of a group
function broadcastToGroup(groupId, message, excludeSocket = null) {
    const group = groups.get(groupId);
    if (!group) return false;

    const messageStr = JSON.stringify(message);
    let delivered = false;
    
    group.forEach((socket) => {
        if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
            socket.send(messageStr);
            delivered = true;
        }
    });
    
    return delivered;
}

// Send message to specific client
function sendToClient(targetUsername, message) {
    for (const [socket, clientInfo] of clients.entries()) {
        if (clientInfo.username === targetUsername && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
            return true;
        }
    }
    return false;
}

// Get list of online users
function getOnlineUsers() {
    const users = [];
    for (const clientInfo of clients.values()) {
        if (clientInfo.socket.readyState === WebSocket.OPEN) {
            users.push(clientInfo.username);
        }
    }
    return users;
}

// Get list of all groups
function getAllGroups() {
    const groupList = [];
    for (const [groupId, members] of groups.entries()) {
        const memberUsernames = [];
        members.forEach((socket) => {
            const clientInfo = clients.get(socket);
            if (clientInfo && socket.readyState === WebSocket.OPEN) {
                memberUsernames.push(clientInfo.username);
            }
        });
        groupList.push({
            groupId: groupId,
            memberCount: memberUsernames.length,
            members: memberUsernames
        });
    }
    return groupList;
}

// Handle client disconnection
function handleDisconnection(socket) {
    const clientInfo = clients.get(socket);
    if (!clientInfo) return;

    // Notify groups about member leaving
    clientInfo.joinedGroups.forEach((groupId) => {
        const group = groups.get(groupId);
        if (group) {
            group.delete(socket);
            
            // Notify remaining members
            const leaveMessage = {
                type: 'member_left',
                groupId: groupId,
                username: clientInfo.username,
                timestamp: new Date().toISOString()
            };
            broadcastToGroup(groupId, leaveMessage);
            
            // Remove group if empty
            if (group.size === 0) {
                groups.delete(groupId);
                logMessage('system', 'server', null, `Group "${groupId}" deleted (empty)`, groupId);
            }
        }
    });

    // Remove client
    clients.delete(socket);
    
    // Notify all connected clients about updated user list
    const updateMessage = {
        type: 'user_list_update',
        users: getOnlineUsers()
    };
    broadcastToAll(updateMessage, socket);
    
    logMessage('system', 'server', null, `User "${clientInfo.username}" disconnected`);
}

// Broadcast to all connected clients
function broadcastToAll(message, excludeSocket = null) {
    const messageStr = JSON.stringify(message);
    for (const [socket, clientInfo] of clients.entries()) {
        if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
            socket.send(messageStr);
        }
    }
}

// Clean up dead connections periodically
setInterval(() => {
    const now = Date.now();
    for (const [socket, clientInfo] of clients.entries()) {
        if (socket.readyState !== WebSocket.OPEN) {
            handleDisconnection(socket);
        } else if (now - clientInfo.lastHeartbeat > 60000) {
            // No heartbeat for 60 seconds, consider dead
            socket.terminate();
            handleDisconnection(socket);
        }
    }
}, 30000); // Check every 30 seconds

// WebSocket connection handler
wss.on('connection', (socket, req) => {
    console.log('New WebSocket connection');
    
    socket.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'register':
                    // Register new user
                    if (message.username && message.username.trim()) {
                        // Check if username already exists
                        let usernameExists = false;
                        for (const clientInfo of clients.values()) {
                            if (clientInfo.username.toLowerCase() === message.username.toLowerCase().trim() 
                                && clientInfo.socket.readyState === WebSocket.OPEN) {
                                usernameExists = true;
                                break;
                            }
                        }
                        
                        if (usernameExists) {
                            socket.send(JSON.stringify({
                                type: 'register_error',
                                message: 'Username already taken. Please choose another.'
                            }));
                            socket.close();
                            return;
                        }
                        
                        const username = message.username.trim();
                        clients.set(socket, new ClientInfo(username, socket));
                        
                        socket.send(JSON.stringify({
                            type: 'registered',
                            username: username,
                            message: 'Successfully registered'
                        }));
                        
                        // Send current groups and users
                        socket.send(JSON.stringify({
                            type: 'initial_data',
                            groups: getAllGroups(),
                            users: getOnlineUsers()
                        }));
                        
                        // Notify all clients about new user
                        const newUserMessage = {
                            type: 'user_list_update',
                            users: getOnlineUsers()
                        };
                        broadcastToAll(newUserMessage, socket);
                        
                        logMessage('system', 'server', username, 'User registered and connected');
                    }
                    break;
                
                case 'heartbeat':
                    // Update heartbeat timestamp
                    const clientInfo = clients.get(socket);
                    if (clientInfo) {
                        clientInfo.lastHeartbeat = Date.now();
                        socket.send(JSON.stringify({ type: 'heartbeat_ack' }));
                    }
                    break;
                
                case 'create_group':
                    const clientInfo1 = clients.get(socket);
                    if (!clientInfo1) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'You must be registered first'
                        }));
                        break;
                    }
                    
                    const groupId = message.groupId && message.groupId.trim() ? message.groupId.trim() : `group_${Date.now()}`;
                    
                    if (groups.has(groupId)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: `Group "${groupId}" already exists`
                        }));
                        break;
                    }
                    
                    groups.set(groupId, new Set([socket]));
                    clientInfo1.joinedGroups.add(groupId);
                    
                    socket.send(JSON.stringify({
                        type: 'group_created',
                        groupId: groupId
                    }));
                    
                    // Notify all clients about new group
                    broadcastToAll({
                        type: 'group_list_update',
                        groups: getAllGroups()
                    });
                    
                    logMessage('system', clientInfo1.username, null, `Created group "${groupId}"`, groupId);
                    break;
                
                case 'join_group':
                    const clientInfo2 = clients.get(socket);
                    if (!clientInfo2) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'You must be registered first'
                        }));
                        break;
                    }
                    
                    const joinGroupId = message.groupId;
                    if (!groups.has(joinGroupId)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: `Group "${joinGroupId}" does not exist`
                        }));
                        break;
                    }
                    
                    if (clientInfo2.joinedGroups.has(joinGroupId)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: `You are already a member of "${joinGroupId}"`
                        }));
                        break;
                    }
                    
                    groups.get(joinGroupId).add(socket);
                    clientInfo2.joinedGroups.add(joinGroupId);
                    
                    socket.send(JSON.stringify({
                        type: 'group_joined',
                        groupId: joinGroupId
                    }));
                    
                    // Notify group members
                    const joinMessage = {
                        type: 'member_joined',
                        groupId: joinGroupId,
                        username: clientInfo2.username,
                        timestamp: new Date().toISOString()
                    };
                    broadcastToGroup(joinGroupId, joinMessage, socket);
                    
                    logMessage('system', clientInfo2.username, null, `Joined group "${joinGroupId}"`, joinGroupId);
                    break;
                
                case 'leave_group':
                    const clientInfo3 = clients.get(socket);
                    if (!clientInfo3) {
                        break;
                    }
                    
                    const leaveGroupId = message.groupId;
                    const group = groups.get(leaveGroupId);
                    
                    if (!group || !clientInfo3.joinedGroups.has(leaveGroupId)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: `You are not a member of "${leaveGroupId}"`
                        }));
                        break;
                    }
                    
                    group.delete(socket);
                    clientInfo3.joinedGroups.delete(leaveGroupId);
                    
                    socket.send(JSON.stringify({
                        type: 'group_left',
                        groupId: leaveGroupId
                    }));
                    
                    // Notify group members
                    const leaveMsg = {
                        type: 'member_left',
                        groupId: leaveGroupId,
                        username: clientInfo3.username,
                        timestamp: new Date().toISOString()
                    };
                    broadcastToGroup(leaveGroupId, leaveMsg);
                    
                    // Delete group if empty
                    if (group.size === 0) {
                        groups.delete(leaveGroupId);
                        broadcastToAll({
                            type: 'group_list_update',
                            groups: getAllGroups()
                        });
                    }
                    
                    logMessage('system', clientInfo3.username, null, `Left group "${leaveGroupId}"`, leaveGroupId);
                    break;
                
                case 'group_message':
                    const clientInfo4 = clients.get(socket);
                    if (!clientInfo4) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'You must be registered first'
                        }));
                        break;
                    }
                    
                    const msgGroupId = message.groupId;
                    if (!clientInfo4.joinedGroups.has(msgGroupId)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: `You are not a member of "${msgGroupId}"`
                        }));
                        break;
                    }
                    
                    const groupMsg = {
                        type: 'group_message',
                        groupId: msgGroupId,
                        from: clientInfo4.username,
                        content: message.content,
                        timestamp: new Date().toISOString()
                    };
                    
                    const groupDelivered = broadcastToGroup(msgGroupId, groupMsg, socket);
                    
                    if (groupDelivered) {
                        logMessage('group', clientInfo4.username, null, message.content, msgGroupId);
                    } else {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Message could not be delivered (no active members)'
                        }));
                    }
                    break;
                
                case 'private_message':
                    const clientInfo5 = clients.get(socket);
                    if (!clientInfo5) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'You must be registered first'
                        }));
                        break;
                    }
                    
                    const recipient = message.to;
                    const privateContent = message.content;
                    
                    // Retry logic for message delivery (with setTimeout for delayed retries)
                    const privateMsg = {
                        type: 'private_message',
                        from: clientInfo5.username,
                        content: privateContent,
                        timestamp: new Date().toISOString()
                    };
                    
                    let retries = 3;
                    let privateDelivered = false;
                    
                    const attemptDelivery = () => {
                        privateDelivered = sendToClient(recipient, privateMsg);
                        
                        if (privateDelivered) {
                            socket.send(JSON.stringify({
                                type: 'private_message_sent',
                                to: recipient,
                                timestamp: new Date().toISOString()
                            }));
                            logMessage('private', clientInfo5.username, recipient, privateContent);
                        } else {
                            retries--;
                            if (retries > 0) {
                                // Retry after 1 second
                                setTimeout(attemptDelivery, 1000);
                            } else {
                                socket.send(JSON.stringify({
                                    type: 'error',
                                    message: `User "${recipient}" is not online or unreachable after retries`
                                }));
                            }
                        }
                    };
                    
                    attemptDelivery();
                    break;
                
                default:
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type'
                    }));
            }
        } catch (error) {
            console.error('Error processing message:', error);
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    socket.on('close', () => {
        console.log('WebSocket connection closed');
        handleDisconnection(socket);
    });
    
    socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        handleDisconnection(socket);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Distributed Communication System Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
    console.log('Server is ready to handle distributed connections...');
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
        process.exit(1);
    }
});

