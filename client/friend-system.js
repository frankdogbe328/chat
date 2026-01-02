// Friend System - Like Facebook/Snapchat
// Functions for friend requests, accepting, declining

// Send friend request
window.sendFriendRequest = function(username) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'send_friend_request',
        to: username
    }));
};

// Accept friend request
window.acceptFriendRequest = function(username) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'accept_friend_request',
        from: username
    }));
};

// Decline friend request
window.declineFriendRequest = function(username) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'decline_friend_request',
        from: username
    }));
};

// Update friend requests list
window.updateFriendRequestsList = function() {
    const list = document.getElementById('requestsList');
    if (!list) return;
    
    list.innerHTML = '';
    
    const receivedRequests = Array.from(friendRequests.received || []);
    
    if (receivedRequests.length === 0) {
        list.innerHTML = '<div class="list-item"><div class="item-info">No friend requests</div></div>';
        
        // Show sent requests too
        const sentRequests = Array.from(friendRequests.sent || []);
        if (sentRequests.length > 0) {
            list.innerHTML += '<div class="list-item" style="background: #f0f0f0; font-weight: 600; color: #667eea; margin-top: 10px;">Sent Requests</div>';
            sentRequests.forEach(username => {
                list.innerHTML += `
                    <div class="list-item">
                        ${getProfilePicture(username)}
                        <div class="item-content">
                            <div class="item-name">👤 ${escapeHtml(username)}</div>
                            <div class="item-info">Request sent - Waiting for response</div>
                        </div>
                    </div>
                `;
            });
        }
        return;
    }
    
    // Received requests
    list.innerHTML = '<div class="list-item" style="background: #f0f0f0; font-weight: 600; color: #667eea;">Friend Requests</div>';
    
    receivedRequests.forEach(username => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            ${getProfilePicture(username)}
            <div class="item-content">
                <div class="item-name">👤 ${escapeHtml(username)}</div>
                <div class="item-info">Wants to be your friend</div>
            </div>
            <div class="friend-request-actions">
                <button class="btn-accept" onclick="acceptFriendRequest('${escapeHtml(username)}')">Accept</button>
                <button class="btn-decline" onclick="declineFriendRequest('${escapeHtml(username)}')">Decline</button>
            </div>
        `;
        list.appendChild(item);
    });
    
    // Sent requests
    const sentRequests = Array.from(friendRequests.sent || []);
    if (sentRequests.length > 0) {
        const sentHeader = document.createElement('div');
        sentHeader.className = 'list-item';
        sentHeader.style.cssText = 'background: #f0f0f0; font-weight: 600; color: #667eea; margin-top: 10px;';
        sentHeader.innerHTML = '<div>Sent Requests</div>';
        list.appendChild(sentHeader);
        
        sentRequests.forEach(username => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                ${getProfilePicture(username)}
                <div class="item-content">
                    <div class="item-name">👤 ${escapeHtml(username)}</div>
                    <div class="item-info">Request sent - Waiting for response</div>
                </div>
            `;
            list.appendChild(item);
        });
    }
};

// Update requests badge
window.updateRequestsBadge = function() {
    const badge = document.getElementById('requestsBadge');
    if (!badge) return;
    
    const count = friendRequests.received ? friendRequests.received.size : 0;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
};

