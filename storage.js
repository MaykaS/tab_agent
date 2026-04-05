// storage.js — tab visit history helpers + session event logging
// Used by both background.js and popup.js

const STORAGE_KEY = "visits";
const SESSION_LOG_KEY = "sessionLog";
const PRUNE_AFTER_DAYS = 7;

/**
 * Record a tab visit.
 * Call this every time the user switches to a tab.
 */
async function writeVisit(url) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return;

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const visits = data[STORAGE_KEY] || [];

  visits.push({ url, timestamp: Date.now() });

  const pruned = pruneOldVisits(visits);
  await chrome.storage.local.set({ [STORAGE_KEY]: pruned });
}

/**
 * Remove visits older than PRUNE_AFTER_DAYS days.
 */
function pruneOldVisits(visits) {
  const cutoff = Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return visits.filter(v => v.timestamp > cutoff);
}

/**
 * Return a Set of URLs visited at least `threshold` times
 * within the last `windowHours` hours.
 */
async function getFrequentUrls(threshold = 3, windowHours = 24) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const visits = data[STORAGE_KEY] || [];

  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const recent = visits.filter(v => v.timestamp > cutoff);

  const counts = {};
  for (const v of recent) {
    counts[v.url] = (counts[v.url] || 0) + 1;
  }

  const frequent = new Set();
  for (const [url, count] of Object.entries(counts)) {
    if (count >= threshold) frequent.add(url);
  }

  return frequent;
}

/**
 * Log a session event for research data collection.
 * Events: grouped, slept, woken, closed, regrouped
 */
async function logEvent(event, details = {}) {
  const data = await chrome.storage.local.get(SESSION_LOG_KEY);
  const log = data[SESSION_LOG_KEY] || [];

  log.push({
    timestamp: Date.now(),
    event,
    ...details
  });

  await chrome.storage.local.set({ [SESSION_LOG_KEY]: log });
}

/**
 * Get the full session log for export.
 */
async function getSessionLog() {
  const data = await chrome.storage.local.get(SESSION_LOG_KEY);
  return data[SESSION_LOG_KEY] || [];
}

/**
 * Get all stored data for export to research study.
 */
async function getAllDataForExport() {
  const data = await chrome.storage.local.get(null);
  return {
    exportedAt: new Date().toISOString(),
    sessionLog: data[SESSION_LOG_KEY] || [],
    ratingHistory: data.ratingHistory || [],
    memorySaved: data.memorySaved || 0,
    visitCount: (data[STORAGE_KEY] || []).length,
  };
}
