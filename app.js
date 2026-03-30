// Configuration based on the user's provided curl
const API_URL = 'https://services.leadconnectorhq.com/voice-ai/dashboard/call-logs';
const LOCATION_ID = 'wJ5RzgK5QWJOkfK65b06';
const BEARER_TOKEN = 'pit-8e033401-0d39-47c6-bd36-40021c84b49c';
const API_VERSION = '2021-04-15';

// State
let state = {
    callLogs: [],
    total: 0,
    page: 1,
    pageSize: 10,
    isLoading: true,
    chartInstance: null,
    filters: {
        startDate: null,
        endDate: null
    }
};

// DOM Elements
const els = {
    kpiTotal: document.getElementById('kpi-total-calls'),
    kpiActions: document.getElementById('kpi-actions'),
    kpiTotalDur: document.getElementById('kpi-total-duration'),
    kpiAvgDur: document.getElementById('kpi-avg-duration'),
    tableBody: document.getElementById('table-body'),
    paginationInfo: document.getElementById('pagination-info'),
    paginationControls: document.getElementById('pagination-controls'),
    chartCanvas: document.getElementById('callsChart'),
    
    // Filter Elements
    filterStartDate: document.getElementById('filter-startDate'),
    filterEndDate: document.getElementById('filter-endDate'),
    applyDateFilter: document.getElementById('apply-date-filter'),
    clearDateFilter: document.getElementById('clear-date-filter'),
    
    // Modal Elements
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
            // Convert 'YYYY-MM-DD' to Unix timestamp (milliseconds)
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

        if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
        }

        const data = await response.json();
        
        state.callLogs = data.callLogs || [];
        state.total = data.total || 0;
        state.page = data.page || pageToFetch;
        state.pageSize = data.pageSize || 10;
        state.isLoading = false;

        updateUI();

    } catch (error) {
        console.error('Error fetching call logs:', error);
        state.isLoading = false;
        els.tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-accentRed font-medium">Failed to load data. Please check connection and token.</td></tr>`;
        removeGlowLines();
    }
}

/**
 * Main UI Update Control
 */
function updateUI() {
    renderKPIs();
    renderTable();
    renderPagination();
    renderChart();
}

/**
 * Remove classes used for loading skeletons from KPIs
 */
function removeGlowLines() {
    [els.kpiTotal, els.kpiActions, els.kpiTotalDur, els.kpiAvgDur].forEach(el => {
        el.classList.remove('placeholder-glow', 'bg-gray-200', 'w-16', 'h-9', 'w-24', 'h-8', 'block');
    });
}

/**
 * Compute and Render KPIs
 */
function renderKPIs() {
    removeGlowLines();

    // From current page data, though normally these might be global stats.
    // The API response gave us total calls directly in `data.total`.
    els.kpiTotal.textContent = state.total;

    // Calculate actions triggered in this page and sum them up
    let actionsTriggered = 0;
    let totalDurationInSeconds = 0;

    state.callLogs.forEach(log => {
        if (log.executedCallActions) {
            actionsTriggered += log.executedCallActions.length;
        }
        if (log.duration) {
            totalDurationInSeconds += log.duration;
        }
    });

    els.kpiActions.textContent = actionsTriggered;

    // Convert duration to Mins
    const totalMins = Math.round(totalDurationInSeconds / 60);
    els.kpiTotalDur.textContent = `${totalMins} Mins`;

    const avgMins = state.callLogs.length > 0 ? (totalDurationInSeconds / state.callLogs.length / 60).toFixed(1) : 0;
    els.kpiAvgDur.textContent = `${avgMins} Mins`;
}

/**
 * Formats a Date string into a nice readable format
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
    hours = hours ? hours : 12; // the hour '0' should be '12'
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

        // Extract values with fallbacks
        const agentName = log.agentName || log.agentId || 'Unknown Agent';
        const contactName = log.extractedData?.name || 'Unknown Contact';
        const contactInitials = contactName.split(' ').filter(n => n.trim().length > 0).map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || '??';
        const phoneNumber = '-'; // Phone number is not directly in the summary attached, fall back to dash
        const dateTime = formatDateTime(log.createdAt);
        const durationStr = formatDuration(log.duration);
        const actionsCount = log.executedCallActions ? log.executedCallActions.length : 0;
        const actionsStr = actionsCount > 0 ? `${actionsCount} actions` : '-';

        // Ensure text is clean
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
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
                <button onclick="openModal('summary', ${index})" class="action-btn px-3 py-1.5 border border-bordercolor rounded text-xs font-medium text-textMain bg-surface hover:bg-gray-50 items-center inline-flex" title="Summary">
                    <i class="fa-solid fa-phone mr-1.5 text-textMuted text-[10px]"></i> Summary
                </button>
                <button onclick="openModal('transcript', ${index})" class="action-btn w-8 h-8 border border-bordercolor rounded text-xs text-textMain bg-surface hover:bg-gray-50 items-center justify-center inline-flex" title="Transcript">
                    <i class="fa-regular fa-file-lines text-textMuted"></i>
                </button>
            </td>
        `;
        els.tableBody.appendChild(tr);
    });
}

/**
 * Render Pagination Controls
 */
function renderPagination() {
    const totalPages = Math.ceil(state.total / state.pageSize);
    
    // Info text
    const startIdx = ((state.page - 1) * state.pageSize) + 1;
    const endIdx = Math.min(state.page * state.pageSize, state.total);
    els.paginationInfo.textContent = `Showing ${startIdx} to ${endIdx} of ${state.total} results`;

    // Buttons
    let html = '';
    
    // Prev
    const prevDisabled = state.page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100';
    html += `<button onclick="changePage(${state.page - 1})" class="px-3 py-1.5 border border-bordercolor bg-surface rounded text-xs font-medium text-textMain ${prevDisabled}" ${state.page <= 1 ? 'disabled' : ''}>Previous</button>`;

    // Page Numbers (simplified - showing max 5 surrounding pages)
    let startPage = Math.max(1, state.page - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === state.page ? 'bg-primary text-white border-primary' : 'bg-surface text-textMain border-bordercolor hover:bg-gray-50';
        html += `<button onclick="changePage(${i})" class="w-8 h-8 border rounded flex items-center justify-center text-xs font-medium transition-colors ${activeClass}">${i}</button>`;
    }

    // Next
    const nextDisabled = state.page >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100';
    html += `<button onclick="changePage(${state.page + 1})" class="px-3 py-1.5 border border-bordercolor bg-surface rounded text-xs font-medium text-textMain ${nextDisabled}" ${state.page >= totalPages ? 'disabled' : ''}>Next</button>`;

    els.paginationControls.innerHTML = html;
}

window.changePage = function(newPage) {
    const totalPages = Math.ceil(state.total / state.pageSize);
    if (newPage < 1 || newPage > totalPages || newPage === state.page) return;
    fetchData(newPage);
};

/**
 * Load initial skeletons for table rows
 */
function renderSkeletons() {
    els.tableBody.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-5"><div class="h-4 bg-gray-200 rounded w-24 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 bg-gray-200 rounded w-32 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 bg-gray-200 rounded w-28 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 bg-gray-200 rounded w-20 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 bg-gray-200 rounded w-16 placeholder-glow"></div></td>
             <td class="px-6 py-5"><div class="h-4 bg-gray-200 rounded w-16 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-6 bg-gray-200 rounded w-24 ml-auto placeholder-glow"></div></td>
        `;
        els.tableBody.appendChild(tr);
    }
}

/**
 * Render Chart (Calls Completed) - Mocked based on current page data to look dynamic
 */
function renderChart() {
    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    // To make a nice line chart from pagination data, we'll plot duration grouped somewhat
    // If there is no data, create a flatline
    let labels = [];
    let dataPoints = [];

    if (state.callLogs.length > 0) {
        // Reverse array to show oldest first on the left, newest on right
        const reversed = [...state.callLogs].reverse();
        reversed.forEach((log, index) => {
            const d = new Date(log.createdAt);
            labels.push(`${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`);
            dataPoints.push(log.duration || 0); // Plotting duration as a metric since 'calls completed' needs daily aggregation we don't have
        });
    } else {
        labels = [];
        dataPoints = [];
    }

    const ctx = els.chartCanvas.getContext('2d');
    
    // Gradient fill
    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');   // primary color with opacity
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Call Duration (s)',
                data: dataPoints,
                borderColor: '#2563EB',
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#2563EB',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.4 // smooth curves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { size: 13, family: 'Inter' },
                    bodyFont: { size: 13, family: 'Inter' },
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#64748b'
                    }
                },
                y: {
                    grid: {
                        color: '#f1f5f9',
                        drawBorder: false
                    },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#64748b',
                        stepSize: 10,
                        beginAtZero: true
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });
}

/**
 * Modal Logic
 */
window.openModal = function(type, logIndex) {
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
        
        // Format transcript string
        let transcriptHtml = 'No transcript available.';
        if (log.transcript) {
            // Transcript is like: "bot:Welcome... \nhuman:Hello..."
            const lines = log.transcript.split('\n');
            transcriptHtml = lines.map(line => {
                if (!line.trim()) return '';
                if (line.startsWith('bot:')) {
                    return `<div class="mb-4 flex"><div class="w-8 flex-shrink-0 font-medium text-xs text-textMuted pt-0.5">AI</div><div class="flex-1 bg-gray-50 p-3 rounded-md text-textMain text-sm border border-bordercolor">${line.replace('bot:', '').trim()}</div></div>`;
                } else if (line.startsWith('human:')) {
                    return `<div class="mb-4 flex"><div class="w-8 flex-shrink-0 font-medium text-xs text-textMuted pt-0.5">User</div><div class="flex-1 p-3 rounded-md text-textMain text-sm">${line.replace('human:', '').trim()}</div></div>`;
                }
                return `<div class="mb-2 text-sm">${line}</div>`;
            }).join('');
        }
        
        els.modalText.innerHTML = `<div class="mt-2">${transcriptHtml}</div>`;
    }

    // Show modal
    els.modal.classList.remove('opacity-0', 'pointer-events-none');
    els.modalContent.classList.remove('scale-95');
    els.modalContent.classList.add('scale-100');
    // Prevent background scroll
    document.body.style.overflow = 'hidden';
};

window.closeModal = function() {
    els.modal.classList.add('opacity-0', 'pointer-events-none');
    els.modalContent.classList.remove('scale-100');
    els.modalContent.classList.add('scale-95');
    // Restore background scroll
    document.body.style.overflow = '';
};

// Close modal on outside click
document.getElementById('data-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

/**
 * Authentication / Logout
 */
window.logout = function() {
    localStorage.removeItem('isAuthenticated');
    window.location.href = 'login.html';
};

document.addEventListener('DOMContentLoaded', init);
