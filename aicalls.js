// Configuration
const API_URL = 'https://services.leadconnectorhq.com/voice-ai/dashboard/call-logs';
const LOCATION_ID = '0BL2s1FXz9zqmSGr7yns';
const BEARER_TOKEN = 'pit-b9cfd4b2-394a-4dc2-a5fe-08373f52bb96';
const API_VERSION = '2021-04-15';

// State
let state = {
    callLogs: [],
    total: 0,
    page: 1,
    pageSize: 10,
    isLoading: true,
    filters: {
        startDate: null,
        endDate: null
    }
};

// DOM Elements
const els = {
    tableBody: document.getElementById('table-body'),
    paginationInfo: document.getElementById('pagination-info'),
    paginationControls: document.getElementById('pagination-controls'),
    filterStartDate: document.getElementById('filter-startDate'),
    filterEndDate: document.getElementById('filter-endDate'),
    applyDateFilter: document.getElementById('apply-date-filter'),
    clearDateFilter: document.getElementById('clear-date-filter'),
    modal: document.getElementById('data-modal'),
    modalContent: document.getElementById('data-modal-content'),
    modalTitle: document.getElementById('modal-title'),
    modalSubtitle: document.getElementById('modal-subtitle'),
    modalPill: document.getElementById('modal-pill'),
    modalText: document.getElementById('modal-text'),
};

/**
 * Initialization
 */
async function init() {
    setupFilters();
    renderSkeletons();
    await fetchData(state.page);
}

/**
 * Setup Event Listeners for Filters
 */
function setupFilters() {
    els.applyDateFilter.addEventListener('click', () => {
        const startVal = els.filterStartDate.value;
        const endVal = els.filterEndDate.value;

        if (startVal && endVal) {
            const startDate = new Date(startVal + 'T00:00:00').getTime();
            const endDate = new Date(endVal + 'T23:59:59').getTime();

            if (startDate < endDate) {
                state.filters.startDate = startDate;
                state.filters.endDate = endDate;
                state.page = 1;
                fetchData(state.page);
            } else {
                alert('Start date must be before end date.');
            }
        } else {
            alert('Both start date and end date must be provided together.');
        }
    });

    els.clearDateFilter.addEventListener('click', () => {
        els.filterStartDate.value = '';
        els.filterEndDate.value = '';
        state.filters.startDate = null;
        state.filters.endDate = null;
        state.page = 1;
        fetchData(state.page);
    });
}

/**
 * Fetch Data from GHL API
 */
async function fetchData(pageToFetch) {
    state.isLoading = true;
    renderSkeletons();

    try {
        let url = `${API_URL}?locationId=${LOCATION_ID}&page=${pageToFetch}&pageSize=${state.pageSize}`;

        if (state.filters.startDate && state.filters.endDate) {
            url += `&startDate=${state.filters.startDate}&endDate=${state.filters.endDate}`;
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'version': API_VERSION
            }
        });

        if (!response.ok) throw new Error(`API returned status: ${response.status}`);

        const data = await response.json();

        state.callLogs = data.callLogs || [];
        state.total = data.total || 0;
        state.page = data.page || pageToFetch;
        state.isLoading = false;

        updateUI();

    } catch (error) {
        console.error('Error fetching call logs:', error);
        state.isLoading = false;
        els.tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-accentRed font-medium">Failed to load data. Please check connection and token.</td></tr>`;
    }
}

/**
 * Main UI Update Control
 */
function updateUI() {
    renderTable();
    renderPagination();
}

/**
 * Formats a Date string
 */
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year}<br><span class="text-xs text-textMuted">${hours}:${minutes} ${ampm}</span>`;
}

/**
 * Formats seconds into MM:SS
 */
function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return '-';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

/**
 * Render Data Table
 */
function renderTable() {
    els.tableBody.innerHTML = '';

    if (state.callLogs.length === 0) {
        els.tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-textMuted">No call logs match your filters.</td></tr>`;
        return;
    }

    state.callLogs.forEach((log, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/50 transition-colors';

        const agentName = log.agentName || log.agentId || 'Unknown Agent';
        const contactName = log.extractedData?.name || 'Unknown Contact';
        const contactInitials = contactName.split(' ').filter(n => n.trim().length > 0).map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || '??';
        const dateTime = formatDateTime(log.createdAt);
        const durationStr = formatDuration(log.duration);
        const actionsCount = log.executedCallActions ? log.executedCallActions.length : 0;
        const actionsStr = actionsCount > 0 ? `${actionsCount} actions` : '-';

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        ${agentName.charAt(0).toUpperCase()}
                    </div>
                    <span class="font-medium text-textMain">${agentName}</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">
                 <div class="flex items-center space-x-2">
                     <span class="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold">${contactInitials}</span>
                     <span>${contactName}</span>
                 </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">${log.fromNumber || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-textMain">${dateTime}</td>
            <td class="px-6 py-4 whitespace-nowrap text-textMain font-medium">${durationStr}</td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">${actionsStr}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right space-x-2">
                <button onclick="openModal('summary', ${index})" class="px-3 py-1.5 border border-bordercolor rounded-lg text-xs font-medium text-textMain bg-surface hover:bg-white/10 transition-all shadow-sm">
                    Summary
                </button>
                <button onclick="openModal('transcript', ${index})" class="w-8 h-8 border border-bordercolor rounded-lg text-xs text-textMain bg-surface hover:bg-white/10 transition-all inline-flex items-center justify-center shadow-sm">
                    <i class="fa-regular fa-file-lines"></i>
                </button>
            </td>
        `;
        els.tableBody.appendChild(tr);
    });
}

/**
 * Render Pagination
 */
function renderPagination() {
    const totalPages = Math.ceil(state.total / state.pageSize);
    const startIdx = ((state.page - 1) * state.pageSize) + 1;
    const endIdx = Math.min(state.page * state.pageSize, state.total);
    els.paginationInfo.textContent = `Showing ${startIdx} to ${endIdx} of ${state.total} results`;

    let html = '';
    const prevDisabled = state.page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10';
    html += `<button onclick="changePage(${state.page - 1})" class="px-3 py-1.5 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${prevDisabled}" ${state.page <= 1 ? 'disabled' : ''}>Previous</button>`;

    let startPage = Math.max(1, state.page - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === state.page ? 'bg-primary text-white border-primary shadow-sm' : 'bg-surface text-textMain border-bordercolor hover:bg-white/10';
        html += `<button onclick="changePage(${i})" class="w-8 h-8 border rounded-lg flex items-center justify-center text-xs font-medium transition-all ${activeClass}">${i}</button>`;
    }

    const nextDisabled = state.page >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10';
    html += `<button onclick="changePage(${state.page + 1})" class="px-3 py-1.5 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${nextDisabled}" ${state.page >= totalPages ? 'disabled' : ''}>Next</button>`;

    els.paginationControls.innerHTML = html;
}

window.changePage = function (newPage) {
    const totalPages = Math.ceil(state.total / state.pageSize);
    if (newPage < 1 || newPage > totalPages || newPage === state.page) return;
    fetchData(newPage);
};

window.renderSkeletons = function() {
    els.tableBody.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-5"><div class="h-4 rounded w-24 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-32 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-28 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-20 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-16 placeholder-glow"></div></td>
             <td class="px-6 py-5"><div class="h-4 rounded w-16 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-6 rounded w-24 ml-auto placeholder-glow"></div></td>
        `;
        els.tableBody.appendChild(tr);
    }
}

/**
 * Modal Logic
 */
window.openModal = function (type, logIndex) {
    const log = state.callLogs[logIndex];
    if (!log) return;

    if (type === 'summary') {
        els.modalTitle.textContent = 'Call Summary';
        els.modalSubtitle.classList.add('hidden');
        els.modalPill.textContent = 'Translated Summary (English)';
        els.modalPill.classList.remove('hidden');
        els.modalText.innerHTML = log.summary || 'No summary available for this call.';
    } else if (type === 'transcript') {
        els.modalTitle.textContent = 'Transcript';
        els.modalSubtitle.classList.remove('hidden');
        els.modalPill.textContent = 'Translated Transcript (English)';
        els.modalPill.classList.remove('hidden');

        let transcriptHtml = 'No transcript available.';
        if (log.transcript) {
            const lines = log.transcript.split('\n');
            transcriptHtml = lines.map(line => {
                if (!line.trim()) return '';
                if (line.startsWith('bot:')) {
                    return `<div class="mb-4 flex"><div class="w-8 flex-shrink-0 font-bold text-[10px] text-primary pt-1">AI</div><div class="flex-1 bg-primary/10 p-3 rounded-2xl rounded-tl-none text-textMain text-sm border border-primary/20">${line.replace('bot:', '').trim()}</div></div>`;
                } else if (line.startsWith('human:')) {
                    return `<div class="mb-4 flex"><div class="w-8 flex-shrink-0 font-bold text-[10px] text-textMuted pt-1">User</div><div class="flex-1 p-3 rounded-2xl rounded-tl-none bg-white/5 text-textMain text-sm border border-bordercolor">${line.replace('human:', '').trim()}</div></div>`;
                }
                return `<div class="mb-2 text-sm">${line}</div>`;
            }).join('');
        }
        els.modalText.innerHTML = `<div class="mt-2">${transcriptHtml}</div>`;
    }

    els.modal.classList.remove('opacity-0', 'pointer-events-none');
    els.modalContent.classList.remove('scale-95');
    els.modalContent.classList.add('scale-100');
    document.body.style.overflow = 'hidden';
};

window.closeModal = function () {
    els.modal.classList.add('opacity-0', 'pointer-events-none');
    els.modalContent.classList.remove('scale-100');
    els.modalContent.classList.add('scale-95');
    document.body.style.overflow = '';
};

document.addEventListener('DOMContentLoaded', init);
