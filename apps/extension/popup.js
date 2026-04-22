// Supabase client
const SUPABASE_URL = 'https://ypuaozybbizqtnspmrre.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NIQnYm194zkex7mbrElYjw_M0G3iRW-';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: async (key) => (await chrome.storage.local.get(key))[key] || null,
      setItem: async (key, value) => chrome.storage.local.set({ [key]: value }),
      removeItem: async (key) => chrome.storage.local.remove(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
});
let supabaseUser = null;

// State management
let applications = [];
let links = [];
let currentView = 'applications';
let gamification = {
  streak: 0,
  lastApplicationDate: null,
  level: 1,
  xp: 0,
  prestige: 0,
  longestStreak: 0,
  totalXPEarned: 0,
  weeklyStats: [],
  lastWeeklyCheck: null,
  activityLog: []
};

// Supabase Auth Functions
async function initSupabaseAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    supabaseUser = session.user;
    await loadFromSupabase();
  }
  updateCloudSyncUI();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    supabaseUser = session?.user || null;
    if (supabaseUser) {
      await loadFromSupabase();
    } else {
      await loadData();
    }
    updateCloudSyncUI();
  });
}

async function supabaseLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password.';
    errorEl.style.display = 'block';
    return;
  }

  const loginBtn = document.getElementById('loginBtn');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  errorEl.style.display = 'none';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign In';

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
  } else {
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
  }
}

async function supabaseLogout() {
  await supabaseClient.auth.signOut();
  supabaseUser = null;
  updateCloudSyncUI();
}

function updateCloudSyncUI() {
  const loginForm = document.getElementById('loginForm');
  const loggedInState = document.getElementById('loggedInState');
  const loggedInEmail = document.getElementById('loggedInEmail');

  if (supabaseUser) {
    loginForm.style.display = 'none';
    loggedInState.style.display = 'block';
    loggedInEmail.textContent = supabaseUser.email;
  } else {
    loginForm.style.display = 'block';
    loggedInState.style.display = 'none';
  }
}

// Load applications from Supabase (authoritative, deduplicated source)
async function loadFromSupabase() {
  if (!supabaseUser) return;
  try {
    const { data, error } = await supabaseClient
      .from('jobs')
      .select('id, company_name, role_title, url, date_applied, created_at, position')
      .eq('user_id', supabaseUser.id)
      .order('position', { ascending: false });

    if (error || !data) return;

    applications = data.map((job, i) => ({
      id: job.position ?? i,
      company: job.company_name || '',
      role: job.role_title || '',
      url: job.url || '',
      date: job.created_at || (job.date_applied ? job.date_applied + 'T00:00:00Z' : new Date().toISOString()),
    }));

    renderApplications();
    updateStats();
    renderDailyBadge();
  } catch (err) {
    console.error('Failed to load from Supabase:', err);
  }
}

// Sync a single job to Supabase
async function syncJobToSupabase(app) {
  if (!supabaseUser) return;
  try {
    const { data: existing } = await supabaseClient
      .from('jobs')
      .select('position')
      .eq('user_id', supabaseUser.id)
      .eq('status', 'applied')
      .order('position', { ascending: false })
      .limit(1);
    const nextPos = (existing?.[0]?.position ?? -1) + 1;

    await supabaseClient.from('jobs').insert({
      user_id: supabaseUser.id,
      company_name: app.company,
      role_title: app.role,
      url: app.url || '',
      date_applied: app.date ? app.date.split('T')[0] : null,
      status: 'applied',
      position: nextPos,
    });
  } catch (err) {
    console.error('Failed to sync job to Supabase:', err);
  }
}

// Bulk sync jobs to Supabase
async function syncJobsBulkToSupabase(apps) {
  if (!supabaseUser || apps.length === 0) return;
  try {
    const { data: existing } = await supabaseClient
      .from('jobs')
      .select('position')
      .eq('user_id', supabaseUser.id)
      .eq('status', 'applied')
      .order('position', { ascending: false })
      .limit(1);
    let nextPos = (existing?.[0]?.position ?? -1) + 1;

    const rows = apps.map(app => ({
      user_id: supabaseUser.id,
      company_name: app.company,
      role_title: app.role,
      url: app.url || '',
      date_applied: app.date ? app.date.split('T')[0] : null,
      status: 'applied',
      position: nextPos++,
    }));

    await supabaseClient.from('jobs').insert(rows);
  } catch (err) {
    console.error('Failed to bulk sync jobs to Supabase:', err);
  }
}

// Custom Modal Functions
function showCustomModal(title, message, type = 'alert', defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalInput = document.getElementById('modalInput');
    const modalButtons = document.getElementById('modalButtons');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalButtons.innerHTML = '';

    if (type === 'prompt') {
      modalInput.style.display = 'block';
      modalInput.value = defaultValue;
      modalInput.focus();

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'modal-btn modal-btn-secondary';
      cancelBtn.onclick = () => { modal.classList.remove('show'); resolve(null); };

      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.className = 'modal-btn modal-btn-primary';
      okBtn.onclick = () => { modal.classList.remove('show'); resolve(modalInput.value); };

      modalButtons.appendChild(cancelBtn);
      modalButtons.appendChild(okBtn);

      modalInput.onkeydown = (e) => {
        if (e.key === 'Enter') { modal.classList.remove('show'); resolve(modalInput.value); }
        else if (e.key === 'Escape') { modal.classList.remove('show'); resolve(null); }
      };
    } else if (type === 'confirm') {
      modalInput.style.display = 'none';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'modal-btn modal-btn-secondary';
      cancelBtn.onclick = () => { modal.classList.remove('show'); resolve(false); };

      const okBtn = document.createElement('button');
      okBtn.textContent = 'Confirm';
      okBtn.className = 'modal-btn modal-btn-danger';
      okBtn.onclick = () => { modal.classList.remove('show'); resolve(true); };

      modalButtons.appendChild(cancelBtn);
      modalButtons.appendChild(okBtn);
    } else if (type === 'alert') {
      modalInput.style.display = 'none';

      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.className = 'modal-btn modal-btn-primary modal-btn-full';
      okBtn.onclick = () => { modal.classList.remove('show'); resolve(true); };

      modalButtons.appendChild(okBtn);
    }

    modal.classList.add('show');

    if (type === 'prompt') {
      setTimeout(() => modalInput.focus(), 100);
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
        resolve(type === 'prompt' ? null : false);
      }
    };
  });
}

async function customPrompt(message, defaultValue = '') {
  return await showCustomModal('Input Required', message, 'prompt', defaultValue);
}

async function customConfirm(message) {
  return await showCustomModal('Confirm Action', message, 'confirm');
}

async function customAlert(message) {
  return await showCustomModal('Notification', message, 'alert');
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  await initSupabaseAuth();
});

// Listen for storage changes from other contexts (content script, other popups)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.applications || changes.gamification || changes.links) {
    loadData();
  }
});

// Load data from chrome storage
async function loadData() {
  const result = await chrome.storage.local.get(['applications', 'links', 'gamification', 'floatingButtonEnabled']);
  applications = result.applications || [];
  links = result.links || [];
  gamification = result.gamification || {
    streak: 0,
    lastApplicationDate: null,
    level: 1,
    xp: 0,
    prestige: 0,
    longestStreak: 0,
    totalXPEarned: 0,
    weeklyStats: [],
    lastWeeklyCheck: null,
    activityLog: []
  };

  // Migration: If totalXPEarned is 0 but we have applications, migrate old XP
  if (gamification.totalXPEarned === 0 && applications.length > 0) {
    gamification.totalXPEarned = applications.length * 10;
    await saveGamification();
  }

  updateLevelAndXP();
  await checkWeeklyAverage();

  const toggle = document.getElementById('floatingButtonToggle');
  if (toggle) {
    toggle.checked = result.floatingButtonEnabled || false;
  }

  renderApplications();
  renderLinks();
  updateStats();
  updateStreak();
  renderDailyBadge();
}

// Save data to chrome storage
async function saveApplications() {
  await chrome.storage.local.set({ applications });
  renderApplications();
  updateStats();
  renderDailyBadge();
}

async function saveLinks() {
  await chrome.storage.local.set({ links });
  renderLinks();
}

async function saveGamification() {
  await chrome.storage.local.set({ gamification });
  renderDailyBadge();
}

// Event Listeners
function setupEventListeners() {
  document.getElementById('tabApplications').addEventListener('click', () => switchTab('applications'));
  document.getElementById('tabLinks').addEventListener('click', () => switchTab('links'));
  document.getElementById('tabSettings').addEventListener('click', () => switchTab('settings'));

  document.getElementById('floatingButtonToggle').addEventListener('change', toggleFloatingButton);

  document.getElementById('logCurrentBtn').addEventListener('click', logCurrentJob);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('csvFileInput').click());
  document.getElementById('exportBtn').addEventListener('click', exportToCSV);
  document.getElementById('csvFileInput').addEventListener('change', importFromCSV);
  document.getElementById('searchInput').addEventListener('input', filterApplications);

  document.getElementById('addLinkBtn').addEventListener('click', addNewLink);

  document.getElementById('loginBtn').addEventListener('click', supabaseLogin);
  document.getElementById('logoutBtn').addEventListener('click', supabaseLogout);
  document.getElementById('loginPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') supabaseLogin();
  });
}

// Tab switching
function switchTab(tab) {
  currentView = tab;
  const tabs = { applications: 'tabApplications', links: 'tabLinks', settings: 'tabSettings' };
  const views = { applications: 'applicationsView', links: 'linksView', settings: 'settingsView' };

  Object.values(tabs).forEach(id => document.getElementById(id).classList.remove('active'));
  Object.values(views).forEach(id => document.getElementById(id).classList.add('hidden'));

  document.getElementById(tabs[tab]).classList.add('active');
  document.getElementById(views[tab]).classList.remove('hidden');
}

// Log current job
async function logCurrentJob() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const company = await customPrompt('Company name:');
  if (!company) return;

  const role = await customPrompt('Role/Job title:');
  if (!role) return;

  const multiplier = getStreakMultiplier();
  const xpEarned = Math.floor(10 * multiplier);

  const application = {
    id: Date.now(),
    company,
    role,
    url: tab.url,
    date: new Date().toISOString(),
    xpEarned,
  };

  applications.unshift(application);
  await incrementStreak();
  await awardXP(10, '1 application');
  await saveApplications();
  await syncJobToSupabase(application);
}

// Render applications
function renderApplications(filter = '') {
  const container = document.getElementById('applicationsList');
  const filteredApps = applications.filter(app =>
    app.company.toLowerCase().includes(filter.toLowerCase()) ||
    app.role.toLowerCase().includes(filter.toLowerCase())
  );

  if (filteredApps.length === 0) {
    container.innerHTML = '<p class="empty-state">No applications yet. Click "Log Current" to add one!</p>';
    return;
  }

  container.innerHTML = filteredApps.map(app => createApplicationCard(app)).join('');

  filteredApps.forEach(app => {
    document.getElementById(`edit-${app.id}`).addEventListener('click', () => editApplication(app.id));
    document.getElementById(`delete-${app.id}`).addEventListener('click', () => deleteApplication(app.id));
  });
}

// Create application card HTML
function createApplicationCard(app) {
  const date = new Date(app.date);
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const colors = ['color-blue', 'color-purple', 'color-green', 'color-pink', 'color-amber'];
  const color = colors[Math.abs(app.id) % colors.length];

  return `
    <div class="app-card">
      <div class="app-card-header">
        <div class="app-card-title">
          <div class="color-dot ${color}"></div>
          <h3>${app.company}</h3>
        </div>
        <div class="app-card-actions">
          <button id="edit-${app.id}" class="icon-btn edit">✏️ Edit</button>
          <button id="delete-${app.id}" class="icon-btn delete">🗑</button>
        </div>
      </div>
      <p class="app-card-role">${app.role}</p>
      <p class="app-card-date">📅 ${formattedDate} at ${formattedTime}</p>
      <a href="${app.url}" target="_blank" class="app-card-url">🔗 ${app.url}</a>
    </div>
  `;
}

// Edit application
async function editApplication(id) {
  const app = applications.find(a => a.id === id);
  if (!app) return;

  const company = await customPrompt('Company name:', app.company);
  if (company === null) return;

  const role = await customPrompt('Role/Job title:', app.role);
  if (role === null) return;

  const url = await customPrompt('Job URL:', app.url);
  if (url === null) return;

  app.company = company;
  app.role = role;
  app.url = url;
  saveApplications();
}

// Delete application
async function deleteApplication(id) {
  const confirmed = await customConfirm('Are you sure you want to delete this application?');
  if (!confirmed) return;

  const app = applications.find(a => a.id === id);
  if (!app) return;

  const xpToSubtract = app.xpEarned || 10;
  gamification.totalXPEarned = Math.max(0, (gamification.totalXPEarned || 0) - xpToSubtract);
  addActivityLog('xp_loss', `Lost ${xpToSubtract} XP (deleted application)`, -xpToSubtract);
  updateLevelAndXP();

  applications = applications.filter(a => a.id !== id);
  await saveGamification();
  saveApplications();
}

// Filter applications
function filterApplications(e) {
  renderApplications(e.target.value);
}

// Update stats
function updateStats() {
  document.getElementById('totalCount').textContent = applications.length;
}

// CSV Import
async function importFromCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const csv = event.target.result;
    const lines = csv.split('\n').filter(line => line.trim());

    let validCount = 0;
    let invalidCount = 0;
    const tempApps = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);

      if (parts.length >= 3) {
        const dateStr = parts[2]?.trim() || new Date().toISOString();
        const testDate = new Date(dateStr);

        if (isNaN(testDate.getTime())) {
          invalidCount++;
          console.warn(`Skipping row ${i + 1}: Invalid date "${dateStr}"`);
          continue;
        }

        tempApps.push({
          id: Date.now() + i,
          company: parts[0]?.trim() || '',
          role: parts[1]?.trim() || '',
          date: dateStr,
          url: parts[3]?.trim() || '',
        });
        validCount++;
      }
    }

    tempApps.sort((a, b) => new Date(a.date) - new Date(b.date));

    let totalXPAwarded = 0;
    let currentStreak = 0;
    let lastAppDate = null;

    for (const app of tempApps) {
      const appDate = new Date(app.date);
      const year = appDate.getFullYear();
      const month = String(appDate.getMonth() + 1).padStart(2, '0');
      const day = String(appDate.getDate()).padStart(2, '0');
      const appDateStr = `${year}-${month}-${day}`;

      if (!lastAppDate) {
        currentStreak = 1;
      } else if (lastAppDate === appDateStr) {
        // same day, streak unchanged
      } else {
        const lastDate = new Date(lastAppDate);
        const currentDate = new Date(appDateStr);
        const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) currentStreak++;
        else if (daysDiff > 1) currentStreak = 1;
      }

      lastAppDate = appDateStr;

      let multiplier = 1.0;
      if (currentStreak >= 30) multiplier = 3.0;
      else if (currentStreak >= 14) multiplier = 2.0;
      else if (currentStreak >= 7) multiplier = 1.5;

      const xpEarned = Math.floor(10 * multiplier);
      app.xpEarned = xpEarned;
      totalXPAwarded += xpEarned;
    }

    tempApps.sort((a, b) => new Date(b.date) - new Date(a.date));
    applications.unshift(...tempApps);

    gamification.totalXPEarned = (gamification.totalXPEarned || 0) + totalXPAwarded;
    updateLevelAndXP();

    await saveApplications();
    updateStreak();
    await saveGamification();
    await syncJobsBulkToSupabase(tempApps);

    const message = invalidCount > 0
      ? `CSV imported! ${validCount} valid rows, ${invalidCount} skipped (invalid dates).`
      : `CSV imported successfully! ${validCount} applications added.`;
    await customAlert(message);
  };

  reader.readAsText(file);
  e.target.value = '';
}

// Parse a CSV line properly handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// CSV Export
async function exportToCSV() {
  if (applications.length === 0) {
    await customAlert('No applications to export!');
    return;
  }

  const headers = ['Company', 'Role', 'Date', 'URL'];
  const rows = applications.map(app => [
    `"${app.company}"`,
    `"${app.role}"`,
    `"${app.date}"`,
    `"${app.url}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Links functionality
async function addNewLink() {
  const label = await customPrompt('Link label (e.g., "LinkedIn Profile"):');
  if (!label) return;

  const url = await customPrompt('URL:');
  if (!url) return;

  links.push({ id: Date.now(), label, url });
  saveLinks();
}

function renderLinks() {
  const container = document.getElementById('linksList');

  if (links.length === 0) {
    container.innerHTML = '<p class="empty-state">No links saved yet. Click "Add New Link" to get started!</p>';
    return;
  }

  container.innerHTML = links.map(link => createLinkCard(link)).join('');

  links.forEach(link => {
    document.getElementById(`copy-${link.id}`).addEventListener('click', () => copyToClipboard(link.url));
    document.getElementById(`edit-link-${link.id}`).addEventListener('click', () => editLink(link.id));
    document.getElementById(`delete-link-${link.id}`).addEventListener('click', () => deleteLink(link.id));
  });
}

function createLinkCard(link) {
  return `
    <div class="link-card">
      <div class="link-card-header">
        <h3>${link.label}</h3>
        <div class="link-card-actions">
          <button id="edit-link-${link.id}" class="icon-btn edit">✏️</button>
          <button id="delete-link-${link.id}" class="icon-btn delete">🗑</button>
        </div>
      </div>
      <p class="link-card-url">${link.url}</p>
      <button id="copy-${link.id}" class="copy-btn">
        📋 Copy
      </button>
    </div>
  `;
}

async function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(async () => {
    await customAlert('Copied to clipboard!');
  });
}

async function editLink(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;

  const label = await customPrompt('Link label:', link.label);
  if (label === null) return;

  const url = await customPrompt('URL:', link.url);
  if (url === null) return;

  link.label = label;
  link.url = url;
  saveLinks();
}

async function deleteLink(id) {
  const confirmed = await customConfirm('Are you sure you want to delete this link?');
  if (!confirmed) return;
  links = links.filter(l => l.id !== id);
  saveLinks();
}

// Toggle floating button
async function toggleFloatingButton(e) {
  const enabled = e.target.checked;
  await chrome.storage.local.set({ floatingButtonEnabled: enabled });
}

// Gamification Functions

function updateStreak() {
  if (applications.length === 0) {
    gamification.streak = 0;
    gamification.lastApplicationDate = null;
    gamification.longestStreak = 0;
    return;
  }

  const dates = applications.map(app => {
    const date = new Date(app.date);
    if (isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }).filter(d => d !== null).sort().reverse();

  const uniqueDates = [...new Set(dates)];

  if (uniqueDates.length === 0) {
    gamification.streak = 0;
    gamification.lastApplicationDate = null;
    gamification.longestStreak = 0;
    return;
  }

  const today = new Date();
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const [recentYear, recentMonth, recentDay] = uniqueDates[0].split('-').map(Number);
  const mostRecentDate = new Date(Date.UTC(recentYear, recentMonth - 1, recentDay));
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const daysDiff = Math.floor((todayUTC - mostRecentDate) / (1000 * 60 * 60 * 24));

  let currentStreak = 0;
  if (daysDiff <= 1) {
    let currentDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (!uniqueDates.includes(todayStr)) {
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    }
    for (let i = 0; i < uniqueDates.length; i++) {
      const cy = currentDate.getUTCFullYear();
      const cm = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
      const cd = String(currentDate.getUTCDate()).padStart(2, '0');
      const checkDate = `${cy}-${cm}-${cd}`;
      if (uniqueDates.includes(checkDate)) {
        currentStreak++;
        currentDate.setUTCDate(currentDate.getUTCDate() - 1);
      } else {
        break;
      }
    }
  }

  gamification.streak = currentStreak;
  gamification.lastApplicationDate = uniqueDates[0];

  let maxStreak = 0;
  let tempStreak = 1;
  const sortedDates = [...uniqueDates].sort();
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) tempStreak++;
    else { maxStreak = Math.max(maxStreak, tempStreak); tempStreak = 1; }
  }
  maxStreak = Math.max(maxStreak, tempStreak);
  gamification.longestStreak = Math.max(maxStreak, gamification.longestStreak || 0);
}

async function incrementStreak() {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (!gamification.lastApplicationDate) {
    gamification.streak = 1;
    gamification.lastApplicationDate = todayStr;
    if (gamification.streak > (gamification.longestStreak || 0)) {
      gamification.longestStreak = gamification.streak;
    }
    await saveGamification();
  } else {
    const lastDate = new Date(gamification.lastApplicationDate);
    const lastYear = lastDate.getUTCFullYear();
    const lastMonth = String(lastDate.getUTCMonth() + 1).padStart(2, '0');
    const lastDay = String(lastDate.getUTCDate()).padStart(2, '0');
    const lastDateStr = `${lastYear}-${lastMonth}-${lastDay}`;

    if (lastDateStr === todayStr) return;

    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const lastDateUTC = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
    const daysDiff = Math.floor((todayUTC - lastDateUTC) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      gamification.streak++;
      gamification.lastApplicationDate = todayStr;
    } else if (daysDiff > 1) {
      gamification.streak = 1;
      gamification.lastApplicationDate = todayStr;
    }

    if (gamification.streak > (gamification.longestStreak || 0)) {
      gamification.longestStreak = gamification.streak;
    }
    await saveGamification();
  }
}

function updateLevelAndXP() {
  const totalXP = gamification.totalXPEarned || 0;
  const prestige = Math.floor(totalXP / 5000);
  const xpAfterPrestige = totalXP % 5000;
  const level = Math.floor(xpAfterPrestige / 100) + 1;
  const currentLevelXP = xpAfterPrestige % 100;

  const oldLevel = gamification.level;
  gamification.prestige = prestige;
  gamification.level = level;
  gamification.xp = currentLevelXP;

  if (oldLevel && level > oldLevel) {
    addActivityLog('level_up', `Level up! Now Level ${level}`, 0);
  }
}

function getStreakMultiplier() {
  const streak = gamification.streak || 0;
  if (streak >= 30) return 3.0;
  if (streak >= 14) return 2.0;
  if (streak >= 7) return 1.5;
  return 1.0;
}

function addActivityLog(type, message, xpChange) {
  if (!gamification.activityLog) gamification.activityLog = [];
  gamification.activityLog.unshift({
    timestamp: new Date().toISOString(),
    type,
    message,
    xpChange,
  });
  if (gamification.activityLog.length > 50) {
    gamification.activityLog = gamification.activityLog.slice(0, 50);
  }
}

async function awardXP(baseXP, reason = 'application') {
  const multiplier = getStreakMultiplier();
  const xpEarned = Math.floor(baseXP * multiplier);
  gamification.totalXPEarned = (gamification.totalXPEarned || 0) + xpEarned;

  let message = `Gained ${xpEarned} XP for ${reason}`;
  if (multiplier > 1.0) message += ` (${multiplier}x streak bonus)`;

  addActivityLog('xp_gain', message, xpEarned);
  updateLevelAndXP();
  await saveGamification();
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

async function checkWeeklyAverage() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (!gamification.weeklyStats) gamification.weeklyStats = [];

  if (gamification.lastWeeklyCheck) {
    const lastCheck = new Date(gamification.lastWeeklyCheck);
    const daysSinceCheck = Math.floor((today - lastCheck) / (1000 * 60 * 60 * 24));
    if (daysSinceCheck < 7) return;
  }

  gamification.lastWeeklyCheck = todayStr;

  const thisWeekStart = getWeekStart(today);
  const weekStartDate = new Date(thisWeekStart);
  const thisWeekApps = applications.filter(app => {
    const appDate = new Date(app.date);
    return appDate >= weekStartDate;
  }).length;

  const lastWeekStats = gamification.weeklyStats.length > 0
    ? gamification.weeklyStats[gamification.weeklyStats.length - 1]
    : null;

  gamification.weeklyStats.push({ weekStart: thisWeekStart, appCount: thisWeekApps });
  if (gamification.weeklyStats.length > 12) {
    gamification.weeklyStats = gamification.weeklyStats.slice(-12);
  }

  if (lastWeekStats && thisWeekApps < lastWeekStats.appCount) {
    const xpPenalty = (lastWeekStats.appCount - thisWeekApps) * 5;
    gamification.totalXPEarned = Math.max(0, (gamification.totalXPEarned || 0) - xpPenalty);
    addActivityLog('penalty', `Weekly penalty: -${xpPenalty} XP`, -xpPenalty);
    updateLevelAndXP();
  } else if (lastWeekStats && thisWeekApps > lastWeekStats.appCount) {
    const bonusXP = (thisWeekApps - lastWeekStats.appCount) * 3;
    gamification.totalXPEarned = (gamification.totalXPEarned || 0) + bonusXP;
    addActivityLog('bonus', `Weekly bonus: +${bonusXP} XP`, bonusXP);
    updateLevelAndXP();
  }

  await saveGamification();
}

// Daily Badge System
function calculateDailyBadge() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const todayApps = applications.filter(app => {
    const appDate = new Date(app.date);
    if (isNaN(appDate.getTime())) return false;
    appDate.setHours(0, 0, 0, 0);
    return appDate.toISOString().split('T')[0] === todayStr;
  }).length;

  let badge = { name: 'No Badge Yet', icon: '📝', color: '#9ca3af' };
  if (todayApps >= 15) badge = { name: 'Legendary', icon: '⚡', color: '#dc2626' };
  else if (todayApps >= 10) badge = { name: 'Diamond', icon: '💠', color: '#0891b2' };
  else if (todayApps >= 8) badge = { name: 'Platinum', icon: '💎', color: '#06b6d4' };
  else if (todayApps >= 5) badge = { name: 'Gold', icon: '🥇', color: '#eab308' };
  else if (todayApps >= 3) badge = { name: 'Silver', icon: '🥈', color: '#94a3b8' };
  else if (todayApps >= 1) badge = { name: 'Bronze', icon: '🥉', color: '#c2410c' };

  return { ...badge, count: todayApps };
}

function renderDailyBadge() {
  const badge = calculateDailyBadge();

  const badgeIcon = document.getElementById('badgeIcon');
  const badgeName = document.getElementById('badgeName');
  const badgeCount = document.getElementById('badgeCount');

  if (badgeIcon) {
    badgeIcon.textContent = badge.icon;
    if (badge.count >= 10) {
      badgeIcon.style.filter = `drop-shadow(0 0 8px ${badge.color})`;
      badgeIcon.style.fontSize = '40px';
    } else if (badge.count >= 5) {
      badgeIcon.style.filter = `drop-shadow(0 0 6px ${badge.color})`;
      badgeIcon.style.fontSize = '36px';
    } else if (badge.count >= 3) {
      badgeIcon.style.filter = `drop-shadow(0 0 4px ${badge.color})`;
      badgeIcon.style.fontSize = '34px';
    } else {
      badgeIcon.style.filter = 'none';
      badgeIcon.style.fontSize = '32px';
    }
  }

  if (badgeName) badgeName.textContent = badge.name;
  if (badgeCount) badgeCount.textContent = `${badge.count} today`;
}
