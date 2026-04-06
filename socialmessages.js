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
    startAfterDate: null,
    startAfterId: null,
    history: []
};

// DOM Elements
const els = {
    tableBody: document.getElementById('social-table-body'),
    paginationInfo: document.getElementById('pagination-info'),
    paginationControls: document.getElementById('pagination-controls'),
    searchInput: document.getElementById('social-search')
};

/**
 * Initialization
 */
function init() {
    setupSearch();
    fetchSocialMessages();
}

/**
 * Setup Search
 */
function setupSearch() {
    if (!els.searchInput) return;
    let timeout = null;
    els.searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            state.searchQuery = e.target.value.trim();
            state.startAfterDate = null;
            state.startAfterId = null;
            state.history = [];
            fetchSocialMessages();
        }, 500);
    });
}

/**
 * Fetch Social Messages (Facebook) from GHL API
 */
async function fetchSocialMessages() {
    state.isLoading = true;
    renderSkeletons();

    try {
        let url = `${API_URL}?locationId=${LOCATION_ID}&limit=${state.limit}&lastMessageType=TYPE_FACEBOOK`;

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

        if (!response.ok) throw new Error(`API status: ${response.status}`);

        const data = await response.json();
        state.conversations = data.conversations || [];
        state.total = data.total || 0;
        state.isLoading = false;
        updateUI();

    } catch (error) {
        console.error('Error fetching social messages:', error);
        state.isLoading = false;
        els.tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-accentRed font-medium">Failed to load messages. Please check connection and token.</td></tr>`;
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
 * Render Table
 */
function renderTable() {
    els.tableBody.innerHTML = '';

    if (state.conversations.length === 0) {
        els.tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-textMuted">No Facebook messages found.</td></tr>`;
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
                    <div class="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs relative">
                        ${initials}
                        <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#1877F2] rounded-full flex items-center justify-center">
                            <i class="fa-brands fa-facebook-f text-white text-[6px]"></i>
                        </span>
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
                    ? `<span class="bg-[#1877F2] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">${unreadCount}</span>`
                    : `<span class="text-textMuted text-[10px]">-</span>`
                }
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <button onclick="openChatModal('${conv.id}', '${name.replace(/'/g, "\\'")}', '${email}', '${phone}')" class="px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-[#1877F2] hover:text-white rounded-lg text-xs font-bold transition-all">
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

    messagesContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-textMuted space-y-4">
            <div class="w-8 h-8 border-3 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
            <p class="text-xs">Fetching Facebook conversation history...</p>
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
};

window.closeModal = function() {
    document.getElementById('message-modal').classList.add('hidden');
};

function renderMessages(messages) {
    const container = document.getElementById('modal-messages');
    container.innerHTML = '';

    if (messages.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-textMuted italic text-xs">No messages available for this conversation.</div>';
        return;
    }

    const sorted = [...messages].sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

    sorted.forEach(msg => {
        const isOutbound = msg.direction === 'outbound';
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex ${isOutbound ? 'justify-end' : 'justify-start'}`;

        const time = new Date(msg.dateAdded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgDiv.innerHTML = `
            <div class="max-w-[80%] flex flex-col ${isOutbound ? 'items-end' : 'items-start'}">
                <div class="px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                    isOutbound
                    ? 'bg-[#1877F2] text-white rounded-tr-none'
                    : 'bg-surface border border-bordercolor text-textMain rounded-tl-none'
                }">
                    ${msg.body || '(Media or Empty Message)'}
                </div>
                <span class="text-[9px] text-textMuted mt-1 px-1">${time} · ${msg.status || ''}</span>
            </div>
        `;
        container.appendChild(msgDiv);
    });

    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
}

/**
 * Pagination
 */
function renderPagination() {
    const count = state.conversations.length;
    els.paginationInfo.textContent = `Showing ${count} of ${state.total} results`;

    let html = '';
    const prevDisabled = state.history.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50/10';
    html += `<button onclick="goBack()" class="px-4 py-2 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${prevDisabled}" ${state.history.length === 0 ? 'disabled' : ''}>Previous</button>`;

    const canGoNext = count === state.limit;
    const nextDisabled = !canGoNext ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50/10';
    html += `<button onclick="goNext()" class="px-4 py-2 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${nextDisabled}" ${!canGoNext ? 'disabled' : ''}>Next</button>`;

    els.paginationControls.innerHTML = html;
}

window.goNext = function () {
    if (state.conversations.length === 0) return;
    state.history.push({ startAfterDate: state.startAfterDate, startAfterId: state.startAfterId });
    const last = state.conversations[state.conversations.length - 1];
    state.startAfterDate = last.lastMessageDate;
    state.startAfterId = last.id;
    fetchSocialMessages();
};

window.goBack = function () {
    if (state.history.length === 0) return;
    const prev = state.history.pop();
    state.startAfterDate = prev.startAfterDate;
    state.startAfterId = prev.startAfterId;
    fetchSocialMessages();
};

/**
 * Render Skeleton Rows
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
            <td class="px-6 py-5"><div class="h-6 rounded w-20 ml-auto placeholder-glow"></div></td>
        `;
        els.tableBody.appendChild(tr);
    }
}

// Run directly (script is at bottom of body)
init();
