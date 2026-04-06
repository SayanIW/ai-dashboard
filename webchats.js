// Configuration
const API_URL = 'https://services.leadconnectorhq.com/conversations/search';
const LOCATION_ID = 'wJ5RzgK5QWJOkfK65b06';
const BEARER_TOKEN = 'pit-80915d73-a3b5-4c75-bc78-34750b1c2537';
const API_VERSION = '2021-04-15';

// State
let state = {
    conversations: [],
    total: 0,
    limit: 20,
    isLoading: true,
    searchQuery: '',
    // Pagination tracking
    startAfterDate: null,
    startAfterId: null,
    history: [] // For "Previous" button
};

// DOM Elements
const els = {
    tableBody: document.getElementById('webchats-table-body'),
    paginationInfo: document.getElementById('pagination-info'),
    paginationControls: document.getElementById('pagination-controls'),
    searchInput: document.getElementById('webchat-search')
};

/**
 * Initialization
 */
async function init() {
    setupSearch();
    await fetchWebChats();
}

/**
 * Setup Search
 */
function setupSearch() {
    let timeout = null;
    els.searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            state.searchQuery = e.target.value.trim();
            // Reset pagination on search
            state.startAfterDate = null;
            state.startAfterId = null;
            state.history = [];
            fetchWebChats();
        }, 500);
    });
}

/**
 * Fetch Web Chats from GHL API
 */
async function fetchWebChats() {
    state.isLoading = true;
    renderSkeletons();

    try {
        let url = `${API_URL}?locationId=${LOCATION_ID}&limit=${state.limit}&lastMessageType=TYPE_LIVE_CHAT`;

        if (state.searchQuery) {
            url += `&query=${encodeURIComponent(state.searchQuery)}`;
        }

        if (state.startAfterDate) {
            url += `&startAfterDate=${state.startAfterDate}`;
        }

        if (state.startAfterId) {
            url += `&id=${state.startAfterId}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Version': API_VERSION
            }
        });

        if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
        }

        const data = await response.json();

        state.conversations = data.conversations || [];
        state.total = data.total || 0;
        state.isLoading = false;

        updateUI();

    } catch (error) {
        console.error('Error fetching web chats:', error);
        state.isLoading = false;
        els.tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-accentRed font-medium">Failed to load conversations. Please check connection and token.</td></tr>`;
    }
}

/**
 * Update UI
 */
function updateUI() {
    renderTable();
    renderPagination();
}

/**
 * Render Web Chats Table
 */
function renderTable() {
    els.tableBody.innerHTML = '';

    if (state.conversations.length === 0) {
        els.tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-textMuted">No web chats found.</td></tr>`;
        return;
    }

    state.conversations.forEach((conv) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/50 transition-colors cursor-pointer';

        const name = conv.fullName || 'Unnamed';
        const contactName = conv.contactName || '-';
        const initials = name.split(' ').filter(n => n.trim().length > 0).map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || '??';
        const email = conv.email || '-';
        const phone = conv.phone || '-';
        const lastMessage = conv.lastMessageBody || '-';
        const unreadCount = conv.unreadCount || 0;

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        ${initials}
                    </div>
                    <span class="font-medium text-textMain">${name}</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">${contactName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">${email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">${phone}</td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted truncate max-w-xs" title="${lastMessage}">${lastMessage}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                ${unreadCount > 0 
                    ? `<span class="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">${unreadCount}</span>`
                    : `<span class="text-textMuted text-[10px]">-</span>`
                }
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <button onclick="openChatModal('${conv.id}', '${name.replace(/'/g, "\\'")}', '${email}', '${phone}')" class="px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all">
                    View Info
                </button>
            </td>
        `;

        els.tableBody.appendChild(tr);
    });
}

/**
 * Modal Logic
 */
window.openChatModal = async function(conversationId, name, email, phone) {
    const modal = document.getElementById('message-modal');
    const nameEl = document.getElementById('modal-user-name');
    const infoEl = document.getElementById('modal-user-info');
    const messagesContainer = document.getElementById('modal-messages');
    
    nameEl.textContent = name;
    infoEl.textContent = `${email} • ${phone}`;
    modal.classList.remove('hidden');
    
    // Loading state
    messagesContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-textMuted space-y-4">
            <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p class="text-xs">Fetching conversation history...</p>
        </div>
    `;
    
    try {
        const url = `https://services.leadconnectorhq.com/conversations/${conversationId}/messages`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Version': API_VERSION
            }
        });

        if (!response.ok) throw new Error('Failed to fetch messages');
        
        const data = await response.json();
        const messages = data.messages?.messages || [];
        
        renderMessages(messages);
        document.getElementById('modal-message-count').textContent = `${messages.length} messages found`;
        
    } catch (error) {
        console.error('Error fetching messages:', error);
        messagesContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-accentRed space-y-2">
                <i class="fa-solid fa-circle-exclamation text-2xl"></i>
                <p class="text-xs">Error loading history. Please try again.</p>
            </div>
        `;
    }
}

window.closeModal = function() {
    document.getElementById('message-modal').classList.add('hidden');
}

function renderMessages(messages) {
    const container = document.getElementById('modal-messages');
    container.innerHTML = '';
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-textMuted italic text-xs">No messages yet perfectly synced via HighLevel.</div>';
        return;
    }

    // Sort messages by dateAdded ascending for sequential display
    const sortedMessages = [...messages].sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

    sortedMessages.forEach(msg => {
        const isOutbound = msg.direction === 'outbound';
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex ${isOutbound ? 'justify-end' : 'justify-start'}`;
        
        const time = new Date(msg.dateAdded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        msgDiv.innerHTML = `
            <div class="max-w-[80%] flex flex-col ${isOutbound ? 'items-end' : 'items-start'}">
                <div class="px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                    isOutbound 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-surface border border-bordercolor text-textMain rounded-tl-none'
                }">
                    ${msg.body || '(Media or Empty Message)'}
                </div>
                <span class="text-[9px] text-textMuted mt-1 px-1">${time} · ${msg.status || ''}</span>
            </div>
        `;
        container.appendChild(msgDiv);
    });
    
    // Scroll to bottom
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

/**
 * Render Pagination
 */
function renderPagination() {
    // Info text
    const count = state.conversations.length;
    els.paginationInfo.textContent = `Showing ${count} of ${state.total} results`;

    let html = '';

    // Previous Button
    const prevDisabled = state.history.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50/10';
    html += `<button onclick="goBack()" class="px-4 py-2 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${prevDisabled}" ${state.history.length === 0 ? 'disabled' : ''}>Previous</button>`;

    // Next Button
    const hasMore = count === state.limit || (state.history.length * state.limit + count < state.total);
    // Actually, simply if count == limit, there's likely more.
    const canGoNext = count === state.limit;
    const nextDisabled = !canGoNext ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50/10';
    html += `<button onclick="goNext()" class="px-4 py-2 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${nextDisabled}" ${!canGoNext ? 'disabled' : ''}>Next</button>`;

    els.paginationControls.innerHTML = html;
}

window.goNext = function () {
    if (state.conversations.length === 0) return;

    // Save current state for history
    state.history.push({
        startAfterDate: state.startAfterDate,
        startAfterId: state.startAfterId
    });

    const lastConv = state.conversations[state.conversations.length - 1];
    state.startAfterDate = lastConv.lastMessageDate;
    state.startAfterId = lastConv.id;

    fetchWebChats();
};

window.goBack = function () {
    if (state.history.length === 0) return;

    const lastState = state.history.pop();
    state.startAfterDate = lastState.startAfterDate;
    state.startAfterId = lastState.startAfterId;

    fetchWebChats();
};

/**
 * Render Skeletons
 */
function renderSkeletons() {
    els.tableBody.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-5"><div class="h-4 rounded w-32 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-24 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-48 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-28 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-40 placeholder-glow"></div></td>
            <td class="px-6 py-5 flex justify-center"><div class="h-4 rounded w-8 placeholder-glow"></div></td>
        `;
        els.tableBody.appendChild(tr);
    }
}

// Call init directly — DOM is already ready since script is at bottom of body
init();
