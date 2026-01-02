// WebSocket connection
let ws = null;
let currentUsername = null;
let currentChat = null; // { type: 'group' | 'private', id: string }
let joinedGroups = new Set();
let onlineUsers = [];
let allGroups = [];
let wsReady = false; // Track if WebSocket is ready to send
let chatHistory = {}; // Store chat history { 'private:username': [...], 'group:groupId': [...] }
let favorites = new Set(); // Store favorite chats
let typingUsers = {}; // Track who is typing { 'chatKey': Set of usernames }
let messageStatuses = {}; // Track message status { 'messageId': 'sent'|'delivered'|'read' }
let unreadCounts = {}; // Track unread counts { 'chatKey': count }
let sidebarTab = 'all'; // Current sidebar tab: 'all', 'unread', 'favorites', 'groups'
let typingTimeout = null; // Timeout for typing indicator
let friends = new Set(); // Store friends list
let friendRequests = { sent: new Set(), received: new Set() }; // Friend requests
let allRegisteredUsers = []; // Store all registered users (online and offline)

// Define handleLogin immediately to ensure it's always available
window.handleLogin = function() {
    const usernameInput = document.getElementById('usernameInput');
    const username = usernameInput ? usernameInput.value.trim() : '';
    
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
    
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (typeof handleServerMessage === 'function') {
                handleServerMessage(message);
            }
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        wsReady = false;
        alert('Connection error. Please check if the server is running.');
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        wsReady = false;
        // Only show login screen if we were logged in
        if (currentUsername) {
            const loginSection = document.getElementById('loginSection');
            const appSection = document.getElementById('appSection');
            if (loginSection) loginSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            currentUsername = null;
            currentChat = null;
            joinedGroups.clear();
        }
        // Clear connection
        ws = null;
    };
    
    // Start heartbeat (only if not already started)
    if (!window.heartbeatInterval) {
        window.heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'heartbeat' }));
            }
        }, 30000); // Send heartbeat every 30 seconds
    }
};

// Initialize connection when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Load favorites from localStorage
    loadFavorites();
    
    // Setup login button click handler as backup
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (typeof window.handleLogin === 'function') {
                window.handleLogin();
            } else {
                console.error('handleLogin function not found');
                alert('Login function not loaded. Please refresh the page.');
            }
        });
    }
    
    // Allow Enter key to login
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (typeof window.handleLogin === 'function') {
                    window.handleLogin();
                }
            }
        });
    }
    
    // Allow Enter key to send message and handle typing indicator
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            } else {
                handleTyping();
            }
        });
        messageInput.addEventListener('input', () => {
            handleTyping();
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

// Toggle sidebar on mobile - Make globally accessible
window.toggleSidebar = function() {
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
            // Initialize sidebar to show all chats
            setTimeout(() => {
                switchSidebarTab('all');
            }, 100);
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
            const groupMessageId = message.messageId || generateMessageId();
            const isReceived = message.from !== currentUsername;
            
            // Save to history
            if (!chatHistory[groupChatKey]) {
                chatHistory[groupChatKey] = [];
            }
            chatHistory[groupChatKey].push({
                type: 'group',
                from: message.from,
                content: message.content,
                timestamp: message.timestamp,
                received: isReceived,
                messageId: groupMessageId
            });
            
            // Increment unread if not current chat
            if (isReceived && (!currentChat || getChatKey(currentChat) !== groupChatKey)) {
                unreadCounts[groupChatKey] = (unreadCounts[groupChatKey] || 0) + 1;
                updateAllChatLists();
            }
            
            if (currentChat && currentChat.type === 'group' && currentChat.id === message.groupId) {
                addMessageToChat('group', message.from, message.content, message.timestamp, isReceived, groupMessageId);
            }
            break;
        
        case 'private_message':
            // Only process if from a friend
            if (!friends.has(message.from)) {
                console.log('Ignoring message from non-friend:', message.from);
                break;
            }
            
            const privateChatKey = 'private:' + message.from;
            const privateMessageId = message.messageId || generateMessageId();
            
            // Save to history
            if (!chatHistory[privateChatKey]) {
                chatHistory[privateChatKey] = [];
            }
            chatHistory[privateChatKey].push({
                type: 'private',
                from: message.from,
                content: message.content,
                timestamp: message.timestamp,
                received: true,
                messageId: privateMessageId
            });
            
            // Increment unread if not current chat
            if (!currentChat || getChatKey(currentChat) !== privateChatKey) {
                unreadCounts[privateChatKey] = (unreadCounts[privateChatKey] || 0) + 1;
                updateAllChatLists();
            }
            
            // Show private message in chat if we're chatting with this user
            if (currentChat && currentChat.type === 'private' && currentChat.id === message.from) {
                addMessageToChat('private', message.from, message.content, message.timestamp, true, privateMessageId);
            } else {
                // Show notification
                showSystemMessage(`Private message from ${message.from}`, null, true);
                // Update UI to show there's a message waiting
                updateAllChatLists();
            }
            
            // Send read receipt
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'message_read',
                    messageId: privateMessageId,
                    from: message.from
                }));
            }
            break;
        
        case 'friend_request_sent':
            friendRequests.sent.add(message.to);
            updateAllChatLists();
            if (typeof showSystemMessage === 'function') {
                showSystemMessage(`Friend request sent to ${message.to}`);
            }
            break;
        
        case 'friend_request_received':
            friendRequests.received.add(message.from);
            if (typeof updateFriendRequestsList === 'function') {
                updateFriendRequestsList();
            }
            if (typeof updateRequestsBadge === 'function') {
                updateRequestsBadge();
            }
            updateAllChatLists();
            if (typeof showSystemMessage === 'function') {
                showSystemMessage(`${message.from} sent you a friend request`);
            }
            break;
        
        case 'friend_request_accepted':
            friends.add(message.from);
            friendRequests.sent.delete(message.from);
            friendRequests.received.delete(message.from);
            if (message.friends) {
                friends = new Set(message.friends);
            }
            if (typeof updateFriendRequestsList === 'function') {
                updateFriendRequestsList();
            }
            if (typeof updateRequestsBadge === 'function') {
                updateRequestsBadge();
            }
            updateAllChatLists();
            if (typeof showSystemMessage === 'function') {
                showSystemMessage(`${message.from} accepted your friend request`);
            }
            break;
        
        case 'friend_request_declined':
            friendRequests.sent.delete(message.from);
            if (message.friendRequests) {
                friendRequests.sent = new Set(message.friendRequests.sent || []);
                friendRequests.received = new Set(message.friendRequests.received || []);
            }
            if (typeof updateFriendRequestsList === 'function') {
                updateFriendRequestsList();
            }
            if (typeof updateRequestsBadge === 'function') {
                updateRequestsBadge();
            }
            updateAllChatLists();
            break;
        
        case 'typing':
            const typingChatKey = message.chatKey;
            if (message.isTyping) {
                showTypingIndicator(typingChatKey, message.username);
            } else {
                hideTypingIndicator(typingChatKey, message.username);
            }
            break;
        
        case 'message_delivered':
            if (message.messageId) {
                updateMessageStatus(message.messageId, 'delivered');
            }
            break;
        
        case 'message_read':
            if (message.messageId) {
                updateMessageStatus(message.messageId, 'read');
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

// Create a new group - Make globally accessible
window.createGroup = function() {
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

// Leave current group - Make globally accessible
window.leaveCurrentGroup = function() {
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
    
    // Check if user is a friend
    if (!friends.has(username)) {
        alert(`You must be friends with ${username} to send messages. Send a friend request first.`);
        return;
    }
    
    // Check if user is online
    if (!onlineUsers.includes(username)) {
        alert(`User "${username}" is not online`);
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
    const chatKey = getChatKey(currentChat);
    const messageId = generateMessageId();
    
    // Save to history
    if (!chatHistory[chatKey]) {
        chatHistory[chatKey] = [];
    }
    const messageData = {
        type: currentChat.type,
        from: currentUsername,
        content: content,
        timestamp: timestamp,
        received: false,
        messageId: messageId,
        status: 'sending'
    };
    chatHistory[chatKey].push(messageData);
    messageStatuses[messageId] = 'sending';
    
    if (currentChat.type === 'group') {
        ws.send(JSON.stringify({
            type: 'group_message',
            groupId: currentChat.id,
            content: content,
            messageId: messageId
        }));
        
        // Add message to chat immediately with status
        addMessageToChat('group', currentUsername, content, timestamp, false, messageId);
        // Mark as sent
        setTimeout(() => {
            updateMessageStatus(messageId, 'sent');
            messageData.status = 'sent';
        }, 100);
    } else if (currentChat.type === 'private') {
        ws.send(JSON.stringify({
            type: 'private_message',
            to: currentChat.id,
            content: content,
            messageId: messageId
        }));
        
        // Add message to chat immediately with status
        addMessageToChat('private', currentUsername, content, timestamp, false, messageId);
        // Mark as sent
        setTimeout(() => {
            updateMessageStatus(messageId, 'sent');
            messageData.status = 'sent';
        }, 100);
    }
    
    // Update chat lists
    updateAllChatLists();
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
        
        const chatKey = 'group:' + group.groupId;
        const unreadCount = unreadCounts[chatKey] || 0;
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
        const favoriteIcon = favorites.has(chatKey) ? '⭐' : '';
        
        if (joinedGroups.has(group.groupId)) {
            item.innerHTML = `
                ${getProfilePicture(group.groupId)}
                <div class="item-content">
                    <div class="item-header">
                        <div class="item-name">👥 ${escapeHtml(group.groupId)} ${favoriteIcon}</div>
                        ${unreadBadge}
                    </div>
                    <div class="item-info">${group.memberCount} member(s) - You are a member</div>
                </div>
            `;
            item.onclick = () => {
                selectGroup(group.groupId);
            };
        } else {
            item.innerHTML = `
                ${getProfilePicture(group.groupId)}
                <div class="item-content">
                    <div class="item-name">👥 ${escapeHtml(group.groupId)}</div>
                    <div class="item-info">${group.memberCount} member(s) - Click to join</div>
                </div>
            `;
            item.onclick = () => {
                joinGroup(group.groupId);
            };
        }
        
        groupsList.appendChild(item);
    });
}

// Update users list (for direct messaging/contacts)
function updateUsersList() {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
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
        
        const chatKey = 'private:' + user;
        const unreadCount = unreadCounts[chatKey] || 0;
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
        
        item.innerHTML = `
            ${getProfilePicture(user)}
            <div class="item-content">
                <div class="item-header">
                    <div class="item-name">👤 ${escapeHtml(user)} <span class="online-dot"></span></div>
                    ${unreadBadge}
                </div>
                <div class="item-info">Click to send private message</div>
            </div>
        `;
        item.onclick = () => {
            selectUser(user);
        };
        
        usersList.appendChild(item);
    });
}

// Go to home screen
window.goToHome = function() {
    currentChat = null;
    updateChatView();
    closeSidebarOnMobile();
};

// Switch sidebar tab - Define here to ensure it's always available globally
window.switchSidebarTab = function(tab) {
    sidebarTab = tab;
    console.log('Switching to tab:', tab);
    
    // Clear search when switching tabs
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });
    
    // Hide all tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Show selected panel and update content
    if (tab === 'all') {
        const panel = document.getElementById('allChatsPanel');
        if (panel) {
            panel.classList.add('active');
            if (typeof updateAllChatsList === 'function') {
                updateAllChatsList();
            }
        }
    } else if (tab === 'unread') {
        const panel = document.getElementById('unreadChatsPanel');
        if (panel) {
            panel.classList.add('active');
            if (typeof updateUnreadChatsList === 'function') {
                updateUnreadChatsList();
            }
        }
    } else if (tab === 'requests') {
        const panel = document.getElementById('requestsPanel');
        if (panel) {
            panel.classList.add('active');
            if (typeof updateFriendRequestsList === 'function') {
                updateFriendRequestsList();
            }
        }
    } else if (tab === 'favorites') {
        const panel = document.getElementById('favoritesPanel');
        if (panel) {
            panel.classList.add('active');
            if (typeof updateFavoritesList === 'function') {
                updateFavoritesList();
            }
        }
    } else if (tab === 'groups') {
        const panel = document.getElementById('groupsPanel');
        if (panel) {
            panel.classList.add('active');
            updateGroupsList();
        }
    }
};

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
    
        const chatKey = getChatKey(currentChat);
        
        // Mark chat as read when opening
        markChatAsRead(chatKey);
        
        if (currentChat.type === 'group') {
            chatTitle.textContent = `Group: ${currentChat.id}`;
            chatActions.classList.remove('hidden');
            messageTypeInfo.textContent = `Sending group message to all members of "${currentChat.id}"`;
            
            // Load and show chat history
            messagesContainer.innerHTML = '';
            if (chatHistory[chatKey] && chatHistory[chatKey].length > 0) {
                chatHistory[chatKey].forEach(msg => {
                    addMessageToChat(msg.type, msg.from, msg.content, msg.timestamp, msg.received, msg.messageId);
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
                    addMessageToChat(msg.type, msg.from, msg.content, msg.timestamp, msg.received, msg.messageId);
                });
            }
        }
        
        // Update typing indicator for this chat
        updateTypingIndicatorUI(chatKey);
    
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
                <p>• Use the sidebar tabs to navigate (All, Unread, Favorites, Groups)</p>
                <p>• All messages are logged and tracked</p>
            </div>
        `;
        return;
    }
    
    // Use the same rendering as the sidebar
    updateAllChatsList();
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <p>Your chats are shown in the sidebar</p>
            <p>Use the tabs: All, Unread, Favorites, Groups</p>
        </div>
    `;
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

