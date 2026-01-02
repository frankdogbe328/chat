// WhatsApp-like Features
// This file contains functions for message status, typing indicators, profile pictures, etc.

// Generate profile picture/avatar based on username
function getProfilePicture(username) {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'];
    const color = colors[username.charCodeAt(0) % colors.length];
    const initial = username.charAt(0).toUpperCase();
    
    // Create SVG avatar
    return `<div class="avatar" style="background-color: ${color};">
        <span>${initial}</span>
    </div>`;
}

// Generate unique message ID
function generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

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

// Get chat key for a chat object
function getChatKey(chat) {
    if (!chat) return null;
    return chat.type + ':' + chat.id;
}

// Toggle favorite
function toggleFavorite(chatKey) {
    if (favorites.has(chatKey)) {
        favorites.delete(chatKey);
    } else {
        favorites.add(chatKey);
    }
    saveFavorites();
    updateAllChatLists();
}

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

// Switch sidebar tab
function switchSidebarTab(tab) {
    sidebarTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });
    
    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Show selected panel
    if (tab === 'all') {
        document.getElementById('allChatsPanel').classList.add('active');
        updateAllChatsList();
    } else if (tab === 'unread') {
        document.getElementById('unreadChatsPanel').classList.add('active');
        updateUnreadChatsList();
    } else if (tab === 'favorites') {
        document.getElementById('favoritesPanel').classList.add('active');
        updateFavoritesList();
    } else if (tab === 'groups') {
        document.getElementById('groupsPanel').classList.add('active');
        updateGroupsList();
    }
}

// Handle search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        // Show normal list based on current tab
        switchSidebarTab(sidebarTab);
        return;
    }
    
    // Filter chats based on search
    const allChatKeys = Object.keys(chatHistory);
    const filtered = allChatKeys.filter(key => {
        const [type, id] = key.split(':');
        return id.toLowerCase().includes(searchTerm);
    });
    
    // Show search results in current panel
    showSearchResults(filtered);
}

// Show search results
function showSearchResults(filteredKeys) {
    const panel = document.querySelector('.tab-panel.active');
    if (!panel) return;
    
    const list = panel.querySelector('.list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (filteredKeys.length === 0) {
        list.innerHTML = '<div class="list-item"><div class="item-info">No results found</div></div>';
        return;
    }
    
    filteredKeys.forEach(key => {
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
        
        item.innerHTML = `
            ${getProfilePicture(id)}
            <div class="item-content">
                <div class="item-name">
                    ${type === 'group' ? '👥' : '👤'} ${escapeHtml(id)} ${favoriteIcon}
                    ${unreadBadge}
                </div>
                <div class="item-info">${escapeHtml(lastMessage.content.substring(0, 30))}...</div>
            </div>
        `;
        
        item.onclick = () => {
            if (type === 'group') {
                selectGroup(id);
            } else {
                selectUser(id);
            }
        };
        
        list.appendChild(item);
    });
}

// Update all chats list
function updateAllChatsList() {
    const list = document.getElementById('allChatsList');
    if (!list) return;
    
    const chatKeys = Object.keys(chatHistory).sort((a, b) => {
        const msgA = chatHistory[a];
        const msgB = chatHistory[b];
        if (!msgA.length || !msgB.length) return 0;
        return new Date(msgB[msgB.length - 1].timestamp) - new Date(msgA[msgA.length - 1].timestamp);
    });
    
    renderChatList(list, chatKeys);
}

// Update unread chats list
function updateUnreadChatsList() {
    const list = document.getElementById('unreadChatsList');
    if (!list) return;
    
    const unreadKeys = Object.keys(unreadCounts).filter(key => unreadCounts[key] > 0);
    const sorted = unreadKeys.sort((a, b) => unreadCounts[b] - unreadCounts[a]);
    
    renderChatList(list, sorted);
}

// Update favorites list
function updateFavoritesList() {
    const list = document.getElementById('favoritesList');
    if (!list) return;
    
    const favoriteKeys = Array.from(favorites).filter(key => chatHistory[key]);
    const sorted = favoriteKeys.sort((a, b) => {
        const msgA = chatHistory[a];
        const msgB = chatHistory[b];
        if (!msgA.length || !msgB.length) return 0;
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

