// Configuration
const CONTACTS_API = 'https://services.leadconnectorhq.com/contacts/';
const APPOINTMENTS_API = 'https://services.leadconnectorhq.com/contacts/{contactId}/appointments';
const LOCATION_ID = '0BL2s1FXz9zqmSGr7yns';
const BEARER_TOKEN = 'pit-b9cfd4b2-394a-4dc2-a5fe-08373f52bb96';
const API_VERSION = '2021-04-15';

// State
let state = {
    appointments: [],
    isLoading: true,
    searchQuery: '',
    startAfterId: null,
    startAfter: null,
    history: [],
    limit: 20
};

// DOM Elements
const els = {
    tableBody: document.getElementById('appointments-table-body'),
    paginationInfo: document.getElementById('pagination-info'),
    paginationControls: document.getElementById('pagination-controls'),
    searchInput: document.getElementById('appointment-search')
};

/**
 * Initialize
 */
function init() {
    setupSearch();
    fetchAppointments();
}

/**
 * Setup search
 */
function setupSearch() {
    if (!els.searchInput) return;
    let timeout = null;
    els.searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            state.searchQuery = e.target.value.trim();
            state.startAfterId = null;
            state.startAfter = null;
            state.history = [];
            fetchAppointments();
        }, 500);
    });
}

/**
 * Fetch contacts, then their appointments concurrently
 */
async function fetchAppointments() {
    state.isLoading = true;
    renderSkeletons();

    try {
        // Step 1: Fetch contacts
        let url = `${CONTACTS_API}?locationId=${LOCATION_ID}&limit=${state.limit}`;
        if (state.searchQuery) url += `&query=${encodeURIComponent(state.searchQuery)}`;
        if (state.startAfterId) url += `&startAfterId=${state.startAfterId}`;
        if (state.startAfter) url += `&startAfter=${state.startAfter}`;

        const contactsRes = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'version': API_VERSION
            }
        });

        if (!contactsRes.ok) throw new Error(`Contacts API error: ${contactsRes.status}`);
        const contactsData = await contactsRes.json();
        const contacts = contactsData.contacts || [];

        // Step 2: Fetch appointments for each contact concurrently
        const appointmentFetches = contacts.map(async (contact) => {
            try {
                const apptUrl = APPOINTMENTS_API.replace('{contactId}', contact.id);
                const res = await fetch(apptUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${BEARER_TOKEN}`,
                        'Version': API_VERSION
                    }
                });
                if (!res.ok) return [];
                const data = await res.json();
                const events = data.events || [];
                // Attach contact info to each event
                return events.map(ev => ({ ...ev, contact }));
            } catch {
                return [];
            }
        });

        const results = await Promise.all(appointmentFetches);
        // Flatten all appointments and sort by startTime descending
        state.appointments = results
            .flat()
            .filter(a => !a.deleted)
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

        state.isLoading = false;
        updateUI();

    } catch (error) {
        console.error('Error fetching appointments:', error);
        state.isLoading = false;
        els.tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-accentRed font-medium">Failed to load appointments. Please check connection and token.</td></tr>`;
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
 * Format date string nicely
 */
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
    const s = (status || '').toLowerCase();
    if (s === 'confirmed') return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 uppercase tracking-wide">Confirmed</span>`;
    if (s === 'cancelled') return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-accentRed uppercase tracking-wide">Cancelled</span>`;
    if (s === 'showed') return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 uppercase tracking-wide">Showed</span>`;
    if (s === 'noshow') return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 uppercase tracking-wide">No Show</span>`;
    if (s === 'new') return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wide">New</span>`;
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100/10 text-textMuted uppercase tracking-wide">${status || '-'}</span>`;
}

/**
 * Render appointments table
 */
function renderTable() {
    els.tableBody.innerHTML = '';

    if (state.appointments.length === 0) {
        els.tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-textMuted">No appointments found for current contacts.</td></tr>`;
        return;
    }

    state.appointments.forEach((appt) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/50 transition-colors';

        const contact = appt.contact || {};
        const contactName = contact.firstName
            ? `${contact.firstName} ${contact.lastName || ''}`.trim()
            : appt.title || 'Unknown';
        const initials = contactName.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || '??';
        const phone = contact.phone || '-';
        const email = contact.email || '-';
        const title = appt.title || 'Appointment';
        const status = getStatusBadge(appt.appointmentStatus || appt.appoinmentStatus);
        const startTime = formatDateTime(appt.startTime);
        const endTime = formatDateTime(appt.endTime);

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-accentGreen/10 text-accentGreen flex items-center justify-center font-bold text-xs">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-medium text-textMain">${contactName}</p>
                        <p class="text-[11px] text-textMuted">${phone}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted text-xs">${email}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="font-medium text-textMain">${title}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${status}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-textMain text-xs font-medium">${startTime}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-textMuted text-xs">${endTime}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <span class="text-[10px] text-textMuted font-mono truncate max-w-[100px] block">${appt.calendarId || '-'}</span>
            </td>
        `;
        els.tableBody.appendChild(tr);
    });
}

/**
 * Render pagination
 */
function renderPagination() {
    const count = state.appointments.length;
    els.paginationInfo.textContent = `Showing ${count} appointment${count !== 1 ? 's' : ''}`;

    let html = '';
    const prevDisabled = state.history.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50/10';
    html += `<button onclick="goBack()" class="px-4 py-2 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${prevDisabled}" ${state.history.length === 0 ? 'disabled' : ''}>Previous</button>`;

    const nextDisabled = 'opacity-50 cursor-not-allowed';
    html += `<button onclick="goNext()" class="px-4 py-2 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain hover:bg-gray-50/10">Next</button>`;

    els.paginationControls.innerHTML = html;
}

window.goNext = function () {
    // Save state for history and load next page
    state.history.push({ startAfterId: state.startAfterId, startAfter: state.startAfter });
    // For contacts-based pagination, we don't have simple "next page" without tracking the last contact
    // We'll just re-fetch with the same pagination state for now
    fetchAppointments();
};

window.goBack = function () {
    if (state.history.length === 0) return;
    const prev = state.history.pop();
    state.startAfterId = prev.startAfterId;
    state.startAfter = prev.startAfter;
    fetchAppointments();
};

/**
 * Render skeleton rows
 */
function renderSkeletons() {
    els.tableBody.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-5"><div class="h-4 rounded w-36 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-40 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-32 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-5 rounded-full w-20 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-36 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-36 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-20 ml-auto placeholder-glow"></div></td>
        `;
        els.tableBody.appendChild(tr);
    }
}

// Run directly — DOM is already parsed at bottom of body
init();
