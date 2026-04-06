// Configuration
const API_URL = 'https://services.leadconnectorhq.com/contacts/';
const LOCATION_ID = '0BL2s1FXz9zqmSGr7yns';
const BEARER_TOKEN = 'pit-b9cfd4b2-394a-4dc2-a5fe-08373f52bb96';
const API_VERSION = '2021-04-15'; // Common version for contacts API

// State
let state = {
    contacts: [],
    total: 0,
    page: 1, // Not used strictly like page in contacts API, it uses startAfter/startAfterId
    limit: 20,
    isLoading: true,
    searchQuery: '',
    // Pagination tracking
    startAfterId: null,
    startAfter: null,
    history: [] // To support "Previous" button
};

// DOM Elements
const els = {
    tableBody: document.getElementById('leads-table-body'),
    paginationInfo: document.getElementById('pagination-info'),
    paginationControls: document.getElementById('pagination-controls'),
    searchInput: document.getElementById('contact-search')
};

/**
 * Initialization
 */
async function init() {
    setupSearch();
    await fetchContacts();
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
            state.startAfterId = null;
            state.startAfter = null;
            state.history = [];
            fetchContacts();
        }, 500);
    });
}

/**
 * Fetch Contacts from GHL API
 */
async function fetchContacts() {
    state.isLoading = true;
    renderSkeletons();

    try {
        let url = `${API_URL}?locationId=${LOCATION_ID}&limit=${state.limit}`;

        if (state.searchQuery) {
            url += `&query=${encodeURIComponent(state.searchQuery)}`;
        }

        if (state.startAfterId) {
            url += `&startAfterId=${state.startAfterId}`;
        }

        if (state.startAfter) {
            url += `&startAfter=${state.startAfter}`;
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

        state.contacts = data.contacts || [];
        state.total = data.meta?.total || data.count || 0;
        state.isLoading = false;

        updateUI();

    } catch (error) {
        console.error('Error fetching contacts:', error);
        state.isLoading = false;
        els.tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-accentRed font-medium">Failed to load contacts. Please check connection and token.</td></tr>`;
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
 * Render Leads Table
 */
function renderTable() {
    els.tableBody.innerHTML = '';

    if (state.contacts.length === 0) {
        els.tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-textMuted">No contacts found.</td></tr>`;
        return;
    }

    state.contacts.forEach((contact) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/50 transition-colors';

        const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.name || 'Unnamed';
        const initials = name.split(' ').filter(n => n.trim().length > 0).map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() || '??';
        const email = contact.email || '-';
        const source = contact.source || '-';
        const country = contact.country || '-';
        const dateAdded = formatDate(contact.dateAdded);

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        ${initials}
                    </div>
                    <span class="font-medium text-textMain">${name}</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">${email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">${source}</td>
            <td class="px-6 py-4 whitespace-nowrap text-textMuted">${country}</td>
            <td class="px-6 py-4 whitespace-nowrap" id="apt-${contact.id}">
                <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-textMuted text-xs">Loading...</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-textMain">${dateAdded}</td>
        `;

        els.tableBody.appendChild(tr);

        // Fetch appointment for this contact
        const aptCell = document.getElementById(`apt-${contact.id}`);
        fetchAppointments(contact.id, aptCell);
    });
}

/**
 * Fetch Appointments for a contact
 */
async function fetchAppointments(contactId, cellElement) {
    try {
        const url = `https://services.leadconnectorhq.com/contacts/${contactId}/appointments`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'version': '2021-07-28'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                cellElement.innerHTML = '<span class="text-textMuted text-xs">No appointments</span>';
                return;
            }
            throw new Error('Fetch failed');
        }

        const data = await response.json();
        const appointments = data.events || [];

        if (appointments.length > 0) {
            const apt = appointments[0];
            const startTime = new Date(apt.startTime).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            cellElement.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-medium text-textMain text-[11px]">${apt.title || 'Appointment'}</span>
                    <span class="text-[10px] text-textMuted">${startTime} · <span class="capitalize">${apt.appointmentStatus}</span></span>
                </div>
            `;
        } else {
            cellElement.innerHTML = '<span class="text-textMuted text-xs">No appointments</span>';
        }
    } catch (error) {
        console.error(`Error fetching appointments for ${contactId}:`, error);
        cellElement.innerHTML = '<span class="text-accentRed text-xs">Error loading</span>';
    }
}

/**
 * Formats date
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
}

/**
 * Render Pagination
 */
function renderPagination() {
    // HighLevel Contacts API uses cursor-based pagination (startAfterId/startAfter)
    // We'll show "Showing X results" and a "Next" button.
    // "Previous" is harder with this API unless we track history.

    const count = state.contacts.length;
    els.paginationInfo.textContent = `Showing ${count} results`;

    let html = '';

    // Previous Button
    const prevDisabled = state.history.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100';
    html += `<button onclick="goBack()" class="px-4 py-2 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${prevDisabled}" ${state.history.length === 0 ? 'disabled' : ''}>Previous</button>`;

    // Next Button
    const hasMore = count === state.limit;
    const nextDisabled = !hasMore ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100';
    html += `<button onclick="goNext()" class="px-4 py-2 border border-bordercolor bg-surface rounded-lg text-xs font-medium text-textMain ${nextDisabled}" ${!hasMore ? 'disabled' : ''}>Next</button>`;

    els.paginationControls.innerHTML = html;
}

window.goNext = function () {
    if (state.contacts.length === 0) return;

    // Save current state for history
    state.history.push({
        startAfterId: state.startAfterId,
        startAfter: state.startAfter
    });

    const lastContact = state.contacts[state.contacts.length - 1];
    state.startAfterId = lastContact.id;
    state.startAfter = new Date(lastContact.dateAdded).getTime();

    fetchContacts();
};

window.goBack = function () {
    if (state.history.length === 0) return;

    const lastState = state.history.pop();
    state.startAfterId = lastState.startAfterId;
    state.startAfter = lastState.startAfter;

    fetchContacts();
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
            <td class="px-6 py-5"><div class="h-4 rounded w-48 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-24 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-16 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-28 placeholder-glow"></div></td>
            <td class="px-6 py-5"><div class="h-4 rounded w-28 placeholder-glow"></div></td>
        `;
        els.tableBody.appendChild(tr);
    }
}

document.addEventListener('DOMContentLoaded', init);
