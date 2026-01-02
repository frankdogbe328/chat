// WebSocket connection
let ws = null;
let currentUsername = null;
let currentChat = null; // { type: 'group' | 'private', id: string }
let joinedGroups = new Set();
let onlineUsers = [];
let allGroups = [];
let wsReady = false; // Track if WebSocket is ready to send
let chatHistory = {}; // Store chat history { 'private:username': [...], 'group:groupId': [...] }

// Initialize connection when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Allow Enter key to login
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
    
    // Allow Enter key to send message
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Allow Enter key to create group
    const newGroupInput = document.getElementById('newGroupInput');
    if (newGroupInput) {
        newGroupInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createGroup();
            }
        });
    }

    // Close sidebar when clicking outside on mobile
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        overlay.addEventListener('click', () => {
            toggleSidebar();
        });
    }
});

// Toggle sidebar on mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
}

// Close sidebar when selecting item on mobile
function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar && overlay) {
            // Force close sidebar
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        }
    }
}

// Handle login
function handleLogin() {
    const usernameInput = document.getElementById('usernameInput');
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    // Connect to WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        wsReady = true;
        // Register user
        ws.send(JSON.stringify({
            type: 'register',
            username: username
        }));
    };
    
    ws.onclose = () => {
        wsReady = false;
    };
    
    ws.onerror = () => {
        wsReady = false;
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        alert('Connection error. Please check if the server is running.');
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Show login screen again
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
        currentUsername = null;
        currentChat = null;
        joinedGroups.clear();
        
        // Clear connection
        ws = null;
    };
    
    // Start heartbeat
    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
    }, 30000); // Send heartbeat every 30 seconds
}

// Handle logout
function handleLogout() {
    if (ws) {
        ws.close();
    }
}

// Handle messages from server
function handleServerMessage(message) {
    switch (message.type) {
        case 'registered':
            currentUsername = message.username;
            document.getElementById('currentUsername').textContent = `Logged in as: ${message.username}`;
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('appSection').classList.remove('hidden');
            break;
        
        case 'register_error':
            alert(message.message);
            if (ws) {
                ws.close();
            }
            break;
        
        case 'initial_data':
            allGroups = message.groups || [];
            onlineUsers = message.users || [];
            updateGroupsList();
            updateUsersList();
            break;
        
        case 'group_list_update':
            allGroups = message.groups || [];
            updateGroupsList();
            break;
        
        case 'user_list_update':
            onlineUsers = message.users || [];
            updateUsersList();
            break;
        
        case 'group_created':
            joinedGroups.add(message.groupId);
            showSystemMessage(`You created group "${message.groupId}"`);
            break;
        
        case 'group_joined':
            joinedGroups.add(message.groupId);
            showSystemMessage(`You joined group "${message.groupId}"`);
            break;
        
        case 'group_left':
            joinedGroups.delete(message.groupId);
            if (currentChat && currentChat.type === 'group' && currentChat.id === message.groupId) {
                currentChat = null;
                updateChatView();
            }
            showSystemMessage(`You left group "${message.groupId}"`);
            break;
        
        case 'member_joined':
            if (currentChat && currentChat.type === 'group' && currentChat.id === message.groupId) {
                showSystemMessage(`${message.username} joined the group`, message.groupId);
            }
            break;
        
        case 'member_left':
            if (currentChat && currentChat.type === 'group' && currentChat.id === message.groupId) {
                showSystemMessage(`${message.username} left the group`, message.groupId);
            }
            break;
        
        case 'group_message':
            const groupChatKey = 'group:' + message.groupId;
            // Save to history
            if (!chatHistory[groupChatKey]) {
                chatHistory[groupChatKey] = [];
            }
            chatHistory[groupChatKey].push({
                type: 'group',
                from: message.from,
                content: message.content,
                timestamp: message.timestamp,
                received: message.from !== currentUsername
            });
            
            if (currentChat && currentChat.type === 'group' && currentChat.id === message.groupId) {
                addMessageToChat('group', message.from, message.content, message.timestamp, message.from !== currentUsername);
            }
            break;
        
        case 'private_message':
            const privateChatKey = 'private:' + message.from;
            // Save to history
            if (!chatHistory[privateChatKey]) {
                chatHistory[privateChatKey] = [];
            }
            chatHistory[privateChatKey].push({
                type: 'private',
                from: message.from,
                content: message.content,
                timestamp: message.timestamp,
                received: true
            });
            
            // Show private message in chat if we're chatting with this user
            if (currentChat && currentChat.type === 'private' && currentChat.id === message.from) {
                addMessageToChat('private', message.from, message.content, message.timestamp, true);
            } else {
                // Show notification
                showSystemMessage(`Private message from ${message.from}`, null, true);
                // Update UI to show there's a message waiting
                updateUsersList();
            }
            break;
        
        case 'private_message_sent':
            // Message was successfully sent, already saved in sendMessage function
            break;
        
        case 'error':
            showErrorMessage(message.message);
            break;
        
        case 'heartbeat_ack':
            // Heartbeat acknowledged, connection is alive
            break;
    }
}

// Create a new group
function createGroup() {
    const groupInput = document.getElementById('newGroupInput');
    const groupName = groupInput.value.trim();
    
    if (!groupName) {
        alert('Please enter a group name');
        return;
    }
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'create_group',
        groupId: groupName
    }));
    
    groupInput.value = '';
    // Close sidebar on mobile after creating group
    if (window.innerWidth <= 768) {
        setTimeout(closeSidebarOnMobile, 300);
    }
}

// Join a group
function joinGroup(groupId) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server');
        return;
    }
    
    if (joinedGroups.has(groupId)) {
        // Already joined, just switch to this group
        selectGroup(groupId);
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'join_group',
        groupId: groupId
    }));
    
    // Switch to this group after a short delay (will be updated by server response)
    setTimeout(() => {
        if (joinedGroups.has(groupId)) {
            selectGroup(groupId);
            // selectGroup will handle closing sidebar
        } else {
            // If join failed or still joining, close sidebar anyway on mobile
            closeSidebarOnMobile();
        }
    }, 200);
}

// Leave current group
function leaveCurrentGroup() {
    if (!currentChat || currentChat.type !== 'group') {
        return;
    }
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'leave_group',
        groupId: currentChat.id
    }));
    
    currentChat = null;
    updateChatView();
}

// Select a group for chatting
function selectGroup(groupId) {
    if (!joinedGroups.has(groupId)) {
        joinGroup(groupId);
        return;
    }
    
    currentChat = {
        type: 'group',
        id: groupId
    };
    updateChatView();
    // Close sidebar immediately on mobile
    setTimeout(() => {
        closeSidebarOnMobile();
    }, 100);
}

// Select a user for private messaging
function selectUser(username) {
    if (username === currentUsername) {
        alert('Cannot send private message to yourself');
        return;
    }
    
    currentChat = {
        type: 'private',
        id: username,
        recipient: username
    };
    updateChatView();
    // Close sidebar immediately on mobile
    setTimeout(() => {
        closeSidebarOnMobile();
    }, 100);
}

// Send message (group or private)
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content) {
        return;
    }
    
    if (!currentChat) {
        alert('Please select a group or user to send a message');
        return;
    }
    
    // Wait for WebSocket to be ready
    if (!ws || ws.readyState !== WebSocket.OPEN || !wsReady) {
        alert('Not connected to server. Please wait...');
        // Try to reconnect or wait
        setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN && wsReady) {
                sendMessage(); // Retry
            }
        }, 500);
        return;
    }
    
    const timestamp = new Date().toISOString();
    const chatKey = currentChat.type + ':' + currentChat.id;
    
    // Save to history
    if (!chatHistory[chatKey]) {
        chatHistory[chatKey] = [];
    }
    chatHistory[chatKey].push({
        type: currentChat.type,
        from: currentUsername,
        content: content,
        timestamp: timestamp,
        received: false
    });
    
    if (currentChat.type === 'group') {
        ws.send(JSON.stringify({
            type: 'group_message',
            groupId: currentChat.id,
            content: content
        }));
        
        // Add message to chat immediately
        addMessageToChat('group', currentUsername, content, timestamp, false);
    } else if (currentChat.type === 'private') {
        ws.send(JSON.stringify({
            type: 'private_message',
            to: currentChat.id,
            content: content
        }));
        
        // Add message to chat immediately
        addMessageToChat('private', currentUsername, content, timestamp, false);
    }
    
    messageInput.value = '';
}

// Update groups list
function updateGroupsList() {
    const groupsList = document.getElementById('groupsList');
    groupsList.innerHTML = '';
    
    if (allGroups.length === 0) {
        groupsList.innerHTML = '<div class="list-item"><div class="item-info">No groups available</div></div>';
        return;
    }
    
    allGroups.forEach(group => {
        const item = document.createElement('div');
        item.className = 'list-item';
        if (currentChat && currentChat.type === 'group' && currentChat.id === group.groupId) {
            item.classList.add('active');
        }
        
        if (joinedGroups.has(group.groupId)) {
            item.innerHTML = `
                <div class="item-name">${escapeHtml(group.groupId)}</div>
                <div class="item-info">${group.memberCount} member(s) - You are a member</div>
            `;
            item.onclick = () => {
                selectGroup(group.groupId);
                // closeSidebarOnMobile is called inside selectGroup
            };
        } else {
            item.innerHTML = `
                <div class="item-name">${escapeHtml(group.groupId)}</div>
                <div class="item-info">${group.memberCount} member(s) - Click to join</div>
            `;
            item.onclick = () => {
                joinGroup(group.groupId);
                // Sidebar will close after group is joined
            };
        }
        
        groupsList.appendChild(item);
    });
}

// Update users list
function updateUsersList() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';
    
    const filteredUsers = onlineUsers.filter(user => user !== currentUsername);
    
    if (filteredUsers.length === 0) {
        usersList.innerHTML = '<div class="list-item"><div class="item-info">No other users online</div></div>';
        return;
    }
    
    filteredUsers.forEach(user => {
        const item = document.createElement('div');
        item.className = 'list-item';
        if (currentChat && currentChat.type === 'private' && currentChat.id === user) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="item-name">${escapeHtml(user)}</div>
            <div class="item-info">Click to send private message</div>
        `;
        item.onclick = () => {
            selectUser(user);
            // closeSidebarOnMobile is called inside selectUser
        };
        
        usersList.appendChild(item);
    });
}

// Go to home screen
function goToHome() {
    currentChat = null;
    updateChatView();
    closeSidebarOnMobile();
}

// Update chat view
function updateChatView() {
    const chatTitle = document.getElementById('chatTitle');
    const messageInputSection = document.getElementById('messageInputSection');
    const chatActions = document.getElementById('chatActions');
    const messageTypeInfo = document.getElementById('messageTypeInfo');
    const messagesContainer = document.getElementById('messagesContainer');
    
    if (!currentChat) {
        chatTitle.textContent = 'Select a group or user to start chatting';
        messageInputSection.classList.add('hidden');
        chatActions.classList.add('hidden');
        
        // Show recent chats
        showRecentChats();
        return;
    }
    
    messageInputSection.classList.remove('hidden');
    
    const chatKey = currentChat.type + ':' + currentChat.id;
    
    if (currentChat.type === 'group') {
        chatTitle.textContent = `Group: ${currentChat.id}`;
        chatActions.classList.remove('hidden');
        messageTypeInfo.textContent = `Sending group message to all members of "${currentChat.id}"`;
        
        // Load and show chat history
        messagesContainer.innerHTML = '';
        if (chatHistory[chatKey] && chatHistory[chatKey].length > 0) {
            chatHistory[chatKey].forEach(msg => {
                addMessageToChat(msg.type, msg.from, msg.content, msg.timestamp, msg.received);
            });
        }
    } else if (currentChat.type === 'private') {
        chatTitle.textContent = `Private Chat: ${currentChat.id}`;
        chatActions.classList.add('hidden');
        messageTypeInfo.textContent = `Private message to ${currentChat.id}`;
        
        // Load and show chat history
        messagesContainer.innerHTML = '';
        if (chatHistory[chatKey] && chatHistory[chatKey].length > 0) {
            chatHistory[chatKey].forEach(msg => {
                addMessageToChat(msg.type, msg.from, msg.content, msg.timestamp, msg.received);
            });
        }
    }
    
    // Focus on message input
    setTimeout(() => {
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    }, 100);
}

// Show recent chats on home screen
function showRecentChats() {
    const messagesContainer = document.getElementById('messagesContainer');
    const chatKeys = Object.keys(chatHistory);
    
    if (chatKeys.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <p>Welcome to ZooRoom!</p>
                <p>• Create or join a group to send group messages</p>
                <p>• Click on a user's name to chat privately</p>
                <p>• All messages are logged and tracked</p>
            </div>
        `;
        return;
    }
    
    // Sort chats by most recent message
    const sortedChats = chatKeys.map(key => {
        const messages = chatHistory[key];
        const lastMessage = messages[messages.length - 1];
        return { key, lastMessage, messages };
    }).sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
    
    let html = '<div class="recent-chats">';
    html += '<h3 style="padding: 15px; color: #667eea; border-bottom: 1px solid #e0e0e0;">Recent Chats</h3>';
    
    sortedChats.forEach(({ key, lastMessage, messages }) => {
        const [type, id] = key.split(':');
        const lastMsgText = lastMessage.content.length > 30 
            ? lastMessage.content.substring(0, 30) + '...' 
            : lastMessage.content;
        const time = new Date(lastMessage.timestamp).toLocaleTimeString();
        const unreadCount = messages.filter(m => m.received && !m.read).length;
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
        
        html += `
            <div class="recent-chat-item" onclick="openRecentChat('${type}', '${id}')">
                <div class="recent-chat-info">
                    <div class="recent-chat-name">
                        ${type === 'group' ? '👥' : '👤'} ${escapeHtml(id)}
                        ${unreadBadge}
                    </div>
                    <div class="recent-chat-preview">${escapeHtml(lastMsgText)}</div>
                    <div class="recent-chat-time">${time}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    messagesContainer.innerHTML = html;
}

// Open a recent chat
function openRecentChat(type, id) {
    if (type === 'group') {
        if (joinedGroups.has(id)) {
            selectGroup(id);
        } else {
            joinGroup(id);
        }
    } else {
        selectUser(id);
    }
}

// Add message to chat
function addMessageToChat(type, from, content, timestamp, received = true) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} ${received ? 'received' : 'sent'}`;
    
    const time = new Date(timestamp).toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span>${escapeHtml(from)}</span>
            <span>${time}</span>
        </div>
        <div class="message-content">${escapeHtml(content)}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show system message
function showSystemMessage(message, groupId = null, isNotification = false) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    // Only show in current chat if it matches
    if (currentChat) {
        if (groupId && currentChat.type !== 'group' || currentChat.id !== groupId) {
            if (!isNotification) return;
        }
    } else if (!isNotification) {
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    const time = new Date().toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(message)}</div>
        <div class="message-timestamp">${time}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show error message
function showErrorMessage(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    messagesContainer.appendChild(errorDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Remove error message after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

