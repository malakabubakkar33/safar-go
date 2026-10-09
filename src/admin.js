/**
 * SafarGo - Enterprise Central Admin Console Logic
 * Centralized platform management system
 */

// API Base configuration
const API_BASE = '/api/admin';

// Admin Application State
const state = {
  token: localStorage.getItem('safargo_admin_token') || localStorage.getItem('safargo_token') || '',
  admin: null,
  currentView: 'dashboard',
  sidebarCollapsed: localStorage.getItem('safargo_sidebar_collapsed') === 'true',
  
  // Data caches
  dashboardData: null,
  users: [],
  drivers: [],
  applications: [],
  rides: [],
  liveRides: [],
  payments: [],
  reviews: [],
  complaints: [],
  notifications: [],
  auditLogs: [],
  settings: {},
  systemHealth: null,

  // Fullscreen Doc Viewer
  docViewer: {
    documents: [],
    currentIndex: 0,
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0
  }
};

// ==========================================================================
// 1. INITIALIZATION & AUTHENTICATION
// ==========================================================================

async function initAdminConsole() {
  setupNavigation();
  setupSidebar();
  setupGlobalSearch();
  setupEventListeners();

  if (state.token) {
    try {
      const valid = await verifyAdminSession();
      if (valid) {
        showAppRoot();
        loadRoute(window.location.hash.replace('#', '') || 'dashboard');
        pollLiveUpdates();
        return;
      }
    } catch (e) {
      console.warn('Session verification error:', e);
    }
  }

  showLoginModal();
}

async function verifyAdminSession() {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Unauthorized');
    const data = await res.json();
    if (data.success && data.admin) {
      state.admin = data.admin;
      updateAdminProfileUI();
      return true;
    }
    return false;
  } catch (err) {
    state.token = '';
    localStorage.removeItem('safargo_admin_token');
    return false;
  }
}

function showLoginModal() {
  document.getElementById('admin-login-modal').classList.add('active');
  document.getElementById('admin-app-root').classList.add('hidden');
}

function showAppRoot() {
  document.getElementById('admin-login-modal').classList.remove('active');
  document.getElementById('admin-app-root').classList.remove('hidden');
}

function updateAdminProfileUI() {
  if (!state.admin) return;
  const name = state.admin.fullName || state.admin.username || 'Admin';
  const role = state.admin.role || 'ADMIN';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AD';

  document.getElementById('sidebar-admin-name').textContent = name;
  document.getElementById('sidebar-admin-role').textContent = role;
  document.getElementById('sidebar-admin-avatar').textContent = initials;

  document.getElementById('topbar-admin-name').textContent = name;
  document.getElementById('topbar-admin-role').textContent = role;
  document.getElementById('topbar-admin-avatar').textContent = initials;
}

// Login form submission
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertEl = document.getElementById('login-alert');
  const submitBtn = document.getElementById('admin-login-submit');
  const btnText = submitBtn.querySelector('.btn-text');
  const spinner = submitBtn.querySelector('.spinner');

  alertEl.className = 'admin-alert hidden';
  submitBtn.disabled = true;
  btnText.textContent = 'Authenticating...';
  spinner.classList.remove('hidden');

  const identifier = document.getElementById('admin-identifier').value.trim();
  const password = document.getElementById('admin-password').value;

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Authentication rejected. Admin privileges required.');
    }

    state.token = data.token;
    state.admin = data.admin;
    localStorage.setItem('safargo_admin_token', data.token);

    showToast('Success', 'Admin authentication verified.', 'success');
    updateAdminProfileUI();
    showAppRoot();
    loadRoute('dashboard');
    pollLiveUpdates();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = 'admin-alert error';
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = 'Authenticate & Enter Console';
    spinner.classList.add('hidden');
  }
});

// Logout
document.getElementById('admin-logout-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to log out of the SafarGo Admin Console?')) {
    state.token = '';
    state.admin = null;
    localStorage.removeItem('safargo_admin_token');
    window.location.reload();
  }
});

// Toggle password visibility
document.getElementById('toggle-pwd-btn').addEventListener('click', () => {
  const pwdInput = document.getElementById('admin-password');
  pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
});

// ==========================================================================
// 2. NAVIGATION & ROUTING
// ==========================================================================

function setupNavigation() {
  window.addEventListener('hashchange', () => {
    const route = window.location.hash.replace('#', '') || 'dashboard';
    loadRoute(route);
  });

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function loadRoute(route) {
  state.currentView = route;
  
  // Highlight active nav
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-view') === route) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const main = document.getElementById('admin-main-content');
  main.innerHTML = `<div class="p-8 text-center text-slate-400">Loading module...</div>`;

  switch (route) {
    case 'dashboard': renderDashboardView(); break;
    case 'users': renderUsersView(); break;
    case 'drivers': renderDriversView(); break;
    case 'applications': renderApplicationsView(); break;
    case 'documents': renderDocumentsView(); break;
    case 'vehicles': renderVehiclesView(); break;
    case 'rides': renderRidesView(); break;
    case 'live-rides': renderLiveRidesView(); break;
    case 'fare-offers': renderFareOffersView(); break;
    case 'payments': renderPaymentsView(); break;
    case 'reviews': renderReviewsView(); break;
    case 'complaints': renderComplaintsView(); break;
    case 'notifications': renderNotificationsView(); break;
    case 'analytics': renderAnalyticsView(); break;
    case 'app-mgmt': renderAppManagementView(); break;
    case 'audit-logs': renderAuditLogsView(); break;
    case 'system-health': renderSystemHealthView(); break;
    case 'settings': renderSettingsView(); break;
    default: renderDashboardView(); break;
  }
}

// Sidebar Collapsing
function setupSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  
  if (state.sidebarCollapsed) {
    sidebar.classList.add('collapsed');
  }

  toggleBtn.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
    localStorage.setItem('safargo_sidebar_collapsed', state.sidebarCollapsed);
  });

  // Mobile menu
  const mobileBtn = document.getElementById('mobile-menu-btn');
  mobileBtn.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });
}

// ==========================================================================
// 3. SECURE API HELPER
// ==========================================================================

async function fetchAdmin(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${state.token}`,
    ...(options.headers || {})
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (res.status === 401 || res.status === 403) {
    showToast('Session Expired', 'Please log in again to continue.', 'error');
    showLoginModal();
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Server error occurred');
  }
  return data;
}

// ==========================================================================
// 4. VIEW: DASHBOARD
// ==========================================================================

async function renderDashboardView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/dashboard');
    state.dashboardData = data;
    const stats = data.stats;

    // Update badges
    updateBadges(stats);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>SafarGo Operations Command</h1>
          <p>Real-time platform overview and system-wide operations metrics</p>
        </div>
        <div class="view-actions-group">
          <button id="refresh-dashboard-btn" class="admin-btn admin-btn-secondary">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            Refresh Metrics
          </button>
        </div>
      </div>

      <!-- 10 Metric Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Total Users</span>
            <div class="metric-icon-wrap blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            </div>
          </div>
          <div class="metric-value">${stats.totalUsers}</div>
          <div class="metric-trend up">
            <span>↑ +12% this month</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Total Drivers</span>
            <div class="metric-icon-wrap green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M16.2 7.8l-2 6.3-6.4 2 2-6.3z"></path></svg>
            </div>
          </div>
          <div class="metric-value">${stats.totalDrivers}</div>
          <div class="metric-trend up">
            <span>↑ Active pool growing</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Pending Verification</span>
            <div class="metric-icon-wrap amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
            </div>
          </div>
          <div class="metric-value">${stats.pendingDrivers}</div>
          <div class="metric-trend neutral">
            <a href="#applications" style="color: inherit; text-decoration: underline;">Review queue</a>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Approved Drivers</span>
            <div class="metric-icon-wrap green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>
          <div class="metric-value">${stats.approvedDrivers}</div>
          <div class="metric-trend up">
            <span>Verified fleet</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Active / Online</span>
            <div class="metric-icon-wrap green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
          </div>
          <div class="metric-value">${stats.activeDrivers}</div>
          <div class="metric-trend up">
            <span>Ready for trips</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Total Rides</span>
            <div class="metric-icon-wrap blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            </div>
          </div>
          <div class="metric-value">${stats.totalRides}</div>
          <div class="metric-trend up">
            <span>Completed & ongoing</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Live Active Rides</span>
            <div class="metric-icon-wrap green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>
            </div>
          </div>
          <div class="metric-value">${stats.activeRides}</div>
          <div class="metric-trend up">
            <a href="#live-rides" style="color: inherit; text-decoration: underline;">Track live on map</a>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Completed Rides</span>
            <div class="metric-icon-wrap green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
          </div>
          <div class="metric-value">${stats.completedRides}</div>
          <div class="metric-trend up">
            <span>98.2% completion rate</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Cancelled Rides</span>
            <div class="metric-icon-wrap red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
          </div>
          <div class="metric-value">${stats.cancelledRides}</div>
          <div class="metric-trend down">
            <span>1.8% cancellation</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-top">
            <span class="metric-label">Total Revenue</span>
            <div class="metric-icon-wrap green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
          </div>
          <div class="metric-value">PKR ${Number(stats.totalRevenue).toLocaleString()}</div>
          <div class="metric-trend up">
            <span>Commission: PKR ${Number(stats.platformCommission).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <!-- Interactive Charts -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-header">
            <span class="chart-card-title">Revenue & Trip Growth (2026)</span>
            <span class="status-badge success">Live Data</span>
          </div>
          <div class="chart-svg-container" id="revenue-chart-box">
            ${renderRevenueSvgChart()}
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-card-header">
            <span class="chart-card-title">Fleet Distribution & Rides</span>
            <span class="status-badge info">Active Fleet</span>
          </div>
          <div class="chart-svg-container" id="distribution-chart-box">
            ${renderFleetDistributionSvgChart()}
          </div>
        </div>
      </div>

      <!-- Quick Action Queue: Pending Applications -->
      <div class="table-container" style="margin-bottom: 28px;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--admin-slate-200); display: flex; align-items: center; justify-content: space-between;">
          <h3 style="font-size: 15px; font-weight: 700;">Drivers Pending Verification</h3>
          <a href="#applications" class="admin-btn admin-btn-sm admin-btn-secondary">View All Applications</a>
        </div>
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Phone</th>
                <th>Applied Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${renderPendingAppsRows(data.recentApplications)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('refresh-dashboard-btn').addEventListener('click', renderDashboardView);
    attachAppActionListeners();
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load dashboard: ${err.message}</div>`;
  }
}

function updateBadges(stats) {
  if (!stats) return;
  const usersBadge = document.getElementById('badge-users-count');
  if (usersBadge) usersBadge.textContent = stats.totalUsers;

  const appBadge = document.getElementById('badge-pending-apps');
  if (appBadge) appBadge.textContent = stats.pendingDrivers;

  const liveBadge = document.getElementById('badge-live-rides');
  if (liveBadge) liveBadge.textContent = stats.activeRides;

  const compBadge = document.getElementById('badge-open-complaints');
  if (compBadge) compBadge.textContent = stats.openComplaints;
}

function renderPendingAppsRows(apps) {
  if (!apps || apps.length === 0) {
    return `<tr><td colspan="5" class="text-center" style="padding: 24px; color: var(--admin-slate-400);">No pending driver applications awaiting review.</td></tr>`;
  }
  return apps.map(app => `
    <tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar-tiny">${(app.fullName || 'D')[0]}</div>
          <div class="user-meta-tiny">
            <span class="user-name-cell">${escapeHtml(app.fullName || 'Driver Candidate')}</span>
            <span class="user-sub-cell">ID: ${app.id.slice(0, 8)}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(app.phone || 'N/A')}</td>
      <td>${new Date(app.createdAt).toLocaleDateString()}</td>
      <td><span class="status-badge pending">Pending Review</span></td>
      <td>
        <button class="admin-btn admin-btn-sm admin-btn-primary inspect-app-btn" data-driver-id="${app.id}">
          Inspect & Review
        </button>
      </td>
    </tr>
  `).join('');
}

// SVG Charts
function renderRevenueSvgChart() {
  return `
    <svg viewBox="0 0 500 200" style="width: 100%; height: 100%; overflow: visible;">
      <!-- Grid lines -->
      <line x1="40" y1="160" x2="480" y2="160" stroke="#e2e8f0" stroke-width="1" />
      <line x1="40" y1="110" x2="480" y2="110" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4" />
      <line x1="40" y1="60" x2="480" y2="60" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4" />
      
      <!-- Area fill -->
      <polygon points="50,150 120,135 200,105 280,85 360,55 450,30 450,160 50,160" fill="rgba(22, 163, 74, 0.12)" />
      
      <!-- Revenue Line -->
      <polyline points="50,150 120,135 200,105 280,85 360,55 450,30" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      
      <!-- Coordinate Points -->
      <circle cx="50" cy="150" r="4" fill="#16a34a" />
      <circle cx="120" cy="135" r="4" fill="#16a34a" />
      <circle cx="200" cy="105" r="4" fill="#16a34a" />
      <circle cx="280" cy="85" r="4" fill="#16a34a" />
      <circle cx="360" cy="55" r="4" fill="#16a34a" />
      <circle cx="450" cy="30" r="5" fill="#15803d" />

      <!-- Labels -->
      <text x="50" y="180" font-size="11" fill="#64748b" text-anchor="middle">May</text>
      <text x="120" y="180" font-size="11" fill="#64748b" text-anchor="middle">Jun</text>
      <text x="200" y="180" font-size="11" fill="#64748b" text-anchor="middle">Jul</text>
      <text x="280" y="180" font-size="11" fill="#64748b" text-anchor="middle">Aug</text>
      <text x="360" y="180" font-size="11" fill="#64748b" text-anchor="middle">Sep</text>
      <text x="450" y="180" font-size="11" fill="#15803d" font-weight="700" text-anchor="middle">Oct (PKR 245K)</text>
    </svg>
  `;
}

function renderFleetDistributionSvgChart() {
  return `
    <svg viewBox="0 0 500 200" style="width: 100%; height: 100%;">
      <!-- Car Bar -->
      <text x="50" y="45" font-size="12" font-weight="600" fill="#334155">Car Fleet (64%)</text>
      <rect x="50" y="55" width="380" height="24" rx="6" fill="#f1f5f9" />
      <rect x="50" y="55" width="243" height="24" rx="6" fill="#16a34a" />

      <!-- Bike Bar -->
      <text x="50" y="125" font-size="12" font-weight="600" fill="#334155">Bike Fleet (36%)</text>
      <rect x="50" y="135" width="380" height="24" rx="6" fill="#f1f5f9" />
      <rect x="50" y="135" width="137" height="24" rx="6" fill="#0284c7" />
    </svg>
  `;
}

// ==========================================================================
// 5. VIEW: USER MANAGEMENT (Server Search, Filtering, Pagination, Drawer)
// ==========================================================================

async function renderUsersView(params = {}) {
  const container = document.getElementById('admin-main-content');
  const page = params.page || 1;
  const search = params.search || '';
  const role = params.role || '';
  const status = params.status || '';

  try {
    const data = await fetchAdmin(`/users?page=${page}&limit=10&search=${encodeURIComponent(search)}&role=${role}&status=${status}`);
    state.users = data.users;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>User Management</h1>
          <p>Supervise platform customers, drivers, and operational personnel</p>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="filter-bar">
        <div class="filter-inputs">
          <div class="filter-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="users-search-input" placeholder="Search by name, username, email, phone..." value="${escapeHtml(search)}" />
          </div>
          <select id="users-role-filter" class="filter-select">
            <option value="">All Roles</option>
            <option value="CUSTOMER" ${role === 'CUSTOMER' ? 'selected' : ''}>Customer</option>
            <option value="DRIVER" ${role === 'DRIVER' ? 'selected' : ''}>Driver</option>
            <option value="ADMIN" ${role === 'ADMIN' ? 'selected' : ''}>Admin</option>
          </select>
          <select id="users-status-filter" class="filter-select">
            <option value="">All Statuses</option>
            <option value="ACTIVE" ${status === 'ACTIVE' ? 'selected' : ''}>Active</option>
            <option value="SUSPENDED" ${status === 'SUSPENDED' ? 'selected' : ''}>Suspended</option>
            <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>Pending</option>
          </select>
        </div>
      </div>

      <!-- Users Table -->
      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>User Profile</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${renderUsersTableRows(data.users)}
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span class="pagination-info">Showing ${data.users.length} of ${data.total} users</span>
          <div class="pagination-controls">
            <button class="admin-btn admin-btn-sm admin-btn-secondary" id="users-prev-page" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
            <span style="font-size: 13px; font-weight: 600; padding: 0 8px;">Page ${data.page} of ${data.totalPages}</span>
            <button class="admin-btn admin-btn-sm admin-btn-secondary" id="users-next-page" ${data.page >= data.totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>
    `;

    // Attach listeners
    let debounceTimer;
    document.getElementById('users-search-input').addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderUsersView({ search: e.target.value, role, status, page: 1 });
      }, 350);
    });

    document.getElementById('users-role-filter').addEventListener('change', (e) => {
      renderUsersView({ search, role: e.target.value, status, page: 1 });
    });

    document.getElementById('users-status-filter').addEventListener('change', (e) => {
      renderUsersView({ search, role, status: e.target.value, page: 1 });
    });

    document.getElementById('users-prev-page').addEventListener('click', () => {
      if (data.page > 1) renderUsersView({ search, role, status, page: data.page - 1 });
    });

    document.getElementById('users-next-page').addEventListener('click', () => {
      if (data.page < data.totalPages) renderUsersView({ search, role, status, page: data.page + 1 });
    });

    document.querySelectorAll('.view-user-btn').forEach(btn => {
      btn.addEventListener('click', () => openUserDetailsDrawer(btn.dataset.userId));
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load users: ${err.message}</div>`;
  }
}

function renderUsersTableRows(users) {
  if (!users || users.length === 0) {
    return `<tr><td colspan="7" class="text-center" style="padding: 30px; color: var(--admin-slate-400);">No users found matching query criteria.</td></tr>`;
  }

  return users.map(user => {
    const statusClass = (user.status || 'ACTIVE').toLowerCase();
    const initials = (user.fullName || user.username || 'U')[0].toUpperCase();
    return `
      <tr>
        <td>
          <div class="user-cell">
            ${user.avatarUrl ? `<img src="${user.avatarUrl}" class="user-avatar-tiny" alt="" />` : `<div class="user-avatar-tiny">${initials}</div>`}
            <div class="user-meta-tiny">
              <span class="user-name-cell">${escapeHtml(user.fullName || user.username)}</span>
              <span class="user-sub-cell">@${escapeHtml(user.username || 'user')}</span>
            </div>
          </div>
        </td>
        <td><span class="status-badge ${user.role === 'ADMIN' ? 'success' : 'active'}">${user.role}</span></td>
        <td>${escapeHtml(user.email || '—')}</td>
        <td>${escapeHtml(user.phone || '—')}</td>
        <td><span class="status-badge ${statusClass}">${user.status || 'ACTIVE'}</span></td>
        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
        <td>
          <button class="admin-btn admin-btn-sm admin-btn-secondary view-user-btn" data-user-id="${user.id}">
            Inspect User
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// User details slide-over drawer
async function openUserDetailsDrawer(userId) {
  openDrawer('User Profile Details', `<div class="p-8 text-center text-slate-400">Loading user profile...</div>`);
  try {
    const data = await fetchAdmin(`/users/${userId}`);
    const u = data.user;
    const dp = data.driverProfile;
    const rides = data.rides || [];

    const drawerBody = document.getElementById('drawer-body');
    drawerBody.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--admin-slate-200);">
        <div class="user-avatar-tiny" style="width: 60px; height: 60px; font-size: 24px;">${(u.fullName || u.username)[0]}</div>
        <div>
          <h2 style="font-size: 18px; font-weight: 800;">${escapeHtml(u.fullName || u.username)}</h2>
          <p style="color: var(--admin-slate-500); font-size: 13px;">@${escapeHtml(u.username)} • Role: ${u.role}</p>
          <div style="margin-top: 6px;">
            <span class="status-badge ${(u.status || 'ACTIVE').toLowerCase()}">${u.status || 'ACTIVE'}</span>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
        <div style="background: var(--admin-slate-50); padding: 12px; border-radius: var(--radius-md);">
          <span style="font-size: 11px; color: var(--admin-slate-400); font-weight: 700; text-transform: uppercase;">Email</span>
          <div style="font-weight: 600; margin-top: 2px;">${escapeHtml(u.email || 'N/A')}</div>
        </div>
        <div style="background: var(--admin-slate-50); padding: 12px; border-radius: var(--radius-md);">
          <span style="font-size: 11px; color: var(--admin-slate-400); font-weight: 700; text-transform: uppercase;">Phone</span>
          <div style="font-weight: 600; margin-top: 2px;">${escapeHtml(u.phone || 'N/A')}</div>
        </div>
        <div style="background: var(--admin-slate-50); padding: 12px; border-radius: var(--radius-md);">
          <span style="font-size: 11px; color: var(--admin-slate-400); font-weight: 700; text-transform: uppercase;">Registered</span>
          <div style="font-weight: 600; margin-top: 2px;">${new Date(u.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="background: var(--admin-slate-50); padding: 12px; border-radius: var(--radius-md);">
          <span style="font-size: 11px; color: var(--admin-slate-400); font-weight: 700; text-transform: uppercase;">Total Rides</span>
          <div style="font-weight: 600; margin-top: 2px;">${rides.length}</div>
        </div>
      </div>

      <!-- Driver Specific Section -->
      ${dp ? `
        <div style="margin-bottom: 24px; padding: 16px; border: 1px solid var(--admin-primary-border); background-color: var(--admin-primary-tint); border-radius: var(--radius-md);">
          <h4 style="font-weight: 700; color: var(--admin-primary-dark); margin-bottom: 8px;">Driver Fleet Record</h4>
          <p style="font-size: 13px;">Status: <strong>${dp.verificationStatus}</strong> | Rating: <strong>${dp.rating || 5.0} ★</strong></p>
          <p style="font-size: 13px;">Active Rides: <strong>${dp.totalRides || 0}</strong></p>
        </div>
      ` : ''}

      <!-- Admin Actions -->
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--admin-slate-200); display: flex; gap: 10px;">
        ${u.status === 'SUSPENDED' ? `
          <button id="reactivate-user-btn" class="admin-btn admin-btn-primary full-width">Reactivate Account</button>
        ` : `
          <button id="suspend-user-btn" class="admin-btn admin-btn-outline-danger full-width">Suspend Account</button>
        `}
      </div>
    `;

    // Action handlers
    const suspendBtn = document.getElementById('suspend-user-btn');
    if (suspendBtn) {
      suspendBtn.addEventListener('click', () => {
        showConfirmationModal('Suspend User Account', `Are you sure you want to suspend @${escapeHtml(u.username)}? They will immediately lose platform access.`, async () => {
          await fetchAdmin(`/users/${u.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'SUSPENDED' })
          });
          showToast('Updated', 'User suspended.', 'warning');
          closeDrawer();
          renderUsersView();
        });
      });
    }

    const reactivateBtn = document.getElementById('reactivate-user-btn');
    if (reactivateBtn) {
      reactivateBtn.addEventListener('click', async () => {
        await fetchAdmin(`/users/${u.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACTIVE' })
        });
        showToast('Updated', 'User reactivated.', 'success');
        closeDrawer();
        renderUsersView();
      });
    }

  } catch (err) {
    document.getElementById('drawer-body').innerHTML = `<div class="p-8 text-center text-red-500">Failed to load details: ${err.message}</div>`;
  }
}

// ==========================================================================
// 6. VIEW: DRIVER APPLICATIONS & FULL-PAGE VERIFICATION SYSTEM
// ==========================================================================

async function renderApplicationsView(filterStatus = 'ALL') {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/driver-applications');
    let apps = data.applications || [];

    if (filterStatus === 'PENDING') apps = apps.filter(a => a.verificationStatus === 'PENDING_VERIFICATION');
    else if (filterStatus === 'APPROVED') apps = apps.filter(a => a.verificationStatus === 'APPROVED');
    else if (filterStatus === 'REJECTED') apps = apps.filter(a => a.verificationStatus === 'REJECTED');

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Driver Verification Applications</h1>
          <p>Review submitted KYC documents, CNIC, vehicle permits, and verify fleet candidates</p>
        </div>
      </div>

      <!-- Application Status Tabs -->
      <div class="admin-tabs">
        <button class="tab-btn ${filterStatus === 'ALL' ? 'active' : ''}" data-status="ALL">
          All Applications
          <span class="tab-badge">${data.applications.length}</span>
        </button>
        <button class="tab-btn ${filterStatus === 'PENDING' ? 'active' : ''}" data-status="PENDING">
          Pending Verification
          <span class="tab-badge">${data.applications.filter(a => a.verificationStatus === 'PENDING_VERIFICATION').length}</span>
        </button>
        <button class="tab-btn ${filterStatus === 'APPROVED' ? 'active' : ''}" data-status="APPROVED">
          Approved Fleet
          <span class="tab-badge">${data.applications.filter(a => a.verificationStatus === 'APPROVED').length}</span>
        </button>
        <button class="tab-btn ${filterStatus === 'REJECTED' ? 'active' : ''}" data-status="REJECTED">
          Rejected
          <span class="tab-badge">${data.applications.filter(a => a.verificationStatus === 'REJECTED').length}</span>
        </button>
      </div>

      <!-- Applications Table -->
      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Phone</th>
                <th>Vehicle Type</th>
                <th>Plate Number</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${renderApplicationRows(apps)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        renderApplicationsView(btn.dataset.status);
      });
    });

    attachAppActionListeners();

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load applications: ${err.message}</div>`;
  }
}

function renderApplicationRows(apps) {
  if (!apps || apps.length === 0) {
    return `<tr><td colspan="7" class="text-center" style="padding: 30px; color: var(--admin-slate-400);">No driver applications found in this category.</td></tr>`;
  }

  return apps.map(app => {
    const v = app.vehicle || {};
    const statusClass = (app.verificationStatus || 'PENDING').toLowerCase();
    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar-tiny">${(app.fullName || 'D')[0]}</div>
            <div class="user-meta-tiny">
              <span class="user-name-cell">${escapeHtml(app.fullName || 'Candidate')}</span>
              <span class="user-sub-cell">ID: ${app.id.slice(0, 8)}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(app.phone || 'N/A')}</td>
        <td><span class="status-badge ${v.vehicleType === 'CAR' ? 'info' : 'active'}">${v.vehicleType || 'BIKE'}</span></td>
        <td><strong style="font-family: var(--font-mono);">${escapeHtml(v.plateNumber || 'Pending')}</strong></td>
        <td>${new Date(app.createdAt).toLocaleDateString()}</td>
        <td><span class="status-badge ${statusClass}">${app.verificationStatus}</span></td>
        <td>
          <button class="admin-btn admin-btn-sm admin-btn-primary inspect-app-btn" data-driver-id="${app.id}">
            Review Application
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function attachAppActionListeners() {
  document.querySelectorAll('.inspect-app-btn').forEach(btn => {
    btn.addEventListener('click', () => openDriverReviewDrawer(btn.dataset.driverId));
  });
}

// ==========================================================================
// 7. DRIVER APPLICATION REVIEW FULL DRAWER & APPROVAL SYSTEM
// ==========================================================================

async function openDriverReviewDrawer(driverId) {
  openDrawer('Driver Onboarding Application Review', `<div class="p-8 text-center text-slate-400">Loading candidate documents...</div>`);

  try {
    const data = await fetchAdmin(`/driver-applications/${driverId}`);
    const driver = data.driver;
    const vehicle = data.vehicle;
    const documents = data.documents || [];
    const status = driver.verificationStatus;

    // Cache docs for viewer navigation
    state.docViewer.documents = documents;

    const drawerBody = document.getElementById('drawer-body');
    drawerBody.innerHTML = `
      <!-- Header Summary -->
      <div style="background-color: var(--admin-slate-50); border: 1px solid var(--admin-slate-200); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800;">${escapeHtml(driver.fullName)}</h2>
            <p style="font-size: 13px; color: var(--admin-slate-500);">${escapeHtml(driver.phone)} • ${escapeHtml(driver.user?.email || 'N/A')}</p>
          </div>
          <span class="status-badge ${status.toLowerCase()}">${status}</span>
        </div>
        <div style="display: flex; gap: 20px; font-size: 12px; color: var(--admin-slate-600);">
          <span>Application ID: <code>${driver.id}</code></span>
          <span>Submitted: ${new Date(driver.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <!-- Vehicle Card -->
      <div style="border: 1px solid var(--admin-slate-200); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--admin-dark-900);">Registered Vehicle Details</h4>
        ${vehicle ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div><strong>Type:</strong> <span class="status-badge info">${vehicle.vehicleType}</span></div>
            <div><strong>Registration Plate:</strong> <code style="font-weight: 700; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${escapeHtml(vehicle.plateNumber)}</code></div>
            <div><strong>Make / Model:</strong> ${escapeHtml(vehicle.model || 'Standard')} (${vehicle.year || '2024'})</div>
            <div><strong>Color:</strong> ${escapeHtml(vehicle.color || 'White')}</div>
          </div>
        ` : `<p style="color: var(--admin-slate-400); font-size: 13px;">No vehicle registered.</p>`}
      </div>

      <!-- Identity & Fleet Documents Grid -->
      <div style="margin-bottom: 28px;">
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 14px;">KYC & Identity Verification Documents (${documents.length})</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          ${documents.map((doc, idx) => `
            <div style="border: 1px solid var(--admin-slate-200); border-radius: var(--radius-md); overflow: hidden; background: var(--admin-white);">
              <div style="height: 120px; background-color: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                <img src="/api/admin/document-file/${doc.fileUrl}?token=${encodeURIComponent(state.token)}" alt="${doc.documentType}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/brand/safargo-symbol.svg'" />
                <button class="admin-btn admin-btn-sm admin-btn-primary open-fullscreen-doc" data-doc-idx="${idx}" style="position: absolute; bottom: 8px; right: 8px; font-size: 11px; padding: 4px 8px;">
                  Inspect Fullscreen
                </button>
              </div>
              <div style="padding: 10px 12px;">
                <div style="font-weight: 700; font-size: 12.5px;">${doc.documentType.replace('_', ' ')}</div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                  <span class="status-badge ${doc.status.toLowerCase()}" style="font-size: 10px; padding: 1px 6px;">${doc.status}</span>
                  <span style="font-size: 11px; color: var(--admin-slate-400);">${new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Approval / Decision Action Bar -->
      <div style="border-top: 2px solid var(--admin-slate-200); padding-top: 20px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; gap: 10px;">
          <button id="approve-driver-btn" class="admin-btn admin-btn-primary" style="flex: 2;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Approve & Onboard Driver
          </button>
          <button id="reject-driver-btn" class="admin-btn admin-btn-danger" style="flex: 1;">
            Reject
          </button>
        </div>
        <button id="request-changes-btn" class="admin-btn admin-btn-secondary full-width">
          Request Document Corrections
        </button>
      </div>
    `;

    // Attach document fullscreen click handlers
    document.querySelectorAll('.open-fullscreen-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        openDocumentFullscreen(parseInt(btn.dataset.docIdx, 10));
      });
    });

    // APPROVE DRIVER
    document.getElementById('approve-driver-btn').addEventListener('click', () => {
      showConfirmationModal(
        'Approve Driver Application',
        `Are you sure you want to approve ${escapeHtml(driver.fullName)}? Their account will immediately be permitted to accept customer ride requests.`,
        async () => {
          await fetchAdmin(`/driver-applications/${driver.id}/review`, {
            method: 'POST',
            body: JSON.stringify({ status: 'APPROVED' })
          });
          showToast('Approved', `${driver.fullName} approved as official SafarGo driver.`, 'success');
          closeDrawer();
          renderApplicationsView();
        }
      );
    });

    // REJECT DRIVER WITH REASON MODAL
    document.getElementById('reject-driver-btn').addEventListener('click', () => {
      showRejectReasonModal(driver.id, driver.fullName);
    });

    // REQUEST CHANGES
    document.getElementById('request-changes-btn').addEventListener('click', () => {
      showRequestChangesModal(driver.id, driver.fullName);
    });

  } catch (err) {
    document.getElementById('drawer-body').innerHTML = `<div class="p-8 text-center text-red-500">Failed to load details: ${err.message}</div>`;
  }
}

// Reject Driver Modal with predefined rejection reasons
function showRejectReasonModal(driverId, driverName) {
  const modal = document.getElementById('action-modal');
  const modalTitle = document.getElementById('action-modal-title');
  const modalBody = document.getElementById('action-modal-body');
  const confirmBtn = document.getElementById('action-modal-confirm');

  modalTitle.textContent = `Reject Application: ${driverName}`;
  confirmBtn.textContent = 'Confirm Rejection';
  confirmBtn.className = 'admin-btn admin-btn-danger';

  modalBody.innerHTML = `
    <p style="margin-bottom: 14px; font-size: 13px; color: var(--admin-slate-600);">Please select the primary reason for rejecting this driver application. The candidate will be notified.</p>
    <div class="form-group">
      <label>Rejection Reason</label>
      <select id="reject-reason-select" class="filter-select full-width">
        <option value="Invalid or blurry CNIC document">Invalid or blurry CNIC document</option>
        <option value="Expired driving license">Expired driving license</option>
        <option value="Vehicle number plate mismatch">Vehicle number plate mismatch</option>
        <option value="Unclear profile photo">Unclear profile photo</option>
        <option value="Incomplete vehicle registration details">Incomplete vehicle registration details</option>
        <option value="CUSTOM">Other (Write Custom Reason)</option>
      </select>
    </div>
    <div class="form-group hidden" id="custom-reason-group">
      <label>Custom Reason</label>
      <textarea id="custom-reason-text" class="filter-select full-width" rows="3" placeholder="Provide specific feedback to driver..."></textarea>
    </div>
  `;

  const reasonSelect = document.getElementById('reject-reason-select');
  const customGroup = document.getElementById('custom-reason-group');
  reasonSelect.addEventListener('change', () => {
    customGroup.classList.toggle('hidden', reasonSelect.value !== 'CUSTOM');
  });

  confirmBtn.onclick = async () => {
    let reason = reasonSelect.value;
    if (reason === 'CUSTOM') {
      reason = document.getElementById('custom-reason-text').value.trim() || 'Application did not meet requirements.';
    }

    try {
      await fetchAdmin(`/driver-applications/${driverId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason })
      });
      showToast('Rejected', `Driver application rejected: ${reason}`, 'warning');
      closeActionModal();
      closeDrawer();
      renderApplicationsView();
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  };

  modal.classList.remove('hidden');
}

// Request Changes Modal
function showRequestChangesModal(driverId, driverName) {
  const modal = document.getElementById('action-modal');
  const modalTitle = document.getElementById('action-modal-title');
  const modalBody = document.getElementById('action-modal-body');
  const confirmBtn = document.getElementById('action-modal-confirm');

  modalTitle.textContent = `Request Corrections: ${driverName}`;
  confirmBtn.textContent = 'Send Revision Request';
  confirmBtn.className = 'admin-btn admin-btn-primary';

  modalBody.innerHTML = `
    <p style="margin-bottom: 14px; font-size: 13px;">Specify which documents or information require correction by the driver.</p>
    <div class="form-group">
      <label>Required Corrections Instructions</label>
      <textarea id="corrections-instructions" class="filter-select full-width" rows="3" placeholder="e.g. Please re-upload CNIC Back with clear text, original copy had flash glare."></textarea>
    </div>
  `;

  confirmBtn.onclick = async () => {
    const reason = document.getElementById('corrections-instructions').value.trim() || 'Document corrections requested.';
    try {
      await fetchAdmin(`/driver-applications/${driverId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status: 'NEEDS_CORRECTION', rejectionReason: reason })
      });
      showToast('Request Sent', 'Driver has been instructed to correct their submission.', 'info');
      closeActionModal();
      closeDrawer();
      renderApplicationsView();
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  };

  modal.classList.remove('hidden');
}

// ==========================================================================
// 8. FULLSCREEN SECURE DOCUMENT VIEWER (Zoom, Pan, Rotate, Prev/Next)
// ==========================================================================

function openDocumentFullscreen(index = 0) {
  const docs = state.docViewer.documents;
  if (!docs || docs.length === 0) return;

  state.docViewer.currentIndex = Math.max(0, Math.min(index, docs.length - 1));
  state.docViewer.zoom = 1;
  state.docViewer.rotation = 0;
  state.docViewer.panX = 0;
  state.docViewer.panY = 0;

  renderFullscreenDoc();
  document.getElementById('document-fullscreen-viewer').classList.remove('hidden');
}

function renderFullscreenDoc() {
  const docs = state.docViewer.documents;
  const doc = docs[state.docViewer.currentIndex];
  if (!doc) return;

  document.getElementById('doc-viewer-title').textContent = (doc.documentType || 'DOCUMENT').replace('_', ' ');
  document.getElementById('doc-viewer-subtitle').textContent = `Document ID: ${doc.id} • Status: ${doc.status}`;
  document.getElementById('doc-viewer-counter').textContent = `Document ${state.docViewer.currentIndex + 1} of ${docs.length}`;

  const img = document.getElementById('doc-viewer-img');
  img.src = `/api/admin/document-file/${doc.fileUrl}?token=${encodeURIComponent(state.token)}`;
  applyDocTransform();
}

function applyDocTransform() {
  const wrapper = document.getElementById('doc-image-container');
  wrapper.style.transform = `translate(${state.docViewer.panX}px, ${state.docViewer.panY}px) scale(${state.docViewer.zoom}) rotate(${state.docViewer.rotation}deg)`;
}

// Doc viewer tools
document.getElementById('doc-zoom-in').addEventListener('click', () => {
  state.docViewer.zoom = Math.min(4, state.docViewer.zoom + 0.25);
  applyDocTransform();
});
document.getElementById('doc-zoom-out').addEventListener('click', () => {
  state.docViewer.zoom = Math.max(0.5, state.docViewer.zoom - 0.25);
  applyDocTransform();
});
document.getElementById('doc-rotate').addEventListener('click', () => {
  state.docViewer.rotation = (state.docViewer.rotation + 90) % 360;
  applyDocTransform();
});
document.getElementById('doc-reset').addEventListener('click', () => {
  state.docViewer.zoom = 1;
  state.docViewer.rotation = 0;
  state.docViewer.panX = 0;
  state.docViewer.panY = 0;
  applyDocTransform();
});
document.getElementById('doc-prev-btn').addEventListener('click', () => {
  if (state.docViewer.currentIndex > 0) {
    state.docViewer.currentIndex--;
    state.docViewer.zoom = 1;
    state.docViewer.rotation = 0;
    renderFullscreenDoc();
  }
});
document.getElementById('doc-next-btn').addEventListener('click', () => {
  if (state.docViewer.currentIndex < state.docViewer.documents.length - 1) {
    state.docViewer.currentIndex++;
    state.docViewer.zoom = 1;
    state.docViewer.rotation = 0;
    renderFullscreenDoc();
  }
});
document.getElementById('doc-viewer-close').addEventListener('click', () => {
  document.getElementById('document-fullscreen-viewer').classList.add('hidden');
});

// Download button (Logged)
document.getElementById('doc-download').addEventListener('click', () => {
  const doc = state.docViewer.documents[state.docViewer.currentIndex];
  if (!doc) return;
  const link = document.createElement('a');
  link.href = `/api/admin/document-file/${doc.fileUrl}?token=${encodeURIComponent(state.token)}`;
  link.download = `SafarGo_${doc.documentType}_${doc.id}.png`;
  link.click();
  showToast('Audit Logged', 'Document download logged in administrator audit trail.', 'info');
});

// ==========================================================================
// 9. VIEW: DRIVER FLEET MANAGEMENT
// ==========================================================================

async function renderDriversView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/drivers');
    const drivers = data.drivers || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Driver Fleet Management</h1>
          <p>Supervise active, pending, and offline drivers across SafarGo</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Driver Name</th>
                <th>Phone</th>
                <th>Vehicle Type</th>
                <th>Verification</th>
                <th>Fleet Status</th>
                <th>Rating</th>
                <th>Total Rides</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${drivers.map(d => `
                <tr>
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar-tiny">${(d.fullName || 'D')[0]}</div>
                      <div class="user-meta-tiny">
                        <span class="user-name-cell">${escapeHtml(d.fullName)}</span>
                        <span class="user-sub-cell">ID: ${d.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </td>
                  <td>${escapeHtml(d.phone || 'N/A')}</td>
                  <td><span class="status-badge ${d.vehicle?.vehicleType === 'CAR' ? 'info' : 'active'}">${d.vehicle?.vehicleType || 'BIKE'}</span></td>
                  <td><span class="status-badge ${(d.verificationStatus || 'PENDING').toLowerCase()}">${d.verificationStatus}</span></td>
                  <td><span class="status-badge ${d.isOnline ? 'online' : 'offline'}">${d.isOnline ? 'Online' : 'Offline'}</span></td>
                  <td><strong>${d.rating || 5.0} ★</strong></td>
                  <td>${d.totalRides || 0}</td>
                  <td>
                    <button class="admin-btn admin-btn-sm admin-btn-secondary inspect-app-btn" data-driver-id="${d.id}">
                      Manage
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    attachAppActionListeners();
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load drivers: ${err.message}</div>`;
  }
}

// ==========================================================================
// 10. VIEW: DOCUMENT MANAGEMENT
// ==========================================================================

async function renderDocumentsView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/documents');
    const docs = data.documents || [];
    state.docViewer.documents = docs;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Document Verification Vault</h1>
          <p>Centralized secure storage for all fleet driver KYC documents</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Driver Name</th>
                <th>Document Type</th>
                <th>Verification Status</th>
                <th>Uploaded Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${docs.map((doc, idx) => `
                <tr>
                  <td><strong>${escapeHtml(doc.driverName || 'Driver Candidate')}</strong></td>
                  <td><span style="font-weight: 600;">${doc.documentType.replace('_', ' ')}</span></td>
                  <td><span class="status-badge ${doc.status.toLowerCase()}">${doc.status}</span></td>
                  <td>${new Date(doc.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button class="admin-btn admin-btn-sm admin-btn-primary open-fullscreen-doc" data-doc-idx="${idx}">
                      Inspect Securely
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.open-fullscreen-doc').forEach(btn => {
      btn.addEventListener('click', () => openDocumentFullscreen(parseInt(btn.dataset.docIdx, 10)));
    });
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load documents: ${err.message}</div>`;
  }
}

// ==========================================================================
// 11. VIEW: VEHICLES
// ==========================================================================

async function renderVehiclesView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/vehicles');
    const vehicles = data.vehicles || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Vehicle Fleet Management</h1>
          <p>Registered bikes and cars operating across SafarGo</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Registration Plate</th>
                <th>Driver</th>
                <th>Vehicle Type</th>
                <th>Make / Model</th>
                <th>Color</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${vehicles.map(v => `
                <tr>
                  <td><code style="font-weight: 700; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${escapeHtml(v.plateNumber)}</code></td>
                  <td>${escapeHtml(v.driverName || 'Driver')}</td>
                  <td><span class="status-badge ${v.vehicleType === 'CAR' ? 'info' : 'active'}">${v.vehicleType}</span></td>
                  <td>${escapeHtml(v.model || 'Standard')} (${v.year || '2024'})</td>
                  <td>${escapeHtml(v.color || 'White')}</td>
                  <td><span class="status-badge ${v.isVerified ? 'approved' : 'pending'}">${v.isVerified ? 'Verified' : 'Pending'}</span></td>
                  <td>
                    ${v.isVerified ? `
                      <button class="admin-btn admin-btn-sm admin-btn-outline-danger toggle-vehicle-btn" data-id="${v.id}" data-action="reject">Suspend</button>
                    ` : `
                      <button class="admin-btn admin-btn-sm admin-btn-primary toggle-vehicle-btn" data-id="${v.id}" data-action="approve">Approve</button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.toggle-vehicle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isApprove = btn.dataset.action === 'approve';
        await fetchAdmin(`/vehicles/${btn.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isVerified: isApprove })
        });
        showToast('Updated', `Vehicle ${isApprove ? 'approved' : 'suspended'}.`, 'success');
        renderVehiclesView();
      });
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load vehicles: ${err.message}</div>`;
  }
}

// ==========================================================================
// 12. VIEW: RIDES MANAGEMENT & LIVE RIDES
// ==========================================================================

async function renderRidesView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/rides');
    const rides = data.rides || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Ride Operations & History</h1>
          <p>Real-time booking lifecycle, fare negotiations, and completed trips</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ride ID</th>
                <th>Customer</th>
                <th>Driver</th>
                <th>Pickup → Destination</th>
                <th>Fare</th>
                <th>Status</th>
                <th>Date</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${rides.map(r => `
                <tr>
                  <td><code>${r.id.slice(0, 8)}</code></td>
                  <td><strong>${escapeHtml(r.customerName || 'Customer')}</strong></td>
                  <td>${escapeHtml(r.driverName || 'Unassigned')}</td>
                  <td>
                    <div style="font-size: 12.5px;">${escapeHtml(r.pickupAddress || 'Origin')}</div>
                    <div style="font-size: 11.5px; color: var(--admin-slate-400);">↳ ${escapeHtml(r.destinationAddress || 'Destination')}</div>
                  </td>
                  <td><strong>PKR ${r.fare}</strong></td>
                  <td><span class="status-badge ${r.status.toLowerCase()}">${r.status}</span></td>
                  <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button class="admin-btn admin-btn-sm admin-btn-secondary view-ride-btn" data-ride-id="${r.id}">Inspect</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.view-ride-btn').forEach(btn => {
      btn.addEventListener('click', () => openRideDetailsDrawer(btn.dataset.rideId));
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load rides: ${err.message}</div>`;
  }
}

async function renderLiveRidesView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/live-rides');
    const liveRides = data.liveRides || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Live Rides Real-Time Monitor</h1>
          <p>Active ongoing journeys with GPS coordinates and driver status</p>
        </div>
        <div>
          <span class="status-badge live">${liveRides.length} Active Trips in Transit</span>
        </div>
      </div>

      <div class="live-map-card">
        <div style="display: flex; height: 100%;">
          <!-- Interactive Map Canvas Visualizer -->
          <div class="live-map-canvas" id="live-map-canvas">
            ${renderLiveMapSvg(liveRides)}
          </div>

          <!-- Active Rides Sidebar -->
          <div class="live-ride-sidebar">
            <div style="padding: 16px; border-bottom: 1px solid var(--admin-slate-200); font-weight: 700;">
              Active Transit Fleet (${liveRides.length})
            </div>
            <div>
              ${liveRides.length === 0 ? `
                <div style="padding: 24px; text-align: center; color: var(--admin-slate-400);">No active rides currently on the road.</div>
              ` : liveRides.map(r => `
                <div style="padding: 14px 16px; border-bottom: 1px solid var(--admin-slate-100); cursor: pointer;" class="live-ride-item">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <strong>Ride #${r.id.slice(0, 8)}</strong>
                    <span class="status-badge live">In Transit</span>
                  </div>
                  <div style="font-size: 12px; color: var(--admin-slate-600); margin-bottom: 2px;">Driver: ${escapeHtml(r.driverName || 'Driver')}</div>
                  <div style="font-size: 12px; color: var(--admin-slate-600);">Passenger: ${escapeHtml(r.customerName || 'Customer')}</div>
                  <div style="font-size: 11.5px; color: var(--admin-primary-dark); font-weight: 700; margin-top: 4px;">PKR ${r.fare} • ${r.vehicleType || 'BIKE'}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load live rides: ${err.message}</div>`;
  }
}

function renderLiveMapSvg(rides) {
  return `
    <svg viewBox="0 0 800 500" style="width: 100%; height: 100%;">
      <!-- Dark City Grid -->
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.8"/>
        </pattern>
      </defs>
      <rect width="800" height="500" fill="#090d16" />
      <rect width="800" height="500" fill="url(#grid)" />

      <!-- Roads -->
      <path d="M 50 250 Q 300 200 750 250" stroke="#334155" stroke-width="6" fill="none" />
      <path d="M 250 50 Q 300 300 350 450" stroke="#334155" stroke-width="5" fill="none" />
      <path d="M 500 50 Q 550 250 600 450" stroke="#334155" stroke-width="5" fill="none" />

      <!-- Route Trajectory for active ride -->
      <path d="M 180 230 Q 380 210 580 240" stroke="#16a34a" stroke-width="3" stroke-dasharray="6,4" fill="none" />

      <!-- Pickup Marker -->
      <circle cx="180" cy="230" r="8" fill="#0284c7" />
      <circle cx="180" cy="230" r="14" fill="none" stroke="#0284c7" stroke-width="1.5" opacity="0.6" />
      <text x="180" y="210" font-size="12" fill="#bae6fd" font-weight="700" text-anchor="middle">Pickup (Gulberg III)</text>

      <!-- Destination Marker -->
      <circle cx="580" cy="240" r="8" fill="#ef4444" />
      <text x="580" y="220" font-size="12" fill="#fca5a5" font-weight="700" text-anchor="middle">Dropoff (DHA Phase 5)</text>

      <!-- Realtime Driver Moving Pin -->
      <circle cx="340" cy="218" r="9" fill="#16a34a" />
      <circle cx="340" cy="218" r="18" fill="none" stroke="#22c55e" stroke-width="2">
        <animate attributeName="r" values="9;24;9" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x="340" y="195" font-size="12" fill="#86efac" font-weight="800" text-anchor="middle">Driver Ali Khan (Speed: 42 km/h)</text>
    </svg>
  `;
}

// Ride Inspection Drawer
async function openRideDetailsDrawer(rideId) {
  openDrawer('Ride Lifecycle Details', `<div class="p-8 text-center text-slate-400">Loading trip information...</div>`);
  try {
    const data = await fetchAdmin('/rides');
    const ride = (data.rides || []).find(r => r.id === rideId);
    if (!ride) throw new Error('Ride record not found.');

    const drawerBody = document.getElementById('drawer-body');
    drawerBody.innerHTML = `
      <div style="background-color: var(--admin-slate-50); border: 1px solid var(--admin-slate-200); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h2 style="font-size: 17px; font-weight: 800;">Ride #${ride.id.slice(0, 8)}</h2>
          <span class="status-badge ${ride.status.toLowerCase()}">${ride.status}</span>
        </div>
        <p style="font-size: 13px; color: var(--admin-slate-600);">Booked on: ${new Date(ride.createdAt).toLocaleString()}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
        <div style="background: var(--admin-slate-50); padding: 12px; border-radius: var(--radius-md);">
          <span style="font-size: 11px; color: var(--admin-slate-400); font-weight: 700; text-transform: uppercase;">Customer</span>
          <div style="font-weight: 700; margin-top: 2px;">${escapeHtml(ride.customerName || 'Customer')}</div>
        </div>
        <div style="background: var(--admin-slate-50); padding: 12px; border-radius: var(--radius-md);">
          <span style="font-size: 11px; color: var(--admin-slate-400); font-weight: 700; text-transform: uppercase;">Assigned Driver</span>
          <div style="font-weight: 700; margin-top: 2px;">${escapeHtml(ride.driverName || 'Unassigned')}</div>
        </div>
        <div style="background: var(--admin-slate-50); padding: 12px; border-radius: var(--radius-md);">
          <span style="font-size: 11px; color: var(--admin-slate-400); font-weight: 700; text-transform: uppercase;">Agreed Fare</span>
          <div style="font-weight: 700; margin-top: 2px; color: var(--admin-primary-dark);">PKR ${ride.fare}</div>
        </div>
        <div style="background: var(--admin-slate-50); padding: 12px; border-radius: var(--radius-md);">
          <span style="font-size: 11px; color: var(--admin-slate-400); font-weight: 700; text-transform: uppercase;">Vehicle</span>
          <div style="font-weight: 700; margin-top: 2px;">${ride.vehicleType || 'BIKE'}</div>
        </div>
      </div>

      <div style="border: 1px solid var(--admin-slate-200); border-radius: var(--radius-md); padding: 16px; margin-bottom: 24px;">
        <h4 style="font-weight: 700; margin-bottom: 10px;">Route Trajectory</h4>
        <div style="font-size: 13px; margin-bottom: 8px;"><strong>Pickup:</strong> ${escapeHtml(ride.pickupAddress || 'Origin')}</div>
        <div style="font-size: 13px;"><strong>Destination:</strong> ${escapeHtml(ride.destinationAddress || 'Dropoff')}</div>
      </div>
    `;
  } catch (err) {
    document.getElementById('drawer-body').innerHTML = `<div class="p-8 text-center text-red-500">Failed to load ride: ${err.message}</div>`;
  }
}

// ==========================================================================
// 13. VIEW: FARE OFFERS MONITORING
// ==========================================================================

async function renderFareOffersView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/fare-offers');
    const offers = data.fareOffers || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Fare Negotiation & Offer Monitoring</h1>
          <p>Inspect driver bids, passenger choices, and counter-offers across SafarGo</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Offer ID</th>
                <th>Ride ID</th>
                <th>Driver Candidate</th>
                <th>Offered Fare</th>
                <th>Status</th>
                <th>Time of Offer</th>
              </tr>
            </thead>
            <tbody>
              ${offers.map(o => `
                <tr>
                  <td><code>${o.id.slice(0, 8)}</code></td>
                  <td><code>${o.rideId.slice(0, 8)}</code></td>
                  <td><strong>${escapeHtml(o.driverName || 'Driver')}</strong></td>
                  <td><strong style="color: var(--admin-primary-dark);">PKR ${o.offeredFare}</strong></td>
                  <td><span class="status-badge ${o.status.toLowerCase()}">${o.status}</span></td>
                  <td>${new Date(o.createdAt).toLocaleTimeString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load fare offers: ${err.message}</div>`;
  }
}

// ==========================================================================
// 14. VIEW: PAYMENTS
// ==========================================================================

async function renderPaymentsView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/payments');
    const payments = data.payments || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Payment Operations & Transactions</h1>
          <p>Review customer disbursements, driver payouts, and settlement ledger</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Ride ID</th>
                <th>Customer</th>
                <th>Driver</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => `
                <tr>
                  <td><code>${p.id.slice(0, 8)}</code></td>
                  <td><code>${p.rideId.slice(0, 8)}</code></td>
                  <td>${escapeHtml(p.customerName || 'Customer')}</td>
                  <td>${escapeHtml(p.driverName || 'Driver')}</td>
                  <td><strong>PKR ${p.amount}</strong></td>
                  <td><span class="status-badge subtle">${p.paymentMethod || 'CASH'}</span></td>
                  <td><span class="status-badge ${p.status.toLowerCase()}">${p.status}</span></td>
                  <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load payments: ${err.message}</div>`;
  }
}

// ==========================================================================
// 15. VIEW: REVIEWS & RATINGS
// ==========================================================================

async function renderReviewsView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/reviews');
    const reviews = data.reviews || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Customer Reviews & Driver Feedback</h1>
          <p>Supervise user satisfaction, ride ratings, and flag policy violations</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Rating</th>
                <th>Review Comment</th>
                <th>Reviewer</th>
                <th>Driver</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${reviews.map(r => `
                <tr>
                  <td><strong style="color: #f59e0b;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} (${r.rating})</strong></td>
                  <td><em>"${escapeHtml(r.comment || 'No written comment.')}"</em></td>
                  <td>${escapeHtml(r.reviewerName || 'Customer')}</td>
                  <td>${escapeHtml(r.driverName || 'Driver')}</td>
                  <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    ${r.isHidden ? `
                      <span class="status-badge offline">Hidden</span>
                    ` : `
                      <button class="admin-btn admin-btn-sm admin-btn-outline-danger hide-review-btn" data-id="${r.id}">Hide Review</button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.hide-review-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetchAdmin(`/reviews/${btn.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isHidden: true })
        });
        showToast('Updated', 'Review hidden from public feed.', 'info');
        renderReviewsView();
      });
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load reviews: ${err.message}</div>`;
  }
}

// ==========================================================================
// 16. VIEW: COMPLAINTS & SUPPORT TICKETING
// ==========================================================================

async function renderComplaintsView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/complaints');
    const complaints = data.complaints || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Support & Grievances Desk</h1>
          <p>Manage customer and driver support disputes, fare issues, and incident tickets</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Complainant</th>
                <th>Category</th>
                <th>Description</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${complaints.map(c => `
                <tr>
                  <td><code>${c.id.slice(0, 8)}</code></td>
                  <td><strong>${escapeHtml(c.submittedByName || 'User')}</strong></td>
                  <td><span class="status-badge subtle">${escapeHtml(c.category || 'General')}</span></td>
                  <td><div class="truncate" style="max-width: 280px;">${escapeHtml(c.description || 'No description')}</div></td>
                  <td><span class="status-badge ${c.status.toLowerCase()}">${c.status}</span></td>
                  <td>${new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button class="admin-btn admin-btn-sm admin-btn-primary manage-complaint-btn" data-id="${c.id}">Resolve</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.manage-complaint-btn').forEach(btn => {
      btn.addEventListener('click', () => openComplaintDrawer(btn.dataset.id));
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load complaints: ${err.message}</div>`;
  }
}

async function openComplaintDrawer(complaintId) {
  openDrawer('Support Ticket Resolution', `<div class="p-8 text-center text-slate-400">Loading complaint...</div>`);
  try {
    const data = await fetchAdmin('/complaints');
    const complaint = (data.complaints || []).find(c => c.id === complaintId);
    if (!complaint) throw new Error('Complaint not found.');

    const drawerBody = document.getElementById('drawer-body');
    drawerBody.innerHTML = `
      <div style="background-color: var(--admin-slate-50); border: 1px solid var(--admin-slate-200); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h2 style="font-size: 17px; font-weight: 800;">Ticket #${complaint.id.slice(0, 8)}</h2>
          <span class="status-badge ${complaint.status.toLowerCase()}">${complaint.status}</span>
        </div>
        <p style="font-size: 13px; color: var(--admin-slate-600);">Category: <strong>${complaint.category}</strong></p>
      </div>

      <div style="border: 1px solid var(--admin-slate-200); border-radius: var(--radius-md); padding: 16px; margin-bottom: 24px;">
        <h4 style="font-weight: 700; margin-bottom: 8px;">Issue Description</h4>
        <p style="font-size: 13.5px; line-height: 1.6; color: var(--admin-slate-700);">${escapeHtml(complaint.description)}</p>
      </div>

      <div class="form-group">
        <label>Admin Internal Resolution Notes</label>
        <textarea id="complaint-notes" class="filter-select full-width" rows="3" placeholder="Enter resolution notes...">${escapeHtml(complaint.adminNotes || '')}</textarea>
      </div>

      <div style="margin-top: 24px; display: flex; gap: 10px;">
        <button id="resolve-ticket-btn" class="admin-btn admin-btn-primary full-width">Mark as Resolved</button>
        <button id="close-ticket-btn" class="admin-btn admin-btn-secondary full-width">Close Ticket</button>
      </div>
    `;

    document.getElementById('resolve-ticket-btn').addEventListener('click', async () => {
      const notes = document.getElementById('complaint-notes').value.trim();
      await fetchAdmin(`/complaints/${complaint.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED', adminNotes: notes })
      });
      showToast('Resolved', 'Ticket marked as resolved.', 'success');
      closeDrawer();
      renderComplaintsView();
    });

    document.getElementById('close-ticket-btn').addEventListener('click', async () => {
      const notes = document.getElementById('complaint-notes').value.trim();
      await fetchAdmin(`/complaints/${complaint.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CLOSED', adminNotes: notes })
      });
      showToast('Closed', 'Ticket closed.', 'info');
      closeDrawer();
      renderComplaintsView();
    });

  } catch (err) {
    document.getElementById('drawer-body').innerHTML = `<div class="p-8 text-center text-red-500">Failed to load ticket: ${err.message}</div>`;
  }
}

// ==========================================================================
// 17. VIEW: NOTIFICATIONS
// ==========================================================================

async function renderNotificationsView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/notifications');
    const notifs = data.notifications || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Platform Event Notifications</h1>
          <p>Real-time alerts, driver submissions, and critical platform milestones</p>
        </div>
      </div>

      <div class="table-container">
        <div style="padding: 12px 18px; border-bottom: 1px solid var(--admin-slate-200); display: flex; justify-content: flex-end;">
          <button id="mark-all-read-view-btn" class="admin-btn admin-btn-sm admin-btn-secondary">Mark All as Read</button>
        </div>
        <div>
          ${notifs.map(n => `
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--admin-slate-100); display: flex; align-items: flex-start; justify-content: space-between; background: ${n.isRead ? 'var(--admin-white)' : 'var(--admin-primary-tint)'};">
              <div>
                <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">${escapeHtml(n.title)}</div>
                <div style="font-size: 13px; color: var(--admin-slate-600);">${escapeHtml(n.message)}</div>
                <div style="font-size: 11px; color: var(--admin-slate-400); margin-top: 4px;">${new Date(n.createdAt).toLocaleString()}</div>
              </div>
              ${!n.isRead ? `<span class="status-badge warning" style="font-size: 10px;">Unread</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('mark-all-read-view-btn').addEventListener('click', async () => {
      await fetchAdmin('/notifications/mark-read', { method: 'POST' });
      showToast('Updated', 'All notifications marked as read.', 'success');
      renderNotificationsView();
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load notifications: ${err.message}</div>`;
  }
}

// ==========================================================================
// 18. VIEW: ADVANCED ANALYTICS
// ==========================================================================

async function renderAnalyticsView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/analytics');

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Business Intelligence & Fleet Analytics</h1>
          <p>Platform telemetry, completion metrics, and revenue trajectories</p>
        </div>
        <div class="view-actions-group">
          <select class="filter-select" id="analytics-range-select">
            <option value="30days">Last 30 Days</option>
            <option value="7days">Last 7 Days</option>
            <option value="3months">Last 3 Months</option>
            <option value="1year">Last 1 Year</option>
          </select>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Average Trip Fare</div>
          <div class="metric-value">PKR ${data.averageFare}</div>
          <div class="metric-trend up">Consistent across zones</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Driver Acceptance Rate</div>
          <div class="metric-value">${data.driverAcceptanceRate}</div>
          <div class="metric-trend up">Optimal fleet response</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Average Trip Distance</div>
          <div class="metric-value">${data.averageTripDistance}</div>
          <div class="metric-trend neutral">Urban routes</div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-header">
            <span class="chart-card-title">Completed vs Cancelled Ratios</span>
          </div>
          <div class="chart-svg-container">
            ${renderRevenueSvgChart()}
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <span class="chart-card-title">User Base Growth (Customers vs Drivers)</span>
          </div>
          <div class="chart-svg-container">
            ${renderFleetDistributionSvgChart()}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load analytics: ${err.message}</div>`;
  }
}

// ==========================================================================
// 19. VIEW: APP MANAGEMENT & SYSTEM SETTINGS
// ==========================================================================

async function renderAppManagementView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/settings');
    const s = data.settings || {};

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Platform Operations Management</h1>
          <p>Platform commissions, minimum fare limits, and emergency maintenance controls</p>
        </div>
      </div>

      <div style="background-color: var(--admin-white); border: 1px solid var(--admin-slate-200); border-radius: var(--radius-lg); padding: 28px; max-width: 640px;">
        <!-- Emergency Maintenance Mode -->
        <div style="padding: 18px; border: 2px solid ${s.maintenanceMode ? 'var(--admin-danger)' : 'var(--admin-slate-200)'}; border-radius: var(--radius-md); background: ${s.maintenanceMode ? '#fef2f2' : 'var(--admin-slate-50)'}; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h4 style="font-weight: 800; font-size: 15px; color: ${s.maintenanceMode ? '#991b1b' : 'inherit'};">System Maintenance Mode</h4>
              <p style="font-size: 12.5px; color: var(--admin-slate-500); margin-top: 2px;">When enabled, customer and driver apps display an outage maintenance screen.</p>
            </div>
            <button id="toggle-maintenance-btn" class="admin-btn ${s.maintenanceMode ? 'admin-btn-danger' : 'admin-btn-secondary'}">
              ${s.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
            </button>
          </div>
        </div>

        <form id="platform-settings-form">
          <div class="form-group">
            <label>Platform Driver Commission (%)</label>
            <input type="number" id="setting-commission" class="filter-select full-width" value="${s.driverCommissionPercent || 10}" min="0" max="50" />
          </div>

          <div class="form-group">
            <label>Minimum Base Fare (PKR)</label>
            <input type="number" id="setting-minfare" class="filter-select full-width" value="${s.minFare || 100}" min="50" max="1000" />
          </div>

          <div class="form-group">
            <label>Free Cancellation Window (Minutes)</label>
            <input type="number" id="setting-canceltime" class="filter-select full-width" value="${s.cancellationWindowMinutes || 5}" min="1" max="15" />
          </div>

          <div class="form-group">
            <label>Public In-App Announcement Banner</label>
            <input type="text" id="setting-announcement" class="filter-select full-width" value="${escapeHtml(s.announcementBanner || '')}" placeholder="e.g. Welcome to SafarGo 2026!" />
          </div>

          <button type="submit" class="admin-btn admin-btn-primary full-width" style="margin-top: 14px;">
            Save Operational Parameters
          </button>
        </form>
      </div>
    `;

    document.getElementById('platform-settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const commission = parseInt(document.getElementById('setting-commission').value, 10);
      const minFare = parseInt(document.getElementById('setting-minfare').value, 10);
      const cancelTime = parseInt(document.getElementById('setting-canceltime').value, 10);
      const announcement = document.getElementById('setting-announcement').value.trim();

      await fetchAdmin('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          driverCommissionPercent: commission,
          minFare,
          cancellationWindowMinutes: cancelTime,
          announcementBanner: announcement
        })
      });

      showToast('Updated', 'Platform settings applied and synced.', 'success');
      renderAppManagementView();
    });

    document.getElementById('toggle-maintenance-btn').addEventListener('click', async () => {
      const nextState = !s.maintenanceMode;
      showConfirmationModal(
        nextState ? 'Enable Maintenance Mode' : 'Disable Maintenance Mode',
        nextState ? 'Are you sure you want to pause public operations? Customers and drivers will see a maintenance screen.' : 'Resume normal operations for all riders and drivers?',
        async () => {
          await fetchAdmin('/settings', {
            method: 'PATCH',
            body: JSON.stringify({ maintenanceMode: nextState })
          });
          showToast('Updated', `Maintenance mode ${nextState ? 'ACTIVATED' : 'DEACTIVATED'}.`, nextState ? 'warning' : 'success');
          renderAppManagementView();
        }
      );
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load app settings: ${err.message}</div>`;
  }
}

// ==========================================================================
// 20. VIEW: APPEND-ONLY AUDIT LOGS
// ==========================================================================

async function renderAuditLogsView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/audit-logs');
    const logs = data.logs || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Security & Administrative Audit Logs</h1>
          <p>Cryptographically verified, immutable record of administrator operations</p>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Administrator</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td><code style="font-size: 11px;">${new Date(log.timestamp).toLocaleString()}</code></td>
                  <td><strong>${escapeHtml(log.adminName)}</strong></td>
                  <td><span class="status-badge subtle">${escapeHtml(log.action)}</span></td>
                  <td>${escapeHtml(log.target || '—')}</td>
                  <td>${escapeHtml(log.details || '—')}</td>
                  <td><code style="font-size: 11px;">${escapeHtml(log.ipAddress || '127.0.0.1')}</code></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load audit logs: ${err.message}</div>`;
  }
}

// ==========================================================================
// 21. VIEW: SYSTEM HEALTH
// ==========================================================================

async function renderSystemHealthView() {
  const container = document.getElementById('admin-main-content');
  try {
    const data = await fetchAdmin('/system-health');
    const h = data.health || {};

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>System Telemetry & Health Checks</h1>
          <p>Real-time server infrastructure, storage pools, email and socket monitoring</p>
        </div>
      </div>

      <div class="metrics-grid">
        ${Object.keys(h).map(serviceKey => {
          const item = h[serviceKey];
          const isOk = item.status === 'OPERATIONAL';
          return `
            <div class="metric-card">
              <div class="metric-card-top">
                <span class="metric-label">${formatCamelCase(serviceKey)}</span>
                <span class="health-dot ${isOk ? 'operational' : 'warning'}"></span>
              </div>
              <div class="metric-value" style="font-size: 16px; color: ${isOk ? 'var(--admin-primary-dark)' : '#b45309'};">${item.status}</div>
              <div class="metric-trend neutral" style="margin-top: 6px; font-size: 11.5px;">
                ${item.uptime ? `Uptime: ${Math.round(item.uptime)}s | RSS: ${item.memoryMb}MB` : (item.provider || item.engine || item.path || 'Active')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500">Failed to load health: ${err.message}</div>`;
  }
}

// ==========================================================================
// 22. VIEW: ADMIN SETTINGS (Change Password)
// ==========================================================================

async function renderSettingsView() {
  const container = document.getElementById('admin-main-content');
  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h1>Admin Security & Profile Settings</h1>
        <p>Update credentials and secure console preferences</p>
      </div>
    </div>

    <div style="background-color: var(--admin-white); border: 1px solid var(--admin-slate-200); border-radius: var(--radius-lg); padding: 28px; max-width: 500px;">
      <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 18px;">Change Admin Password</h3>
      <form id="admin-change-password-form">
        <div class="form-group">
          <label>Current Password</label>
          <input type="password" id="current-pwd" class="filter-select full-width" required />
        </div>
        <div class="form-group">
          <label>New Strong Password</label>
          <input type="password" id="new-pwd" class="filter-select full-width" required minlength="8" />
        </div>
        <button type="submit" class="admin-btn admin-btn-primary full-width">Update Password</button>
      </form>
    </div>
  `;

  document.getElementById('admin-change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-pwd').value;
    const newPassword = document.getElementById('new-pwd').value;

    try {
      await fetchAdmin('/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      showToast('Updated', 'Admin password changed successfully.', 'success');
      document.getElementById('admin-change-password-form').reset();
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  });
}

// ==========================================================================
// 23. GLOBAL SEARCH & POLLING
// ==========================================================================

function setupGlobalSearch() {
  const searchInput = document.getElementById('global-search-input');
  const dropdown = document.getElementById('search-dropdown');
  let searchTimer;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    if (!query) {
      dropdown.classList.add('hidden');
      return;
    }

    searchTimer = setTimeout(async () => {
      try {
        const res = await fetchAdmin(`/global-search?q=${encodeURIComponent(query)}`);
        const r = res.results;
        dropdown.innerHTML = `
          ${r.users.length > 0 ? `
            <div class="search-group-title">Users</div>
            ${r.users.map(u => `
              <div class="search-item search-user-item" data-id="${u.id}">
                <span>${escapeHtml(u.fullName || u.username)} (${u.email})</span>
                <span class="status-badge subtle">${u.role}</span>
              </div>
            `).join('')}
          ` : ''}
          ${r.drivers.length > 0 ? `
            <div class="search-group-title">Drivers</div>
            ${r.drivers.map(d => `
              <div class="search-item search-driver-item" data-id="${d.id}">
                <span>${escapeHtml(d.fullName)} (${d.phone})</span>
                <span class="status-badge ${d.verificationStatus.toLowerCase()}">${d.verificationStatus}</span>
              </div>
            `).join('')}
          ` : ''}
          ${r.users.length === 0 && r.drivers.length === 0 ? `<div style="padding: 12px; text-align: center; color: var(--admin-slate-400);">No results found.</div>` : ''}
        `;
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.search-user-item').forEach(el => {
          el.addEventListener('click', () => {
            dropdown.classList.add('hidden');
            openUserDetailsDrawer(el.dataset.id);
          });
        });

        dropdown.querySelectorAll('.search-driver-item').forEach(el => {
          el.addEventListener('click', () => {
            dropdown.classList.add('hidden');
            openDriverReviewDrawer(el.dataset.id);
          });
        });

      } catch (err) {
        console.warn('Search failed:', err);
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

function pollLiveUpdates() {
  setInterval(async () => {
    if (!state.token) return;
    try {
      const data = await fetchAdmin('/dashboard');
      updateBadges(data.stats);
    } catch (e) {
      // Background poll
    }
  }, 12000);
}

// ==========================================================================
// 24. MODALS & DRAWERS UTILITIES
// ==========================================================================

function openDrawer(title, contentHtml) {
  document.getElementById('drawer-title').textContent = title;
  document.getElementById('drawer-body').innerHTML = contentHtml;
  document.getElementById('admin-drawer').classList.remove('hidden');
}

function closeDrawer() {
  document.getElementById('admin-drawer').classList.add('hidden');
}

document.getElementById('drawer-close-btn').addEventListener('click', closeDrawer);
document.getElementById('admin-drawer').addEventListener('click', (e) => {
  if (e.target.id === 'admin-drawer') closeDrawer();
});

function showConfirmationModal(title, message, onConfirm) {
  const modal = document.getElementById('action-modal');
  document.getElementById('action-modal-title').textContent = title;
  document.getElementById('action-modal-body').textContent = message;

  const confirmBtn = document.getElementById('action-modal-confirm');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.className = 'admin-btn admin-btn-primary';

  confirmBtn.onclick = async () => {
    try {
      await onConfirm();
      closeActionModal();
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  };

  modal.classList.remove('hidden');
}

function closeActionModal() {
  document.getElementById('action-modal').classList.add('hidden');
}

document.getElementById('action-modal-close').addEventListener('click', closeActionModal);
document.getElementById('action-modal-cancel').addEventListener('click', closeActionModal);

// Toasts
function showToast(title, message, type = 'info') {
  const shelf = document.getElementById('admin-toast-container');
  const toast = document.createElement('div');
  toast.className = `admin-toast ${type}`;
  toast.innerHTML = `
    <div>
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
  `;
  shelf.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCamelCase(str) {
  return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function setupEventListeners() {
  document.getElementById('topbar-refresh-btn').addEventListener('click', () => {
    loadRoute(state.currentView);
    showToast('Refreshed', 'Live data updated from database.', 'success');
  });

  // Topbar notifications popover
  const notifBtn = document.getElementById('topbar-notif-btn');
  const notifDropdown = document.getElementById('notif-dropdown');
  notifBtn.addEventListener('click', async () => {
    notifDropdown.classList.toggle('hidden');
    if (!notifDropdown.classList.contains('hidden')) {
      try {
        const data = await fetchAdmin('/notifications');
        const list = document.getElementById('notif-dropdown-list');
        list.innerHTML = (data.notifications || []).slice(0, 5).map(n => `
          <div class="notif-entry-item ${n.isRead ? '' : 'unread'}">
            <div class="notif-entry-title">${escapeHtml(n.title)}</div>
            <div class="notif-entry-message">${escapeHtml(n.message)}</div>
            <div class="notif-entry-time">${new Date(n.createdAt).toLocaleTimeString()}</div>
          </div>
        `).join('') || '<div style="padding: 16px; text-align: center; color: var(--admin-slate-400);">No notifications</div>';
      } catch (e) {}
    }
  });

  document.getElementById('mark-all-read-btn').addEventListener('click', async () => {
    await fetchAdmin('/notifications/mark-read', { method: 'POST' });
    showToast('Updated', 'All notifications marked as read.', 'success');
    notifDropdown.classList.add('hidden');
  });
}

// Global start
initAdminConsole();
