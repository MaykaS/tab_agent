// storage.js — tab visit history helpers + session event logging
// Used by both background.js and popup.js

const STORAGE_KEY = "visits";
const SESSION_LOG_KEY = "sessionLog";
const PARTICIPANT_ID_KEY = "participantId";
const CACHED_GROUPS_KEY = "cachedGroups";
const ASLEEP_GROUPS_KEY = "asleepGroups";
const STUDY_RESPONSES_KEY = "studyResponses";
const PRUNE_AFTER_DAYS = 7;
const ESTIMATED_MEMORY_PER_TAB_MB = 50;

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
 * Get or create an anonymous participant ID for study submissions.
 */
async function getParticipantId() {
  const data = await chrome.storage.local.get(PARTICIPANT_ID_KEY);
  if (data[PARTICIPANT_ID_KEY]) return data[PARTICIPANT_ID_KEY];

  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  const participantId = `TA-${randomPart}`;
  await chrome.storage.local.set({ [PARTICIPANT_ID_KEY]: participantId });
  return participantId;
}

async function getStudyResponses() {
  const data = await chrome.storage.local.get(STUDY_RESPONSES_KEY);
  return data[STUDY_RESPONSES_KEY] || {
    groupingUseful: null,
    trustSleepClose: null,
    wouldUseInRealBrowsing: null,
  };
}

async function saveStudyResponses(responses) {
  await chrome.storage.local.set({ [STUDY_RESPONSES_KEY]: responses });
}

function getLatestRatingsByGroupIndex(ratingHistory, groupCount) {
  if (!Array.isArray(ratingHistory) || ratingHistory.length === 0) return {};

  for (let i = ratingHistory.length - 1; i >= 0; i -= 1) {
    const entry = ratingHistory[i];
    if (entry && entry.ratings && entry.groupCount === groupCount) {
      return entry.ratings;
    }
  }

  return {};
}

async function buildStudySnapshot(data) {
  const cached = data[CACHED_GROUPS_KEY] || null;
  const asleepGroups = data[ASLEEP_GROUPS_KEY] || {};
  const ratingHistory = data.ratingHistory || [];
  const participantId = data[PARTICIPANT_ID_KEY] || await getParticipantId();

  if (!cached || !Array.isArray(cached.groups) || !cached.tabMap) {
    return {
      participantId,
      tabCount: 0,
      openTabCount: 0,
      groupCount: 0,
      asleepGroupCount: 0,
      asleepTabCount: 0,
      ratingCount: ratingHistory.length,
      avgRating: ratingHistory.length
        ? ratingHistory.reduce((sum, entry) => sum + (entry.avgScore || 0), 0) / ratingHistory.length
        : 0,
      memorySavedEstimateMb: data.memorySaved || 0,
      totalTabMemoryEstimateMb: 0,
      memoryMetricsAreEstimated: true,
      groups: [],
    };
  }

  const { groups, tabMap } = cached;
  const openTabs = await chrome.tabs.query({});
  const openUrls = new Set(openTabs.map(tab => tab.url).filter(Boolean));
  const latestRatings = getLatestRatingsByGroupIndex(ratingHistory, groups.length);

  const groupSnapshots = groups.map((group, groupIndex) => {
    const asleepTabIds = asleepGroups[groupIndex] || [];
    const openTabIds = group.tabIds.filter(id => {
      const url = tabMap[id]?.url;
      return url && openUrls.has(url);
    });

    return {
      name: group.name,
      tabCount: group.tabIds.length,
      openTabCount: openTabIds.length,
      isAsleep: !!asleepGroups[groupIndex],
      estimatedMemoryMb: openTabIds.length * ESTIMATED_MEMORY_PER_TAB_MB,
      estimatedSavedMemoryMb: asleepTabIds.length * ESTIMATED_MEMORY_PER_TAB_MB,
      rating: latestRatings[groupIndex] ?? null,
      tabTitlesPreview: group.tabIds
        .map(id => tabMap[id]?.title || "Unknown tab")
        .slice(0, 5),
    };
  });

  const openTabCount = groupSnapshots.reduce((sum, group) => sum + group.openTabCount, 0);
  const asleepGroupCount = Object.keys(asleepGroups).filter(key => groups[Number(key)]).length;
  const asleepTabCount = Object.values(asleepGroups).reduce((sum, tabIds) => sum + tabIds.length, 0);

  return {
    participantId,
    tabCount: groups.reduce((sum, group) => sum + group.tabIds.length, 0),
    openTabCount,
    groupCount: groups.length,
    asleepGroupCount,
    asleepTabCount,
    ratingCount: ratingHistory.length,
    avgRating: ratingHistory.length
      ? ratingHistory.reduce((sum, entry) => sum + (entry.avgScore || 0), 0) / ratingHistory.length
      : 0,
    memorySavedEstimateMb: data.memorySaved || 0,
    totalTabMemoryEstimateMb: openTabCount * ESTIMATED_MEMORY_PER_TAB_MB,
    memoryMetricsAreEstimated: true,
    groups: groupSnapshots,
  };
}

/**
 * Get all stored data for export to research study.
 */
async function getAllDataForExport() {
  const data = await chrome.storage.local.get(null);
  const studySnapshot = await buildStudySnapshot(data);

  return {
    participantId: studySnapshot.participantId,
    exportedAt: new Date().toISOString(),
    sessionLog: data[SESSION_LOG_KEY] || [],
    ratingHistory: data.ratingHistory || [],
    memorySaved: data.memorySaved || 0,
    visitCount: (data[STORAGE_KEY] || []).length,
    tabCount: studySnapshot.tabCount,
    openTabCount: studySnapshot.openTabCount,
    groupCount: studySnapshot.groupCount,
    asleepGroupCount: studySnapshot.asleepGroupCount,
    asleepTabCount: studySnapshot.asleepTabCount,
    ratingCount: studySnapshot.ratingCount,
    avgRating: studySnapshot.avgRating,
    memorySavedEstimateMb: studySnapshot.memorySavedEstimateMb,
    totalTabMemoryEstimateMb: studySnapshot.totalTabMemoryEstimateMb,
    memoryMetricsAreEstimated: studySnapshot.memoryMetricsAreEstimated,
    studyResponses: await getStudyResponses(),
    groups: studySnapshot.groups,
  };
}
