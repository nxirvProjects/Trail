// Background service worker for Supabase sync
importScripts('supabase.min.js');

const SUPABASE_URL = 'https://ypuaozybbizqtnspmrre.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NIQnYm194zkex7mbrElYjw_M0G3iRW-';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

// Listen for sync requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_JOB_TO_SUPABASE') {
    syncJobToSupabase(message.application)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});

async function syncJobToSupabase(app) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.user) return;

  const userId = session.user.id;

  const { data: existing } = await supabaseClient
    .from('jobs')
    .select('position')
    .eq('user_id', userId)
    .eq('status', 'applied')
    .order('position', { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  await supabaseClient.from('jobs').insert({
    user_id: userId,
    company_name: app.company,
    role_title: app.role,
    url: app.url || '',
    date_applied: app.date ? app.date.split('T')[0] : null,
    status: 'applied',
    position: nextPos,
  });
}
