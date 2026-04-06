// =============================================
// Configuration
// =============================================
const CALLS_API_URL = 'https://services.leadconnectorhq.com/voice-ai/dashboard/call-logs';
const CALLS_LOCATION_ID = '0BL2s1FXz9zqmSGr7yns';
const CALLS_BEARER_TOKEN = 'pit-b9cfd4b2-394a-4dc2-a5fe-08373f52bb96';

const WEBCHATS_API_URL = 'https://services.leadconnectorhq.com/conversations/search';
const WEBCHATS_LOCATION_ID = 'wJ5RzgK5QWJOkfK65b06';
const WEBCHATS_BEARER_TOKEN = 'pit-80915d73-a3b5-4c75-bc78-34750b1c2537';

const API_VERSION = '2021-04-15';

// =============================================
// State
// =============================================
let state = {
    callLogs: [],
    totalCalls: 0,
    totalWebChats: 0,
    chartInstance: null,
};

// =============================================
// Initialization
// =============================================
async function init() {
    // Fetch concurrently for speed
    await Promise.all([fetchCallData(), fetchWebChatsCount()]);
}

// =============================================
// Fetch Call Logs
// =============================================
async function fetchCallData() {
    try {
        const url = `${CALLS_API_URL}?locationId=${CALLS_LOCATION_ID}&page=1&pageSize=10`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${CALLS_BEARER_TOKEN}`,
                'version': API_VERSION
            }
        });

        if (!response.ok) throw new Error(`Calls API error: ${response.status}`);

        const data = await response.json();
        state.callLogs = data.callLogs || [];
        state.totalCalls = data.total || 0;

        renderCallKPIs();
        renderChart();

    } catch (error) {
        console.error('Failed to fetch call data:', error);
        // Show fallback values
        const totalEl = document.getElementById('kpi-total-calls');
        const actionsEl = document.getElementById('kpi-actions');
        const durEl = document.getElementById('kpi-total-duration');
        const avgEl = document.getElementById('kpi-avg-duration');
        if (totalEl) totalEl.textContent = '-';
        if (actionsEl) actionsEl.textContent = '-';
        if (durEl) durEl.textContent = '-';
        if (avgEl) avgEl.textContent = '-';
    }
}

// =============================================
// Fetch Web Chats Count
// =============================================
async function fetchWebChatsCount() {
    try {
        const url = `${WEBCHATS_API_URL}?locationId=${WEBCHATS_LOCATION_ID}&limit=1&lastMessageType=TYPE_LIVE_CHAT`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${WEBCHATS_BEARER_TOKEN}`,
                'Version': API_VERSION
            }
        });

        if (!response.ok) throw new Error(`WebChats API error: ${response.status}`);

        const data = await response.json();
        state.totalWebChats = data.total || 0;

        const el = document.getElementById('kpi-web-chats');
        if (el) {
            el.classList.remove('placeholder-glow', 'w-16', 'h-9', 'rounded');
            el.textContent = state.totalWebChats;
        }

    } catch (error) {
        console.error('Failed to fetch web chats count:', error);
        const el = document.getElementById('kpi-web-chats');
        if (el) el.textContent = '-';
    }
}

// =============================================
// Render Call KPIs
// =============================================
function renderCallKPIs() {
    const totalEl = document.getElementById('kpi-total-calls');
    const actionsEl = document.getElementById('kpi-actions');
    const durEl = document.getElementById('kpi-total-duration');
    const avgEl = document.getElementById('kpi-avg-duration');

    // Remove skeleton classes
    [totalEl, actionsEl, durEl, avgEl].forEach(el => {
        if (el) el.classList.remove('placeholder-glow', 'bg-gray-200', 'w-16', 'h-9', 'w-24', 'h-8', 'rounded', 'block');
    });

    if (totalEl) totalEl.textContent = state.totalCalls;

    let actionsTriggered = 0;
    let totalDurationInSeconds = 0;

    state.callLogs.forEach(log => {
        if (log.executedCallActions) actionsTriggered += log.executedCallActions.length;
        if (log.duration) totalDurationInSeconds += log.duration;
    });

    if (actionsEl) actionsEl.textContent = actionsTriggered;

    const totalMins = Math.round(totalDurationInSeconds / 60);
    if (durEl) durEl.textContent = `${totalMins} Mins`;

    const avgMins = state.callLogs.length > 0
        ? (totalDurationInSeconds / state.callLogs.length / 60).toFixed(1)
        : 0;
    if (avgEl) avgEl.textContent = `${avgMins} Mins`;
}

// =============================================
// Render Chart
// =============================================
function renderChart() {
    const canvas = document.getElementById('callsChart');
    if (!canvas) return;

    if (state.chartInstance) state.chartInstance.destroy();

    let labels = [];
    let dataPoints = [];

    if (state.callLogs.length > 0) {
        const reversed = [...state.callLogs].reverse();
        reversed.forEach(log => {
            const d = new Date(log.createdAt);
            labels.push(`${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`);
            dataPoints.push(log.duration || 0);
        });
    }

    const ctx = canvas.getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Call Duration (s)',
                data: dataPoints,
                borderColor: '#8b5cf6',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#18181b',
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    borderColor: '#27272a',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 }, color: '#a1a1aa' }
                },
                y: {
                    grid: { color: 'rgba(39, 39, 42, 0.5)' },
                    ticks: { font: { size: 11 }, color: '#a1a1aa', beginAtZero: true }
                }
            }
        }
    });
}

// =============================================
// Logout
// =============================================
window.logout = function () {
    localStorage.removeItem('isAuthenticated');
    window.location.href = 'login.html';
};

// =============================================
// Sidebar toggle
// =============================================
window.toggleSubmenu = function(id) {
    const menu = document.getElementById(id);
    const chevron = document.getElementById('aicalls-chevron');
    menu.classList.toggle('hidden');
    if (chevron) {
        chevron.style.transform = menu.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
};

// Call init directly — script is at bottom of body so DOM is already parsed
init();
