chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'JOB_LOGGED') {
    const todayKey = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(todayKey, (result) => {
      const count = ((result[todayKey] as number) || 0) + 1;
      chrome.storage.local.set({ [todayKey]: count });
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });
    });
  }
});

// Restore badge count on startup
chrome.runtime.onStartup.addListener(() => {
  const todayKey = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(todayKey, (result) => {
    const count = (result[todayKey] as number) || 0;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });
    }
  });
});
