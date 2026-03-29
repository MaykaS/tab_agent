// background.js — silent background service worker
// Runs always, even when the popup is closed.
// One job: record tab visits to storage whenever the user switches tabs.

importScripts("storage.js");

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await writeVisit(tab.url);
    }
  } catch (err) {
    // Tab may have closed before we could read it — safe to ignore
    console.warn("Tab Agent background: could not record visit", err);
  }
});
