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
    } else if (req.url === '/whatsapp-features.js') {
        fs.readFile(path.join(__dirname, 'client', 'whatsapp-features.js'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } else if (req.url === '/friend-system.js') {
        fs.readFile(path.join(__dirname, 'client', 'friend-system.js'), (err, data) => {
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
const friendships = new Map(); // Map<username, { friends: Set, sentRequests: Set, receivedRequests: Set }>
const allRegisteredUsers = new Set(); // Store ALL registered usernames (online and offline)

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
                        allRegisteredUsers.add(username); // Add to all registered users
                        
                        socket.send(JSON.stringify({
                            type: 'registered',
                            username: username,
                            message: 'Successfully registered'
                        }));
                        
                        // Initialize friendship data for new user
                        if (!friendships.has(username)) {
                            friendships.set(username, {
                                friends: new Set(),
                                sentRequests: new Set(),
                                receivedRequests: new Set()
                            });
                        }
                        
                        // Send current groups, users, and friend data
                        socket.send(JSON.stringify({
                            type: 'initial_data',
                            groups: getAllGroups(),
                            users: getOnlineUsers(),
                            allUsers: Array.from(allRegisteredUsers), // Send all registered users
                            friends: Array.from(friendships.get(username)?.friends || []),
                            friendRequests: {
                                sent: Array.from(friendships.get(username)?.sentRequests || []),
                                received: Array.from(friendships.get(username)?.receivedRequests || [])
                            }
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
                        timestamp: new Date().toISOString(),
                        messageId: message.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
                    const msgSender = clientInfo5.username;
                    
                    // Check if users are friends
                    const senderFriendship = friendships.get(msgSender);
                    if (!senderFriendship || !senderFriendship.friends.has(recipient)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: `You must be friends with ${recipient} to send private messages`
                        }));
                        break;
                    }
                    
                    const privateContent = message.content;
                    
                    // Retry logic for message delivery (with setTimeout for delayed retries)
                    const privateMsg = {
                        type: 'private_message',
                        from: msgSender,
                        content: privateContent,
                        timestamp: new Date().toISOString(),
                        messageId: message.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    };
                    
                    let retries = 3;
                    let privateDelivered = false;
                    
                    const attemptDelivery = () => {
                        privateDelivered = sendToClient(recipient, privateMsg);
                        
                        if (privateDelivered) {
                            socket.send(JSON.stringify({
                                type: 'private_message_sent',
                                to: recipient,
                                messageId: privateMsg.messageId,
                                timestamp: new Date().toISOString()
                            }));
                            
                            // Send delivered status
                            setTimeout(() => {
                                socket.send(JSON.stringify({
                                    type: 'message_delivered',
                                    messageId: privateMsg.messageId
                                }));
                            }, 500);
                            
                            logMessage('private', msgSender, recipient, privateContent);
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
                
                case 'typing':
                    const clientInfo6 = clients.get(socket);
                    if (!clientInfo6) break;
                    
                    const typingChatKey = message.chatKey;
                    const typingGroupId = typingChatKey?.startsWith('group:') ? typingChatKey.split(':')[1] : null;
                    const typingRecipient = typingChatKey?.startsWith('private:') ? typingChatKey.split(':')[1] : null;
                    
                    if (typingGroupId && clientInfo6.joinedGroups.has(typingGroupId)) {
                        // Broadcast typing indicator to group
                        broadcastToGroup(typingGroupId, {
                            type: 'typing',
                            chatKey: typingChatKey,
                            username: clientInfo6.username,
                            isTyping: message.isTyping
                        }, socket);
                    } else if (typingRecipient) {
                        // Send typing indicator to private chat recipient
                        sendToClient(typingRecipient, {
                            type: 'typing',
                            chatKey: typingChatKey,
                            username: clientInfo6.username,
                            isTyping: message.isTyping
                        });
                    }
                    break;
                
                case 'message_read':
                    const clientInfo7 = clients.get(socket);
                    if (!clientInfo7) break;
                    
                    // Notify sender that message was read
                    const readFrom = message.from;
                    if (readFrom) {
                        sendToClient(readFrom, {
                            type: 'message_read',
                            messageId: message.messageId,
                            readBy: clientInfo7.username
                        });
                    }
                    break;
                
                case 'send_friend_request':
                    const clientInfo8 = clients.get(socket);
                    if (!clientInfo8) break;
                    
                    const targetUser = message.to;
                    const sender = clientInfo8.username;
                    
                    if (targetUser === sender) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Cannot send friend request to yourself'
                        }));
                        break;
                    }
                    
                    // Initialize friendship data if needed
                    if (!friendships.has(sender)) {
                        friendships.set(sender, { friends: new Set(), sentRequests: new Set(), receivedRequests: new Set() });
                    }
                    if (!friendships.has(targetUser)) {
                        friendships.set(targetUser, { friends: new Set(), sentRequests: new Set(), receivedRequests: new Set() });
                    }
                    
                    const senderData = friendships.get(sender);
                    const targetData = friendships.get(targetUser);
                    
                    // Check if already friends
                    if (senderData.friends.has(targetUser)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: `${targetUser} is already your friend`
                        }));
                        break;
                    }
                    
                    // Check if request already sent
                    if (senderData.sentRequests.has(targetUser)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Friend request already sent'
                        }));
                        break;
                    }
                    
                    // Add to sent/received requests
                    senderData.sentRequests.add(targetUser);
                    targetData.receivedRequests.add(sender);
                    
                    // Notify recipient
                    sendToClient(targetUser, {
                        type: 'friend_request_received',
                        from: sender
                    });
                    
                    // Confirm to sender
                    socket.send(JSON.stringify({
                        type: 'friend_request_sent',
                        to: targetUser
                    }));
                    break;
                
                case 'accept_friend_request':
                    const clientInfo9 = clients.get(socket);
                    if (!clientInfo9) break;
                    
                    const requester = message.from;
                    const accepter = clientInfo9.username;
                    
                    if (!friendships.has(requester) || !friendships.has(accepter)) break;
                    
                    const requesterData = friendships.get(requester);
                    const accepterData = friendships.get(accepter);
                    
                    // Check if request exists
                    if (!accepterData.receivedRequests.has(requester)) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Friend request not found'
                        }));
                        break;
                    }
                    
                    // Remove from requests
                    accepterData.receivedRequests.delete(requester);
                    requesterData.sentRequests.delete(accepter);
                    
                    // Add to friends
                    accepterData.friends.add(requester);
                    requesterData.friends.add(accepter);
                    
                    // Notify both users
                    socket.send(JSON.stringify({
                        type: 'friend_request_accepted',
                        from: requester,
                        friends: Array.from(accepterData.friends)
                    }));
                    
                    sendToClient(requester, {
                        type: 'friend_request_accepted',
                        from: accepter,
                        friends: Array.from(requesterData.friends)
                    });
                    break;
                
                case 'decline_friend_request':
                    const clientInfo10 = clients.get(socket);
                    if (!clientInfo10) break;
                    
                    const decliner = clientInfo10.username;
                    const requestSender = message.from;
                    
                    if (!friendships.has(requestSender) || !friendships.has(decliner)) break;
                    
                    const requestSenderData = friendships.get(requestSender);
                    const declinerData = friendships.get(decliner);
                    
                    // Remove from requests
                    declinerData.receivedRequests.delete(requestSender);
                    requestSenderData.sentRequests.delete(decliner);
                    
                    socket.send(JSON.stringify({
                        type: 'friend_request_declined',
                        from: requestSender,
                        friendRequests: {
                            sent: Array.from(declinerData.sentRequests),
                            received: Array.from(declinerData.receivedRequests)
                        }
                    }));
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
    console.log(`ZooRoom Server running on port ${PORT}`);
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

