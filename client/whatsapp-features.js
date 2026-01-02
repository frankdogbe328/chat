// WhatsApp-like Features
// This file contains functions for message status, typing indicators, profile pictures, etc.

// Generate profile picture/avatar based on username - Make globally accessible
window.getProfilePicture = function(username) {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'];
    const color = colors[username.charCodeAt(0) % colors.length];
    const initial = username.charAt(0).toUpperCase();
    
    // Create SVG avatar
    return `<div class="avatar" style="background-color: ${color};">
        <span>${initial}</span>
    </div>`;
};

// Generate unique message ID - Make globally accessible
window.generateMessageId = function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Update message status
function updateMessageStatus(messageId, status) {
    if (messageStatuses[messageId]) {
        messageStatuses[messageId] = status;
        updateMessageStatusUI(messageId, status);
    }
}

// Update message status in UI
function updateMessageStatusUI(messageId, status) {
    const statusElement = document.querySelector(`[data-message-id="${messageId}"] .message-status`);
    if (statusElement) {
        let icon = '';
        if (status === 'sent') {
            icon = '✓';
        } else if (status === 'delivered') {
            icon = '✓✓';
        } else if (status === 'read') {
            icon = '✓✓';
            statusElement.style.color = '#4fc3f7';
        }
        statusElement.textContent = icon;
    }
}

// Show typing indicator
function showTypingIndicator(chatKey, username) {
    if (!typingUsers[chatKey]) {
        typingUsers[chatKey] = new Set();
    }
    typingUsers[chatKey].add(username);
    
    if (currentChat && getChatKey(currentChat) === chatKey) {
        updateTypingIndicatorUI(chatKey);
    }
}

// Hide typing indicator
function hideTypingIndicator(chatKey, username) {
    if (typingUsers[chatKey]) {
        typingUsers[chatKey].delete(username);
        if (typingUsers[chatKey].size === 0) {
            delete typingUsers[chatKey];
        }
    }
    
    if (currentChat && getChatKey(currentChat) === chatKey) {
        updateTypingIndicatorUI(chatKey);
    }
}

// Update typing indicator UI
function updateTypingIndicatorUI(chatKey) {
    const container = document.getElementById('messagesContainer');
    let typingDiv = document.getElementById('typingIndicator');
    
    if (!typingUsers[chatKey] || typingUsers[chatKey].size === 0) {
        if (typingDiv) {
            typingDiv.remove();
        }
        return;
    }
    
    const users = Array.from(typingUsers[chatKey]);
    const names = users.join(', ');
    const text = users.length === 1 ? `${names} is typing...` : `${names} are typing...`;
    
    if (!typingDiv) {
        typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'typing-indicator';
        container.appendChild(typingDiv);
    }
    
    typingDiv.innerHTML = `
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
        <span class="typing-text">${escapeHtml(text)}</span>
    `;
    
    container.scrollTop = container.scrollHeight;
}

// Get chat key for a chat object - Make globally accessible
window.getChatKey = function(chat) {
    if (!chat) return null;
    return chat.type + ':' + chat.id;
};

// Toggle favorite - Make globally accessible
window.toggleFavorite = function(chatKey) {
    if (favorites.has(chatKey)) {
        favorites.delete(chatKey);
    } else {
        favorites.add(chatKey);
    }
    saveFavorites();
    updateAllChatLists();
};

// Save favorites to localStorage
function saveFavorites() {
    localStorage.setItem('zooroom_favorites', JSON.stringify(Array.from(favorites)));
}

// Load favorites from localStorage
function loadFavorites() {
    const saved = localStorage.getItem('zooroom_favorites');
    if (saved) {
        favorites = new Set(JSON.parse(saved));
    }
}

// Switch sidebar tab - Make sure this function is accessible globally
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
            updateAllChatsList();
        } else {
            console.error('allChatsPanel not found');
        }
    } else if (tab === 'unread') {
        const panel = document.getElementById('unreadChatsPanel');
        if (panel) {
            panel.classList.add('active');
            updateUnreadChatsList();
        }
    } else if (tab === 'requests') {
        const panel = document.getElementById('requestsPanel');
        if (panel) {
            panel.classList.add('active');
            updateFriendRequestsList();
        }
    } else if (tab === 'favorites') {
        const panel = document.getElementById('favoritesPanel');
        if (panel) {
            panel.classList.add('active');
            updateFavoritesList();
        }
    } else if (tab === 'groups') {
        const panel = document.getElementById('groupsPanel');
        if (panel) {
            panel.classList.add('active');
            updateGroupsList();
        }
    }
};

// Handle search - Make sure this function is accessible globally
window.handleSearch = function() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        // Show normal list based on current tab
        switchSidebarTab(sidebarTab);
        return;
    }
    
    // Search through:
    // 1. Existing chats (chatHistory)
    // 2. Online users
    // 3. All groups
    
    const results = [];
    
    // Search existing chats
    const allChatKeys = Object.keys(chatHistory);
    allChatKeys.forEach(key => {
        const [type, id] = key.split(':');
        if (id.toLowerCase().includes(searchTerm)) {
            results.push({ type: 'chat', key: key, id: id, chatType: type });
        }
    });
    
    // Search online users (even if not in chat history)
    onlineUsers.forEach(user => {
        if (user !== currentUsername && user.toLowerCase().includes(searchTerm)) {
            const chatKey = 'private:' + user;
            const exists = results.some(r => r.key === chatKey);
            if (!exists) {
                results.push({ type: 'user', key: chatKey, id: user, chatType: 'private' });
            }
        }
    });
    
    // Search groups (even if not in chat history)
    allGroups.forEach(group => {
        if (group.groupId.toLowerCase().includes(searchTerm)) {
            const chatKey = 'group:' + group.groupId;
            const exists = results.some(r => r.key === chatKey);
            if (!exists) {
                results.push({ type: 'group', key: chatKey, id: group.groupId, chatType: 'group' });
            }
        }
    });
    
    // Show search results
    showSearchResults(results);
};

// Show search results
function showSearchResults(results) {
    // Always show search results in All Chats panel
    const panel = document.getElementById('allChatsPanel');
    if (!panel) return;
    
    // Hide other panels
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    panel.classList.add('active');
    
    const list = document.getElementById('allChatsList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (results.length === 0) {
        list.innerHTML = '<div class="list-item"><div class="item-info">No results found. Try a different search term.</div></div>';
        return;
    }
    
    results.forEach(result => {
        const { type, key, id, chatType } = result;
        const messages = chatHistory[key] || [];
        const lastMessage = messages[messages.length - 1];
        const hasChatHistory = messages.length > 0;
        
        const item = document.createElement('div');
        item.className = 'list-item';
        if (currentChat && getChatKey(currentChat) === key) {
            item.classList.add('active');
        }
        
        const unreadCount = unreadCounts[key] || 0;
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
        const favoriteIcon = favorites.has(key) ? '⭐' : '';
        const isOnline = chatType === 'private' && (result.online !== undefined ? result.online : onlineUsers.includes(id));
        const onlineIndicator = isOnline ? '<span class="online-dot"></span>' : '';
        const offlineIndicator = !isOnline && chatType === 'private' ? '<span style="color: #999; font-size: 11px;">(offline)</span>' : '';
        
        let preview = '';
        let actionButton = '';
        
        if (hasChatHistory && lastMessage) {
            const previewText = lastMessage.content.length > 30 
                ? lastMessage.content.substring(0, 30) + '...' 
                : lastMessage.content;
            preview = `<div class="item-info">${escapeHtml(previewText)}</div>`;
        } else if (chatType === 'private') {
            const isFriend = friends.has(id);
            const requestSent = friendRequests.sent.has(id);
            const requestReceived = friendRequests.received.has(id);
            
            if (isFriend) {
                preview = `<div class="item-info" style="color: #667eea;">Tap to start chatting</div>`;
            } else if (requestSent) {
                preview = `<div class="item-info" style="color: #999;">Friend request sent</div>`;
            } else if (requestReceived) {
                preview = `<div class="item-info" style="color: #667eea;">Wants to be your friend</div>`;
                actionButton = `
                    <button class="btn-accept" style="font-size: 11px; padding: 4px 8px;" onclick="event.stopPropagation(); acceptFriendRequest('${escapeHtml(id)}')">Accept</button>
                    <button class="btn-decline" style="font-size: 11px; padding: 4px 8px;" onclick="event.stopPropagation(); declineFriendRequest('${escapeHtml(id)}')">Decline</button>
                `;
            } else {
                preview = `<div class="item-info" style="color: #667eea;">Tap to send friend request</div>`;
                actionButton = `<button class="btn-accept" style="font-size: 11px; padding: 4px 8px;" onclick="event.stopPropagation(); sendFriendRequest('${escapeHtml(id)}')">Add Friend</button>`;
            }
        } else if (chatType === 'group') {
            const group = allGroups.find(g => g.groupId === id);
            const memberCount = group ? group.memberCount : 0;
            preview = `<div class="item-info">${memberCount} member(s) - Tap to join</div>`;
        }
        
        const time = hasChatHistory && lastMessage 
            ? new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
        
        item.innerHTML = `
            ${getProfilePicture(id)}
            <div class="item-content">
                <div class="item-header">
                    <div class="item-name">
                        ${chatType === 'group' ? '👥' : '👤'} ${escapeHtml(id)} ${favoriteIcon}
                        ${onlineIndicator} ${offlineIndicator}
                    </div>
                    ${time ? `<div class="item-time">${time}</div>` : ''}
                </div>
                <div class="item-footer">
                    ${preview}
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${unreadBadge}
                        ${actionButton || ''}
                        ${hasChatHistory ? `<button class="favorite-btn" onclick="event.stopPropagation(); toggleFavorite('${key}')">
                            ${favorites.has(key) ? '⭐' : '☆'}
                        </button>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        item.onclick = () => {
            if (chatType === 'group') {
                if (joinedGroups.has(id)) {
                    selectGroup(id);
                } else {
                    joinGroup(id);
                }
            } else {
                // Only allow chatting if friends
                if (friends.has(id)) {
                    selectUser(id);
                } else if (!friendRequests.sent.has(id) && !friendRequests.received.has(id)) {
                    // Send friend request if clicked and not already sent/received
                    sendFriendRequest(id);
                }
            }
        };
        
        list.appendChild(item);
    });
}

// Update all chats list
function updateAllChatsList() {
    const list = document.getElementById('allChatsList');
    if (!list) {
        console.error('allChatsList not found');
        return;
    }
    
    const chatKeys = Object.keys(chatHistory).sort((a, b) => {
        const msgA = chatHistory[a];
        const msgB = chatHistory[b];
        if (!msgA || !msgA.length || !msgB || !msgB.length) return 0;
        return new Date(msgB[msgB.length - 1].timestamp) - new Date(msgA[msgA.length - 1].timestamp);
    });
    
    if (chatKeys.length === 0) {
        // Show friends only (not all users) if no chat history
        let html = '';
        const friendList = Array.from(friends).filter(f => onlineUsers.includes(f));
        if (friendList.length > 0) {
            html += '<div class="list-item" style="background: #f0f0f0; font-weight: 600; color: #667eea;">Friends - Click to Chat</div>';
            friendList.forEach(user => {
                html += `
                    <div class="list-item" onclick="selectUser('${escapeHtml(user)}')">
                        ${getProfilePicture(user)}
                        <div class="item-content">
                            <div class="item-name">👤 ${escapeHtml(user)} <span class="online-dot"></span></div>
                            <div class="item-info">Tap to start chatting</div>
                        </div>
                    </div>
                `;
            });
        }
        if (allGroups.length > 0) {
            html += '<div class="list-item" style="background: #f0f0f0; font-weight: 600; color: #667eea; margin-top: 10px;">Available Groups</div>';
            allGroups.forEach(group => {
                html += `
                    <div class="list-item" onclick="${joinedGroups.has(group.groupId) ? `selectGroup('${group.groupId}')` : `joinGroup('${group.groupId}')`}">
                        ${getProfilePicture(group.groupId)}
                        <div class="item-content">
                            <div class="item-name">👥 ${escapeHtml(group.groupId)}</div>
                            <div class="item-info">${group.memberCount} member(s)</div>
                        </div>
                    </div>
                `;
            });
        }
        if (html === '') {
            html = '<div class="list-item"><div class="item-info">No chats yet. Search for users or create a group!</div></div>';
        }
        list.innerHTML = html;
        return;
    }
    
    renderChatList(list, chatKeys);
}

// Update unread chats list
function updateUnreadChatsList() {
    const list = document.getElementById('unreadChatsList');
    if (!list) {
        console.error('unreadChatsList not found');
        return;
    }
    
    const unreadKeys = Object.keys(unreadCounts).filter(key => unreadCounts[key] > 0);
    
    if (unreadKeys.length === 0) {
        list.innerHTML = '<div class="list-item"><div class="item-info">No unread messages</div></div>';
        return;
    }
    
    const sorted = unreadKeys.sort((a, b) => unreadCounts[b] - unreadCounts[a]);
    renderChatList(list, sorted);
}

// Update favorites list
function updateFavoritesList() {
    const list = document.getElementById('favoritesList');
    if (!list) {
        console.error('favoritesList not found');
        return;
    }
    
    const favoriteKeys = Array.from(favorites).filter(key => chatHistory[key]);
    
    if (favoriteKeys.length === 0) {
        list.innerHTML = '<div class="list-item"><div class="item-info">No favorite chats. Star a chat to add it to favorites!</div></div>';
        return;
    }
    
    const sorted = favoriteKeys.sort((a, b) => {
        const msgA = chatHistory[a];
        const msgB = chatHistory[b];
        if (!msgA || !msgA.length || !msgB || !msgB.length) return 0;
        return new Date(msgB[msgB.length - 1].timestamp) - new Date(msgA[msgA.length - 1].timestamp);
    });
    
    renderChatList(list, sorted);
}

// Render chat list
function renderChatList(container, chatKeys) {
    container.innerHTML = '';
    
    if (chatKeys.length === 0) {
        container.innerHTML = '<div class="list-item"><div class="item-info">No chats</div></div>';
        return;
    }
    
    chatKeys.forEach(key => {
        const [type, id] = key.split(':');
        const messages = chatHistory[key] || [];
        const lastMessage = messages[messages.length - 1];
        
        if (!lastMessage) return;
        
        const item = document.createElement('div');
        item.className = 'list-item';
        if (currentChat && getChatKey(currentChat) === key) {
            item.classList.add('active');
        }
        
        const unreadCount = unreadCounts[key] || 0;
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
        const favoriteIcon = favorites.has(key) ? '⭐' : '';
        const isOnline = type === 'private' && onlineUsers.includes(id);
        const onlineIndicator = isOnline ? '<span class="online-dot"></span>' : '';
        
        const lastMsgText = lastMessage.content.length > 30 
            ? lastMessage.content.substring(0, 30) + '...' 
            : lastMessage.content;
        const time = new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        item.innerHTML = `
            ${getProfilePicture(id)}
            <div class="item-content">
                <div class="item-header">
                    <div class="item-name">
                        ${type === 'group' ? '👥' : '👤'} ${escapeHtml(id)} ${favoriteIcon}
                        ${onlineIndicator}
                    </div>
                    <div class="item-time">${time}</div>
                </div>
                <div class="item-footer">
                    <div class="item-info">${escapeHtml(lastMsgText)}</div>
                    ${unreadBadge}
                    <button class="favorite-btn" onclick="event.stopPropagation(); toggleFavorite('${key}')">
                        ${favorites.has(key) ? '⭐' : '☆'}
                    </button>
                </div>
            </div>
        `;
        
        item.onclick = () => {
            if (type === 'group') {
                selectGroup(id);
            } else {
                selectUser(id);
            }
        };
        
        container.appendChild(item);
    });
}

// Update all chat lists
function updateAllChatLists() {
    updateAllChatsList();
    updateUnreadChatsList();
    updateFavoritesList();
    updateUnreadBadge();
}

// Update unread badge in tab
function updateUnreadBadge() {
    const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    const badge = document.getElementById('unreadBadge');
    if (badge) {
        if (totalUnread > 0) {
            badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Mark messages as read when chat is opened
function markChatAsRead(chatKey) {
    if (unreadCounts[chatKey]) {
        unreadCounts[chatKey] = 0;
        updateAllChatLists();
    }
    
    // Mark all messages in this chat as read
    if (chatHistory[chatKey]) {
        chatHistory[chatKey].forEach(msg => {
            if (msg.messageId && msg.received) {
                updateMessageStatus(msg.messageId, 'read');
            }
        });
    }
}

// Handle typing indicator
function handleTyping() {
    if (!currentChat || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    const chatKey = getChatKey(currentChat);
    
    // Send typing indicator
    ws.send(JSON.stringify({
        type: 'typing',
        chatKey: chatKey,
        isTyping: true
    }));
    
    // Clear previous timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Stop typing after 3 seconds
    typingTimeout = setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'typing',
            chatKey: chatKey,
            isTyping: false
        }));
    }, 3000);
}

