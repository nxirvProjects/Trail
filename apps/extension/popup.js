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
  totalXPEarned: 0, // Track total XP earned (not derived from apps)
  weeklyStats: [], // Array of {weekStart: 'YYYY-MM-DD', appCount: number}
  lastWeeklyCheck: null, // Last date weekly check was performed
  activityLog: [] // Array of {timestamp: ISO, type: 'xp_gain'|'level_up'|'penalty', message: string, xpChange: number}
};

// Supabase Auth Functions
async function initSupabaseAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    supabaseUser = session.user;
  }
  updateCloudSyncUI();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    supabaseUser = session?.user || null;
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

    // Set content
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Clear previous buttons
    modalButtons.innerHTML = '';

    if (type === 'prompt') {
      // Show input field
      modalInput.style.display = 'block';
      modalInput.value = defaultValue;
      modalInput.focus();

      // Create buttons
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'modal-btn modal-btn-secondary';
      cancelBtn.onclick = () => {
        modal.classList.remove('show');
        resolve(null);
      };

      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.className = 'modal-btn modal-btn-primary';
      okBtn.onclick = () => {
        modal.classList.remove('show');
        resolve(modalInput.value);
      };

      modalButtons.appendChild(cancelBtn);
      modalButtons.appendChild(okBtn);

      // Handle Enter key
      modalInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          modal.classList.remove('show');
          resolve(modalInput.value);
        } else if (e.key === 'Escape') {
          modal.classList.remove('show');
          resolve(null);
        }
      };
    } else if (type === 'confirm') {
      // Hide input field
      modalInput.style.display = 'none';

      // Create buttons
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'modal-btn modal-btn-secondary';
      cancelBtn.onclick = () => {
        modal.classList.remove('show');
        resolve(false);
      };

      const okBtn = document.createElement('button');
      okBtn.textContent = 'Confirm';
      okBtn.className = 'modal-btn modal-btn-danger';
      okBtn.onclick = () => {
        modal.classList.remove('show');
        resolve(true);
      };

      modalButtons.appendChild(cancelBtn);
      modalButtons.appendChild(okBtn);
    } else if (type === 'alert') {
      // Hide input field
      modalInput.style.display = 'none';

      // Create button
      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.className = 'modal-btn modal-btn-primary modal-btn-full';
      okBtn.onclick = () => {
        modal.classList.remove('show');
        resolve(true);
      };

      modalButtons.appendChild(okBtn);
    }

    // Show modal
    modal.classList.add('show');

    // Focus appropriate element
    if (type === 'prompt') {
      setTimeout(() => modalInput.focus(), 100);
    }

    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
        resolve(type === 'prompt' ? null : false);
      }
    };
  });
}

// Helper functions for different modal types
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
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupEventListeners();
  initSupabaseAuth();
});

// Listen for storage changes from other contexts (content script, other popups)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  // Reload data when storage changes from external sources
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

  // Calculate level and XP based on totalXPEarned
  updateLevelAndXP();

  // Check weekly average (penalties/bonuses)
  await checkWeeklyAverage();

  // Set toggle state
  const toggle = document.getElementById('floatingButtonToggle');
  if (toggle) {
    toggle.checked = result.floatingButtonEnabled || false;
  }

  renderApplications();
  renderLinks();
  updateStats();
  updateStreak();
  renderStats();
}

// Save data to chrome storage
async function saveApplications() {
  await chrome.storage.local.set({ applications });
  renderApplications();
  updateStats();
  renderDailyBadge(); // Update the daily badge
}

async function saveLinks() {
  await chrome.storage.local.set({ links });
  renderLinks();
}

async function saveGamification() {
  await chrome.storage.local.set({ gamification });
  renderStats();
}

// Event Listeners
function setupEventListeners() {
  // Tab switching
  document.getElementById('tabApplications').addEventListener('click', () => switchTab('applications'));
  document.getElementById('tabLinks').addEventListener('click', () => switchTab('links'));
  document.getElementById('tabStats').addEventListener('click', () => switchTab('stats'));
  document.getElementById('tabSettings').addEventListener('click', () => switchTab('settings'));

  // Floating button toggle
  document.getElementById('floatingButtonToggle').addEventListener('change', toggleFloatingButton);

  // Applications actions
  document.getElementById('logCurrentBtn').addEventListener('click', logCurrentJob);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('csvFileInput').click());
  document.getElementById('exportBtn').addEventListener('click', exportToCSV);
  document.getElementById('csvFileInput').addEventListener('change', importFromCSV);
  document.getElementById('searchInput').addEventListener('input', filterApplications);

  // Links actions
  document.getElementById('addLinkBtn').addEventListener('click', addNewLink);

  // Clear data button (if exists)
  const clearDataBtn = document.getElementById('clearDataBtn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', clearAllData);
  }

  // Cloud sync auth buttons
  document.getElementById('loginBtn').addEventListener('click', supabaseLogin);
  document.getElementById('logoutBtn').addEventListener('click', supabaseLogout);
  document.getElementById('loginPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') supabaseLogin();
  });
}

// Tab switching
function switchTab(tab) {
  currentView = tab;
  const appTab = document.getElementById('tabApplications');
  const linksTab = document.getElementById('tabLinks');
  const statsTab = document.getElementById('tabStats');
  const settingsTab = document.getElementById('tabSettings');
  const appView = document.getElementById('applicationsView');
  const linksView = document.getElementById('linksView');
  const statsView = document.getElementById('statsView');
  const settingsView = document.getElementById('settingsView');

  // Remove all active classes
  appTab.classList.remove('active');
  linksTab.classList.remove('active');
  statsTab.classList.remove('active');
  settingsTab.classList.remove('active');
  appView.classList.add('hidden');
  linksView.classList.add('hidden');
  statsView.classList.add('hidden');
  settingsView.classList.add('hidden');

  // Activate the selected tab
  if (tab === 'applications') {
    appTab.classList.add('active');
    appView.classList.remove('hidden');
  } else if (tab === 'links') {
    linksTab.classList.add('active');
    linksView.classList.remove('hidden');
  } else if (tab === 'stats') {
    statsTab.classList.add('active');
    statsView.classList.remove('hidden');
  } else if (tab === 'settings') {
    settingsTab.classList.add('active');
    settingsView.classList.remove('hidden');
  }
}

// Log current job
async function logCurrentJob() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const company = await customPrompt('Company name:');
  if (!company) return;

  const role = await customPrompt('Role/Job title:');
  if (!role) return;

  // Calculate XP with streak multiplier
  const multiplier = getStreakMultiplier();
  const xpEarned = Math.floor(10 * multiplier);

  const application = {
    id: Date.now(),
    company,
    role,
    url: tab.url,
    date: new Date().toISOString(),
    xpEarned: xpEarned // Store XP earned for this application
  };

  applications.unshift(application);
  await incrementStreak();
  await awardXP(10, '1 application'); // Award 10 base XP with streak multiplier
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

  // Add event listeners for edit and delete
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
  const color = colors[app.id % colors.length];

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

  // Find the application to get its XP value
  const app = applications.find(a => a.id === id);
  if (!app) return;

  // Get the XP that was earned for this application (default to 10 for old apps without xpEarned)
  const xpToSubtract = app.xpEarned || 10;

  // Subtract XP for the deleted application
  gamification.totalXPEarned = Math.max(0, (gamification.totalXPEarned || 0) - xpToSubtract);

  // Add activity log entry
  addActivityLog('xp_loss', `Lost ${xpToSubtract} XP (deleted application)`, -xpToSubtract);

  // Update level and XP
  updateLevelAndXP();

  // Remove the application
  applications = applications.filter(a => a.id !== id);

  // Save everything
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
    const tempApps = []; // Store apps temporarily

    // Skip header row and parse all applications first
    for (let i = 1; i < lines.length; i++) {
      // Better CSV parsing that handles quoted fields
      const parts = parseCSVLine(lines[i]);

      if (parts.length >= 3) {
        // Validate the date before adding
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
          url: parts[3]?.trim() || ''
        });
        validCount++;
      }
    }

    // Sort by date (oldest first) to calculate streaks chronologically
    tempApps.sort((a, b) => new Date(a.date) - new Date(b.date));

    let totalXPAwarded = 0;
    let currentStreak = 0;
    let lastAppDate = null;

    // Calculate XP for each app based on the streak at the time it was logged
    for (const app of tempApps) {
      const appDate = new Date(app.date);
      const year = appDate.getFullYear();
      const month = String(appDate.getMonth() + 1).padStart(2, '0');
      const day = String(appDate.getDate()).padStart(2, '0');
      const appDateStr = `${year}-${month}-${day}`;

      // Calculate streak for this application
      if (!lastAppDate) {
        currentStreak = 1;
      } else if (lastAppDate === appDateStr) {
        // Same day, streak stays the same
      } else {
        const lastDate = new Date(lastAppDate);
        const currentDate = new Date(appDateStr);
        const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          // Consecutive day
          currentStreak++;
        } else if (daysDiff > 1) {
          // Streak broken
          currentStreak = 1;
        }
      }

      lastAppDate = appDateStr;

      // Calculate multiplier based on streak at time of this app
      let multiplier = 1.0;
      if (currentStreak >= 30) multiplier = 3.0;
      else if (currentStreak >= 14) multiplier = 2.0;
      else if (currentStreak >= 7) multiplier = 1.5;

      const xpEarned = Math.floor(10 * multiplier);
      app.xpEarned = xpEarned;
      totalXPAwarded += xpEarned;
    }

    // Sort imported apps by date (newest first) to maintain proper order
    tempApps.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Add all applications to the beginning of the array (newest first)
    applications.unshift(...tempApps);

    // Award total XP calculated from historical streaks
    gamification.totalXPEarned = (gamification.totalXPEarned || 0) + totalXPAwarded;

    // Recalculate level and XP based on new total
    updateLevelAndXP();

    // Save applications first
    await saveApplications();

    // Recalculate streak to find longest streak from imported data
    // This must happen after applications are set globally
    updateStreak();

    // Save gamification after streak is recalculated
    await saveGamification();

    // Sync imported jobs to Supabase
    await syncJobsBulkToSupabase(tempApps);

    const message = invalidCount > 0
      ? `CSV imported! ${validCount} valid rows, ${invalidCount} skipped (invalid dates).`
      : `CSV imported successfully! ${validCount} applications added.`;
    await customAlert(message);
  };

  reader.readAsText(file);
  e.target.value = ''; // Reset input
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
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Push the last field
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
    `"${app.url}"`
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

  links.push({
    id: Date.now(),
    label,
    url
  });

  saveLinks();
}

function renderLinks() {
  const container = document.getElementById('linksList');
  
  if (links.length === 0) {
    container.innerHTML = '<p class="empty-state">No links saved yet. Click "Add New Link" to get started!</p>';
    return;
  }

  container.innerHTML = links.map(link => createLinkCard(link)).join('');

  // Add event listeners
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

// Debug function to check gamification state
window.debugGamification = function() {
  console.log('Current gamification state:', gamification);
  console.log('Last application date:', gamification.lastApplicationDate);
  console.log('Current streak:', gamification.streak);
  console.log('Longest streak:', gamification.longestStreak);
};

// Clear all data
async function clearAllData() {
  const confirmed = await customConfirm('Are you sure you want to clear ALL data? This will delete all applications and reset your stats. Your saved links will remain. This action cannot be undone!');
  if (!confirmed) return;

  // Reset applications and gamification only (keep links)
  applications = [];
  gamification = {
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

  // Save cleared data
  await chrome.storage.local.set({ applications, gamification });

  // Re-render everything
  renderApplications();
  updateStats();
  updateStreak();
  renderStats();

  await customAlert('All applications and stats have been cleared successfully!');
}

// Gamification Functions

// Update streak based on application dates
function updateStreak() {
  if (applications.length === 0) {
    gamification.streak = 0;
    gamification.lastApplicationDate = null;
    gamification.longestStreak = 0;
    return;
  }

  // Get unique dates of applications (only the date part, ignore time)
  // Use UTC timezone consistently to avoid issues when moving between timezones
  const dates = applications.map(app => {
    const date = new Date(app.date);
    // Skip invalid dates
    if (isNaN(date.getTime())) return null;
    // Extract UTC date components to be consistent regardless of local timezone
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
  // Use UTC for consistency with how we parse app dates
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // Calculate CURRENT streak (from today backwards)
  // Parse the most recent date string as UTC date
  const [recentYear, recentMonth, recentDay] = uniqueDates[0].split('-').map(Number);
  const mostRecentDate = new Date(Date.UTC(recentYear, recentMonth - 1, recentDay));
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const daysDiff = Math.floor((todayUTC - mostRecentDate) / (1000 * 60 * 60 * 24));

  let currentStreak = 0;
  // If last application was more than 1 day ago, current streak is broken
  if (daysDiff > 1) {
    currentStreak = 0;
  } else {
    // Count consecutive days starting from today or yesterday (using UTC)
    let currentDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    // If no app today, start checking from yesterday
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

  // Calculate LONGEST streak ever from all historical data
  let maxStreak = 0;
  let tempStreak = 1;

  // Sort dates chronologically (oldest to newest) for streak calculation
  const sortedDates = [...uniqueDates].sort();

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);

    const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      tempStreak++;
    } else {
      // Streak broken, check if it was the longest
      maxStreak = Math.max(maxStreak, tempStreak);
      tempStreak = 1;
    }
  }

  // Check the final streak
  maxStreak = Math.max(maxStreak, tempStreak);

  // Update longest streak only if we found a longer one
  gamification.longestStreak = Math.max(maxStreak, gamification.longestStreak || 0);
}

// Update streak when a new application is logged
async function incrementStreak() {
  const today = new Date();
  // Use UTC date string for consistency across timezones
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (!gamification.lastApplicationDate) {
    gamification.streak = 1;
    gamification.lastApplicationDate = todayStr;
    // Update longest streak if current streak is higher
    if (gamification.streak > (gamification.longestStreak || 0)) {
      gamification.longestStreak = gamification.streak;
    }
    await saveGamification();
  } else {
    // Parse the last application date and get UTC date string
    const lastDate = new Date(gamification.lastApplicationDate);
    const lastYear = lastDate.getUTCFullYear();
    const lastMonth = String(lastDate.getUTCMonth() + 1).padStart(2, '0');
    const lastDay = String(lastDate.getUTCDate()).padStart(2, '0');
    const lastDateStr = `${lastYear}-${lastMonth}-${lastDay}`;

    if (lastDateStr === todayStr) {
      // Already applied today, streak stays the same
      return;
    }

    // Calculate day difference using UTC dates
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const lastDateUTC = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
    const daysDiff = Math.floor((todayUTC - lastDateUTC) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      // Consecutive day
      gamification.streak++;
      gamification.lastApplicationDate = todayStr;
    } else if (daysDiff > 1) {
      // Streak broken, restart
      gamification.streak = 1;
      gamification.lastApplicationDate = todayStr;
    }

    // Update longest streak if current streak is higher
    if (gamification.streak > (gamification.longestStreak || 0)) {
      gamification.longestStreak = gamification.streak;
    }

    await saveGamification();
  }
}

// Render stats view
function renderStats() {
  const streakCount = document.getElementById('streakCount');
  const streakIcon = document.getElementById('streakIcon');

  if (streakCount) {
    streakCount.textContent = gamification.streak;
  }

  // Update longest streak display
  const longestStreakEl = document.getElementById('longestStreak');
  if (longestStreakEl) {
    longestStreakEl.textContent = gamification.longestStreak || 0;
  }

  // Update fire icon size based on streak
  if (streakIcon) {
    if (gamification.streak >= 30) {
      streakIcon.style.fontSize = '80px';
      streakIcon.style.filter = 'drop-shadow(0 0 20px rgba(255, 100, 0, 0.8))';
    } else if (gamification.streak >= 14) {
      streakIcon.style.fontSize = '70px';
      streakIcon.style.filter = 'drop-shadow(0 0 15px rgba(255, 100, 0, 0.6))';
    } else if (gamification.streak >= 7) {
      streakIcon.style.fontSize = '60px';
      streakIcon.style.filter = 'drop-shadow(0 0 10px rgba(255, 100, 0, 0.4))';
    } else {
      streakIcon.style.fontSize = '50px';
      streakIcon.style.filter = 'none';
    }
  }

  // Render simple stats
  renderSimpleStats();

  // Render level and XP
  renderLevelAndXP();

  // Render daily badge
  renderDailyBadge();

  // Render activity log
  renderActivityLog();
}

// Render activity log
function renderActivityLog() {
  const container = document.getElementById('activityLogList');
  if (!container) return;

  const activityLog = gamification.activityLog || [];

  if (activityLog.length === 0) {
    container.innerHTML = '<p class="activity-log-empty">No activity yet. Start logging applications to see your progress!</p>';
    return;
  }

  container.innerHTML = activityLog.map(entry => {
    const date = new Date(entry.timestamp);
    const timeAgo = getTimeAgo(date);

    let iconClass = 'activity-log-icon';
    let icon = '📊';

    if (entry.type === 'xp_gain') {
      icon = '✨';
      iconClass += ' activity-log-icon-xp';
    } else if (entry.type === 'xp_loss') {
      icon = '🗑️';
      iconClass += ' activity-log-icon-penalty';
    } else if (entry.type === 'level_up') {
      icon = '🎉';
      iconClass += ' activity-log-icon-levelup';
    } else if (entry.type === 'penalty') {
      icon = '⚠️';
      iconClass += ' activity-log-icon-penalty';
    } else if (entry.type === 'bonus') {
      icon = '🎁';
      iconClass += ' activity-log-icon-bonus';
    }

    let xpBadge = '';
    if (entry.xpChange !== 0) {
      const xpClass = entry.xpChange > 0 ? 'xp-positive' : 'xp-negative';
      const xpSign = entry.xpChange > 0 ? '+' : '';
      xpBadge = `<span class="activity-log-xp ${xpClass}">${xpSign}${entry.xpChange} XP</span>`;
    }

    return `
      <div class="activity-log-entry">
        <span class="${iconClass}">${icon}</span>
        <div class="activity-log-content">
          <p class="activity-log-message">${entry.message}</p>
          <p class="activity-log-time">${timeAgo}</p>
        </div>
        ${xpBadge}
      </div>
    `;
  }).join('');
}

// Helper to get "time ago" string
function getTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  return date.toLocaleDateString();
}

// Calculate and render simple stats
function renderSimpleStats() {
  const now = new Date();

  // Get start of current week (Sunday)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Get start of current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Calculate this week's applications
  const thisWeek = applications.filter(app => {
    const appDate = new Date(app.date);
    if (isNaN(appDate.getTime())) return false;
    return appDate >= startOfWeek;
  }).length;

  // Calculate this month's applications
  const thisMonth = applications.filter(app => {
    const appDate = new Date(app.date);
    if (isNaN(appDate.getTime())) return false;
    return appDate >= startOfMonth;
  }).length;

  // Calculate weekly average
  let weeklyAvg = 0;
  if (applications.length > 0) {
    const dates = applications.map(app => new Date(app.date).getTime()).filter(time => !isNaN(time));
    if (dates.length > 0) {
      const oldestApp = new Date(Math.min(...dates));
      const weeksSinceStart = Math.max(1, Math.ceil((now - oldestApp) / (7 * 24 * 60 * 60 * 1000)));
      weeklyAvg = (applications.length / weeksSinceStart).toFixed(1);
    }
  }

  // Update DOM
  const statsThisWeek = document.getElementById('statsThisWeek');
  const statsThisMonth = document.getElementById('statsThisMonth');
  const statsWeeklyAvg = document.getElementById('statsWeeklyAvg');
  const statsTotal = document.getElementById('statsTotal');

  if (statsThisWeek) statsThisWeek.textContent = thisWeek;
  if (statsThisMonth) statsThisMonth.textContent = thisMonth;
  if (statsWeeklyAvg) statsWeeklyAvg.textContent = weeklyAvg;
  if (statsTotal) statsTotal.textContent = applications.length;
}

// Toggle floating button
async function toggleFloatingButton(e) {
  const enabled = e.target.checked;
  await chrome.storage.local.set({ floatingButtonEnabled: enabled });
}

// Level and XP System

// Calculate level and XP based on totalXPEarned
function updateLevelAndXP() {
  const totalXP = gamification.totalXPEarned || 0;

  // Calculate prestige (every 5000 XP = 1 prestige, which is 500 apps or 50 levels)
  const prestige = Math.floor(totalXP / 5000);
  const xpAfterPrestige = totalXP % 5000;

  // Calculate level (100 XP per level, max 50 levels per prestige)
  const level = Math.floor(xpAfterPrestige / 100) + 1;
  const currentLevelXP = xpAfterPrestige % 100;

  const oldLevel = gamification.level;
  gamification.prestige = prestige;
  gamification.level = level;
  gamification.xp = currentLevelXP;

  // Check for level up and log it
  if (oldLevel && level > oldLevel) {
    addActivityLog('level_up', `Level up! Now Level ${level} - ${getLevelTitle(level)}`, 0);
  }
}

// Get streak XP multiplier based on current streak
function getStreakMultiplier() {
  const streak = gamification.streak || 0;
  if (streak >= 30) return 3.0;
  if (streak >= 14) return 2.0;
  if (streak >= 7) return 1.5;
  return 1.0;
}

// Add activity to log (max 50 entries)
function addActivityLog(type, message, xpChange) {
  if (!gamification.activityLog) {
    gamification.activityLog = [];
  }

  gamification.activityLog.unshift({
    timestamp: new Date().toISOString(),
    type: type,
    message: message,
    xpChange: xpChange
  });

  // Keep only last 50 entries
  if (gamification.activityLog.length > 50) {
    gamification.activityLog = gamification.activityLog.slice(0, 50);
  }
}

// Award XP with streak multiplier
async function awardXP(baseXP, reason = 'application') {
  const multiplier = getStreakMultiplier();
  const xpEarned = Math.floor(baseXP * multiplier);

  gamification.totalXPEarned = (gamification.totalXPEarned || 0) + xpEarned;

  // Create log message
  let message = `Gained ${xpEarned} XP for ${reason}`;
  if (multiplier > 1.0) {
    message += ` (${multiplier}x streak bonus)`;
  }

  addActivityLog('xp_gain', message, xpEarned);
  updateLevelAndXP();
  await saveGamification();
}

// Get the start of the week (Monday) for a given date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

// Check weekly average and apply penalty if needed
async function checkWeeklyAverage() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Initialize if needed
  if (!gamification.weeklyStats) {
    gamification.weeklyStats = [];
  }

  // Only check once per week (on Mondays)
  if (gamification.lastWeeklyCheck) {
    const lastCheck = new Date(gamification.lastWeeklyCheck);
    const daysSinceCheck = Math.floor((today - lastCheck) / (1000 * 60 * 60 * 24));
    if (daysSinceCheck < 7) {
      return; // Already checked this week
    }
  }

  // Update last check date
  gamification.lastWeeklyCheck = todayStr;

  // Calculate this week's app count
  const thisWeekStart = getWeekStart(today);
  const weekStartDate = new Date(thisWeekStart);
  const thisWeekApps = applications.filter(app => {
    const appDate = new Date(app.date);
    return appDate >= weekStartDate;
  }).length;

  // Get last week's stats
  const lastWeekStats = gamification.weeklyStats.length > 0 ?
    gamification.weeklyStats[gamification.weeklyStats.length - 1] : null;

  // Add this week's stats
  gamification.weeklyStats.push({
    weekStart: thisWeekStart,
    appCount: thisWeekApps
  });

  // Keep only last 12 weeks
  if (gamification.weeklyStats.length > 12) {
    gamification.weeklyStats = gamification.weeklyStats.slice(-12);
  }

  // Check if average dropped compared to last week
  if (lastWeekStats && thisWeekApps < lastWeekStats.appCount) {
    const dropAmount = lastWeekStats.appCount - thisWeekApps;
    // Penalty: lose 5 XP per app difference
    const xpPenalty = dropAmount * 5;

    gamification.totalXPEarned = Math.max(0, (gamification.totalXPEarned || 0) - xpPenalty);

    addActivityLog(
      'penalty',
      `Weekly penalty: -${xpPenalty} XP (dropped from ${lastWeekStats.appCount} to ${thisWeekApps} apps/week)`,
      -xpPenalty
    );

    updateLevelAndXP();
  } else if (lastWeekStats && thisWeekApps > lastWeekStats.appCount) {
    // Bonus for improvement!
    const improvement = thisWeekApps - lastWeekStats.appCount;
    const bonusXP = improvement * 3;

    gamification.totalXPEarned = (gamification.totalXPEarned || 0) + bonusXP;

    addActivityLog(
      'bonus',
      `Weekly bonus: +${bonusXP} XP (improved from ${lastWeekStats.appCount} to ${thisWeekApps} apps/week)`,
      bonusXP
    );

    updateLevelAndXP();
  }

  await saveGamification();
}

// Get level title based on level number
function getLevelTitle(level) {
  if (level >= 50) return "Legendary Job Hunter";
  if (level >= 30) return "Career Seeker Elite";
  if (level >= 20) return "Application Master";
  if (level >= 10) return "Job Search Pro";
  if (level >= 5) return "Active Applicant";
  return "Beginner Job Hunter";
}

// Render level and XP
function renderLevelAndXP() {
  const levelNumber = document.getElementById('levelNumber');
  const levelTitle = document.getElementById('levelTitle');
  const prestigeStars = document.getElementById('prestigeStars');
  const currentXP = document.getElementById('currentXP');
  const nextLevelXP = document.getElementById('nextLevelXP');
  const xpFill = document.getElementById('xpFill');

  if (levelNumber) levelNumber.textContent = gamification.level;
  if (levelTitle) levelTitle.textContent = getLevelTitle(gamification.level);

  // Display prestige stars
  if (prestigeStars) {
    if (gamification.prestige > 0) {
      prestigeStars.textContent = '⭐'.repeat(gamification.prestige) + ' ';
    } else {
      prestigeStars.textContent = '';
    }
  }

  if (currentXP) currentXP.textContent = gamification.xp;
  if (nextLevelXP) nextLevelXP.textContent = 100;

  // Update progress bar
  if (xpFill) {
    const percentage = (gamification.xp / 100) * 100;
    xpFill.style.width = `${percentage}%`;
  }
}

// Daily Badge System

// Calculate daily badge based on today's applications
function calculateDailyBadge() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Count applications from today
  const todayApps = applications.filter(app => {
    const appDate = new Date(app.date);
    // Skip invalid dates
    if (isNaN(appDate.getTime())) return false;
    appDate.setHours(0, 0, 0, 0);
    return appDate.toISOString().split('T')[0] === todayStr;
  }).length;

  // Determine badge based on count
  let badge = {
    name: 'No Badge Yet',
    icon: '📝',
    color: '#9ca3af'
  };

  if (todayApps >= 15) {
    badge = { name: 'Legendary', icon: '⚡', color: '#dc2626' }; // Sinister red
  } else if (todayApps >= 10) {
    badge = { name: 'Diamond', icon: '💠', color: '#0891b2' }; // Dark cyan/blue
  } else if (todayApps >= 8) {
    badge = { name: 'Platinum', icon: '💎', color: '#06b6d4' }; // Light cyan/blue
  } else if (todayApps >= 5) {
    badge = { name: 'Gold', icon: '🥇', color: '#eab308' }; // Gold yellow
  } else if (todayApps >= 3) {
    badge = { name: 'Silver', icon: '🥈', color: '#94a3b8' }; // Silver gray
  } else if (todayApps >= 1) {
    badge = { name: 'Bronze', icon: '🥉', color: '#c2410c' }; // Bronze orange
  }

  return { ...badge, count: todayApps };
}

// Render daily badge
function renderDailyBadge() {
  const badge = calculateDailyBadge();

  const badgeIcon = document.getElementById('badgeIcon');
  const badgeName = document.getElementById('badgeName');
  const badgeCount = document.getElementById('badgeCount');

  if (badgeIcon) {
    badgeIcon.textContent = badge.icon;

    // Add glow effect for higher badges (scaled for header)
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

  if (badgeName) {
    badgeName.textContent = badge.name;
  }

  if (badgeCount) {
    badgeCount.textContent = `${badge.count} today`;
  }
}