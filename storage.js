// storage.js - shared storage helpers for MVP and agentic flows
// Used by background.js, popup.js, and stats.js.

const STORAGE_KEY = "visits";
const SESSION_LOG_KEY = "sessionLog";
const PARTICIPANT_ID_KEY = "participantId";
const CACHED_GROUPS_KEY = "cachedGroups";
const ASLEEP_GROUPS_KEY = "asleepGroups";
const STUDY_RESPONSES_KEY = "studyResponses";
const URL_MODEL_KEY = "urlModel";
const GROUP_MODEL_KEY = "groupModel";
const AGENT_POLICY_KEY = "agentPolicy";
const AGENT_ACTION_LOG_KEY = "agentActionLog";
const FEEDBACK_LOG_KEY = "feedbackLog";
const PROTECTED_CONTEXTS_KEY = "protectedContexts";
const RECENT_ACTIVATIONS_KEY = "recentActivations";
const AUTO_SLEEP_STATE_KEY = "autoSleepState";
const OPENAI_POLICY_SUMMARY_KEY = "openAiPolicySummary";
const PRUNE_AFTER_DAYS = 7;
const ESTIMATED_MEMORY_PER_TAB_MB = 50;
const MAX_ACTION_LOG = 200;
const MAX_FEEDBACK_LOG = 200;
const MAX_RECENT_ACTIVATIONS = 20;
const QUICK_REOPEN_MINUTES = 5;
const SOON_REOPEN_MINUTES = 15;

function now() {
  return Date.now();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function getDefaultAgentPolicy() {
  return {
    enabled: true,
    sleepThreshold: 0.33,
    minInactiveMinutes: 20,
    recentProtectMinutes: 10,
    wakeLookbackMinutes: 30,
    frequentVisits24h: 3,
    protectPinnedTabs: true,
    protectAudibleTabs: true,
  };
}

async function getAgentPolicy() {
  const data = await chrome.storage.local.get(AGENT_POLICY_KEY);
  return {
    ...getDefaultAgentPolicy(),
    ...(data[AGENT_POLICY_KEY] || {}),
  };
}

async function saveAgentPolicy(policy) {
  const current = await getAgentPolicy();
  await chrome.storage.local.set({
    [AGENT_POLICY_KEY]: {
      ...current,
      ...policy,
      updatedAt: now(),
    },
  });
}

function getProtectedDefaults() {
  return {
    urls: {},
    groups: {},
  };
}

async function getProtectedContexts() {
  const data = await chrome.storage.local.get(PROTECTED_CONTEXTS_KEY);
  return {
    ...getProtectedDefaults(),
    ...(data[PROTECTED_CONTEXTS_KEY] || {}),
  };
}

async function setProtectedContexts(protectedContexts) {
  await chrome.storage.local.set({ [PROTECTED_CONTEXTS_KEY]: protectedContexts });
}

async function protectContext({ url, groupName, source = "user" }) {
  const protectedContexts = await getProtectedContexts();
  const at = now();

  if (url) {
    const key = normalizeUrl(url);
    protectedContexts.urls[key] = {
      count: (protectedContexts.urls[key]?.count || 0) + 1,
      source,
      updatedAt: at,
    };
  }

  if (groupName) {
    protectedContexts.groups[groupName] = {
      count: (protectedContexts.groups[groupName]?.count || 0) + 1,
      source,
      updatedAt: at,
    };
  }

  await setProtectedContexts(protectedContexts);
}

async function unprotectContext({ url, groupName }) {
  const protectedContexts = await getProtectedContexts();

  if (url) {
    delete protectedContexts.urls[normalizeUrl(url)];
  }

  if (groupName) {
    delete protectedContexts.groups[groupName];
  }

  await setProtectedContexts(protectedContexts);
}

async function isProtectedContext(url, groupName) {
  const protectedContexts = await getProtectedContexts();
  const urlKey = normalizeUrl(url);
  return Boolean(protectedContexts.urls[urlKey] || (groupName && protectedContexts.groups[groupName]));
}

async function writeVisit(url) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return;

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const visits = data[STORAGE_KEY] || [];
  visits.push({ url, normalizedUrl: normalizeUrl(url), timestamp: now() });

  await chrome.storage.local.set({ [STORAGE_KEY]: pruneOldVisits(visits) });
}

function pruneOldVisits(visits) {
  const cutoff = now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return visits.filter((visit) => visit.timestamp > cutoff);
}

async function getVisits() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || [];
}

async function getVisitsForUrl(url, windowHours = 24) {
  const visits = await getVisits();
  const key = normalizeUrl(url);
  const cutoff = now() - windowHours * 60 * 60 * 1000;
  return visits.filter((visit) => normalizeUrl(visit.url) === key && visit.timestamp > cutoff);
}

async function getFrequentUrls(threshold = 3, windowHours = 24) {
  const visits = await getVisits();
  const cutoff = now() - windowHours * 60 * 60 * 1000;
  const counts = {};

  for (const visit of visits) {
    if (visit.timestamp <= cutoff) continue;
    const key = normalizeUrl(visit.url);
    counts[key] = (counts[key] || 0) + 1;
  }

  const frequent = new Set();
  for (const [url, count] of Object.entries(counts)) {
    if (count >= threshold) frequent.add(url);
  }

  return frequent;
}

async function logEvent(event, details = {}) {
  const data = await chrome.storage.local.get(SESSION_LOG_KEY);
  const log = data[SESSION_LOG_KEY] || [];
  log.push({
    timestamp: now(),
    event,
    ...details,
  });
  await chrome.storage.local.set({ [SESSION_LOG_KEY]: log });
}

async function getSessionLog() {
  const data = await chrome.storage.local.get(SESSION_LOG_KEY);
  return data[SESSION_LOG_KEY] || [];
}

async function getParticipantId() {
  const data = await chrome.storage.local.get(PARTICIPANT_ID_KEY);
  if (data[PARTICIPANT_ID_KEY]) return data[PARTICIPANT_ID_KEY];

  const participantId = `TA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
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

async function getRecentActivations() {
  const data = await chrome.storage.local.get(RECENT_ACTIVATIONS_KEY);
  return data[RECENT_ACTIVATIONS_KEY] || [];
}

async function recordRecentActivation(tab, groupName) {
  const data = await chrome.storage.local.get(RECENT_ACTIVATIONS_KEY);
  const recent = data[RECENT_ACTIVATIONS_KEY] || [];

  recent.unshift({
    url: tab.url,
    normalizedUrl: normalizeUrl(tab.url),
    title: tab.title || "Untitled",
    groupName: groupName || null,
    timestamp: now(),
  });

  await chrome.storage.local.set({
    [RECENT_ACTIVATIONS_KEY]: recent.slice(0, MAX_RECENT_ACTIVATIONS),
  });

  return recent.slice(0, MAX_RECENT_ACTIVATIONS);
}

function getHourKey(timestamp) {
  return new Date(timestamp).getHours().toString();
}

function getDayKey(timestamp) {
  return new Date(timestamp).getDay().toString();
}

async function getGroupingState() {
  const data = await chrome.storage.local.get([CACHED_GROUPS_KEY, ASLEEP_GROUPS_KEY]);
  return {
    cached: data[CACHED_GROUPS_KEY] || null,
    asleepGroups: data[ASLEEP_GROUPS_KEY] || {},
  };
}

function findGroupMatch(url, cached) {
  if (!cached || !cached.groups || !cached.tabMap) {
    return { groupName: null, groupIndex: -1 };
  }

  const key = normalizeUrl(url);
  for (let i = 0; i < cached.groups.length; i += 1) {
    const group = cached.groups[i];
    for (const tabId of group.tabIds) {
      const tab = cached.tabMap[tabId];
      if (tab && normalizeUrl(tab.url) === key) {
        return { groupName: group.name, groupIndex: i };
      }
    }
  }

  return { groupName: null, groupIndex: -1 };
}

async function updateBehaviorModels(tab) {
  if (!tab?.url) return;

  const [{ cached }, urlModelData, groupModelData, recentActivations] = await Promise.all([
    getGroupingState(),
    chrome.storage.local.get(URL_MODEL_KEY),
    chrome.storage.local.get(GROUP_MODEL_KEY),
    getRecentActivations(),
  ]);

  const normalizedUrl = normalizeUrl(tab.url);
  const timestamp = now();
  const hourKey = getHourKey(timestamp);
  const dayKey = getDayKey(timestamp);
  const { groupName } = findGroupMatch(tab.url, cached);

  const urlModel = urlModelData[URL_MODEL_KEY] || {};
  const groupModel = groupModelData[GROUP_MODEL_KEY] || {};

  const previous = urlModel[normalizedUrl] || {
    activationCount: 0,
    hourCounts: {},
    dayCounts: {},
    regretCount: 0,
    safeSleepCount: 0,
    protectionCount: 0,
    coActivationCounts: {},
  };

  const previousLastActiveAt = previous.lastActiveAt || null;
  const deltaMinutes = previousLastActiveAt ? (timestamp - previousLastActiveAt) / 60000 : null;
  const avgReturnMinutes = previous.avgReturnMinutes
    ? deltaMinutes
      ? (previous.avgReturnMinutes * previous.activationCount + deltaMinutes) / (previous.activationCount + 1)
      : previous.avgReturnMinutes
    : deltaMinutes || null;

  const nextUrlModel = {
    ...previous,
    title: tab.title || previous.title || "Untitled",
    groupName: groupName || previous.groupName || null,
    activationCount: previous.activationCount + 1,
    lastActiveAt: timestamp,
    avgReturnMinutes,
    hourCounts: {
      ...previous.hourCounts,
      [hourKey]: (previous.hourCounts?.[hourKey] || 0) + 1,
    },
    dayCounts: {
      ...previous.dayCounts,
      [dayKey]: (previous.dayCounts?.[dayKey] || 0) + 1,
    },
    coActivationCounts: { ...(previous.coActivationCounts || {}) },
  };

  for (const activation of recentActivations.slice(0, 3)) {
    if (!activation.normalizedUrl || activation.normalizedUrl === normalizedUrl) continue;
    nextUrlModel.coActivationCounts[activation.normalizedUrl] =
      (nextUrlModel.coActivationCounts[activation.normalizedUrl] || 0) + 1;
  }

  urlModel[normalizedUrl] = nextUrlModel;

  if (groupName) {
    const previousGroup = groupModel[groupName] || {
      activationCount: 0,
      hourCounts: {},
      dayCounts: {},
      regretCount: 0,
      safeSleepCount: 0,
      protectionCount: 0,
    };

    groupModel[groupName] = {
      ...previousGroup,
      activationCount: previousGroup.activationCount + 1,
      lastActiveAt: timestamp,
      hourCounts: {
        ...previousGroup.hourCounts,
        [hourKey]: (previousGroup.hourCounts?.[hourKey] || 0) + 1,
      },
      dayCounts: {
        ...previousGroup.dayCounts,
        [dayKey]: (previousGroup.dayCounts?.[dayKey] || 0) + 1,
      },
    };
  }

  await chrome.storage.local.set({
    [URL_MODEL_KEY]: urlModel,
    [GROUP_MODEL_KEY]: groupModel,
  });

  return { normalizedUrl, groupName };
}

async function bumpOutcomeStats(url, groupName, type) {
  const [urlModelData, groupModelData] = await Promise.all([
    chrome.storage.local.get(URL_MODEL_KEY),
    chrome.storage.local.get(GROUP_MODEL_KEY),
  ]);
  const urlModel = urlModelData[URL_MODEL_KEY] || {};
  const groupModel = groupModelData[GROUP_MODEL_KEY] || {};
  const key = normalizeUrl(url);

  if (urlModel[key]) {
    if (type === "regret") {
      urlModel[key].regretCount = (urlModel[key].regretCount || 0) + 1;
    }
    if (type === "safe") {
      urlModel[key].safeSleepCount = (urlModel[key].safeSleepCount || 0) + 1;
    }
    if (type === "protect") {
      urlModel[key].protectionCount = (urlModel[key].protectionCount || 0) + 1;
    }
  }

  if (groupName && groupModel[groupName]) {
    if (type === "regret") {
      groupModel[groupName].regretCount = (groupModel[groupName].regretCount || 0) + 1;
    }
    if (type === "safe") {
      groupModel[groupName].safeSleepCount = (groupModel[groupName].safeSleepCount || 0) + 1;
    }
    if (type === "protect") {
      groupModel[groupName].protectionCount = (groupModel[groupName].protectionCount || 0) + 1;
    }
  }

  await chrome.storage.local.set({
    [URL_MODEL_KEY]: urlModel,
    [GROUP_MODEL_KEY]: groupModel,
  });
}

async function appendAgentAction(entry) {
  const data = await chrome.storage.local.get(AGENT_ACTION_LOG_KEY);
  const log = data[AGENT_ACTION_LOG_KEY] || [];
  const action = {
    id: entry.id || `act_${now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: entry.createdAt || now(),
    outcome: entry.outcome || { status: "pending" },
    feedback: entry.feedback || null,
    ...entry,
  };

  log.unshift(action);
  await chrome.storage.local.set({
    [AGENT_ACTION_LOG_KEY]: log.slice(0, MAX_ACTION_LOG),
  });
  return action;
}

async function getAgentActionLog(limit = 20) {
  const data = await chrome.storage.local.get(AGENT_ACTION_LOG_KEY);
  return (data[AGENT_ACTION_LOG_KEY] || []).slice(0, limit);
}

async function updateAgentAction(actionId, updater) {
  const data = await chrome.storage.local.get(AGENT_ACTION_LOG_KEY);
  const log = data[AGENT_ACTION_LOG_KEY] || [];
  const updated = log.map((action) => {
    if (action.id !== actionId) return action;
    return typeof updater === "function" ? updater(action) : { ...action, ...updater };
  });
  await chrome.storage.local.set({ [AGENT_ACTION_LOG_KEY]: updated });
  return updated.find((action) => action.id === actionId) || null;
}

async function appendFeedback(entry) {
  const data = await chrome.storage.local.get(FEEDBACK_LOG_KEY);
  const log = data[FEEDBACK_LOG_KEY] || [];
  log.unshift({
    id: `feedback_${now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now(),
    ...entry,
  });
  await chrome.storage.local.set({
    [FEEDBACK_LOG_KEY]: log.slice(0, MAX_FEEDBACK_LOG),
  });
}

async function getFeedbackLog(limit = 50) {
  const data = await chrome.storage.local.get(FEEDBACK_LOG_KEY);
  return (data[FEEDBACK_LOG_KEY] || []).slice(0, limit);
}

async function getAutoSleepState() {
  const data = await chrome.storage.local.get(AUTO_SLEEP_STATE_KEY);
  return data[AUTO_SLEEP_STATE_KEY] || {};
}

async function setAutoSleepState(state) {
  await chrome.storage.local.set({ [AUTO_SLEEP_STATE_KEY]: state });
}

async function trackAutoSleepEntry({ url, tabId, groupName, title, actionId }) {
  const state = await getAutoSleepState();
  state[normalizeUrl(url)] = {
    url,
    tabId,
    groupName: groupName || null,
    title: title || "Untitled",
    actionId,
    sleptAt: now(),
  };
  await setAutoSleepState(state);
}

async function clearAutoSleepEntry(url) {
  const state = await getAutoSleepState();
  delete state[normalizeUrl(url)];
  await setAutoSleepState(state);
}

async function markAutoSleepOutcome(url, outcome, details = {}) {
  const state = await getAutoSleepState();
  const key = normalizeUrl(url);
  const entry = state[key];
  if (!entry) return false;

  const elapsedMinutes = (now() - entry.sleptAt) / 60000;
  if (outcome === "regret_reopen_within_5m" && elapsedMinutes > QUICK_REOPEN_MINUTES) {
    return false;
  }
  if (outcome === "regret_reopen_within_15m" && elapsedMinutes > SOON_REOPEN_MINUTES) {
    return false;
  }
  const outcomePayload = {
    status: outcome,
    observedAt: now(),
    elapsedMinutes: Number(elapsedMinutes.toFixed(2)),
    ...details,
  };

  await updateAgentAction(entry.actionId, (action) => ({
    ...action,
    outcome: outcomePayload,
  }));

  await appendFeedback({
    actionId: entry.actionId,
    type: outcome,
    url: entry.url,
    groupName: entry.groupName,
    elapsedMinutes: outcomePayload.elapsedMinutes,
  });

  if (outcome.includes("regret") || outcome === "undo" || outcome === "bad_feedback") {
    await bumpOutcomeStats(entry.url, entry.groupName, "regret");
  } else if (outcome === "safe_after_15m" || outcome === "good_feedback") {
    await bumpOutcomeStats(entry.url, entry.groupName, "safe");
  }

  delete state[key];
  await setAutoSleepState(state);
  return true;
}

async function finalizeAutoSleepOutcomes() {
  const state = await getAutoSleepState();
  const cutoff = now() - SOON_REOPEN_MINUTES * 60 * 1000;
  const entries = Object.values(state);
  if (entries.length === 0) return;

  for (const entry of entries) {
    if (entry.sleptAt <= cutoff) {
      await markAutoSleepOutcome(entry.url, "safe_after_15m");
    }
  }
}

async function recordExplicitActionFeedback(actionId, value) {
  const action = await updateAgentAction(actionId, (current) => ({
    ...current,
    feedback: {
      value,
      timestamp: now(),
    },
    outcome: value === "bad"
      ? { ...(current.outcome || {}), status: "bad_feedback", observedAt: now() }
      : { ...(current.outcome || {}), status: "good_feedback", observedAt: now() },
  }));

  if (!action) return null;

  const primaryUrl = action.target?.urls?.[0] || action.target?.url || null;
  await appendFeedback({
    actionId,
    type: value === "bad" ? "bad_feedback" : "good_feedback",
    url: primaryUrl,
    groupName: action.target?.groupName || null,
  });

  if (primaryUrl) {
    await bumpOutcomeStats(primaryUrl, action.target?.groupName || null, value === "bad" ? "regret" : "safe");
  }

  return action;
}

async function protectActionTarget(actionId) {
  const actions = await getAgentActionLog(MAX_ACTION_LOG);
  const action = actions.find((entry) => entry.id === actionId);
  if (!action) return null;

  await protectContext({
    url: action.target?.urls?.[0] || action.target?.url || null,
    groupName: action.target?.groupName || null,
    source: "action_protect",
  });

  const updated = await updateAgentAction(actionId, (current) => ({
    ...current,
    protectedAt: now(),
  }));

  const primaryUrl = action.target?.urls?.[0] || action.target?.url || null;
  if (primaryUrl) {
    await bumpOutcomeStats(primaryUrl, action.target?.groupName || null, "protect");
  }

  await appendFeedback({
    actionId,
    type: "protect",
    url: primaryUrl,
    groupName: action.target?.groupName || null,
  });

  return updated;
}

async function undoAgentAction(actionId) {
  const actions = await getAgentActionLog(MAX_ACTION_LOG);
  const action = actions.find((entry) => entry.id === actionId);
  if (!action || action.type !== "auto_sleep") return false;

  const tabIds = action.target?.tabIds || [];
  for (const tabId of tabIds) {
    try {
      await chrome.tabs.reload(tabId);
    } catch (error) {
      console.warn("Tab Agent undo: could not reload tab", tabId, error);
    }
  }

  await updateAgentAction(actionId, (current) => ({
    ...current,
    undoneAt: now(),
    outcome: {
      status: "undo",
      observedAt: now(),
    },
  }));

  for (const url of action.target?.urls || []) {
    await markAutoSleepOutcome(url, "undo");
  }

  await appendFeedback({
    actionId,
    type: "undo",
    url: action.target?.urls?.[0] || null,
    groupName: action.target?.groupName || null,
  });

  return true;
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

async function getOpenAiPolicySummary() {
  const data = await chrome.storage.local.get(OPENAI_POLICY_SUMMARY_KEY);
  return data[OPENAI_POLICY_SUMMARY_KEY] || null;
}

async function saveOpenAiPolicySummary(summary) {
  await chrome.storage.local.set({
    [OPENAI_POLICY_SUMMARY_KEY]: {
      ...summary,
      updatedAt: now(),
    },
  });
}

function buildBaselineComparison(groupSnapshots, urlModel, protectedContexts) {
  const fixedThresholdMinutes = 30;
  let ruleBasedSleepCount = 0;

  for (const group of groupSnapshots) {
    for (const tab of group.tabsDetailed) {
      if (!tab.isOpen) continue;
      const protectedByUser = Boolean(
        protectedContexts.urls[normalizeUrl(tab.url)] ||
        (tab.groupName && protectedContexts.groups[tab.groupName])
      );
      if (protectedByUser) continue;

      const model = urlModel[normalizeUrl(tab.url)] || {};
      const minutesSinceLastActive = model.lastActiveAt
        ? (now() - model.lastActiveAt) / 60000
        : fixedThresholdMinutes + 1;

      if (minutesSinceLastActive >= fixedThresholdMinutes) {
        ruleBasedSleepCount += 1;
      }
    }
  }

  return {
    fixedRuleThresholdMinutes: fixedThresholdMinutes,
    ruleBasedSleepCount,
    estimatedRuleMemorySavedMb: ruleBasedSleepCount * ESTIMATED_MEMORY_PER_TAB_MB,
  };
}

async function buildStudySnapshot(data) {
  const cached = data[CACHED_GROUPS_KEY] || null;
  const asleepGroups = data[ASLEEP_GROUPS_KEY] || {};
  const ratingHistory = data.ratingHistory || [];
  const participantId = data[PARTICIPANT_ID_KEY] || await getParticipantId();
  const agentActions = data[AGENT_ACTION_LOG_KEY] || [];
  const feedbackLog = data[FEEDBACK_LOG_KEY] || [];
  const agentPolicy = {
    ...getDefaultAgentPolicy(),
    ...(data[AGENT_POLICY_KEY] || {}),
  };
  const protectedContexts = {
    ...getProtectedDefaults(),
    ...(data[PROTECTED_CONTEXTS_KEY] || {}),
  };
  const urlModel = data[URL_MODEL_KEY] || {};

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
      autonomousSummary: {
        autoSleepCount: agentActions.filter((action) => action.type === "auto_sleep").length,
        autoWakeCount: agentActions.filter((action) => action.type === "auto_wake").length,
        undoCount: feedbackLog.filter((entry) => entry.type === "undo").length,
        regretCount: feedbackLog.filter((entry) => String(entry.type).includes("regret")).length,
        explicitBadCount: feedbackLog.filter((entry) => entry.type === "bad_feedback").length,
        explicitGoodCount: feedbackLog.filter((entry) => entry.type === "good_feedback").length,
      },
      baselineComparison: {
        fixedRuleThresholdMinutes: 30,
        ruleBasedSleepCount: 0,
        estimatedRuleMemorySavedMb: 0,
      },
    };
  }

  const { groups, tabMap } = cached;
  const openTabs = await chrome.tabs.query({});
  const openUrlMap = new Map(openTabs.map((tab) => [normalizeUrl(tab.url), tab]));
  const latestRatings = getLatestRatingsByGroupIndex(ratingHistory, groups.length);

  const groupSnapshots = groups.map((group, groupIndex) => {
    const asleepTabIds = asleepGroups[groupIndex] || [];
    const tabsDetailed = group.tabIds.map((id) => {
      const tab = tabMap[id];
      const openTab = tab ? openUrlMap.get(normalizeUrl(tab.url)) : null;
      return {
        id,
        url: tab?.url || "",
        title: tab?.title || "Unknown tab",
        groupName: group.name,
        isOpen: Boolean(openTab),
        liveTabId: openTab?.id || null,
      };
    });

    const openTabCount = tabsDetailed.filter((tab) => tab.isOpen).length;
    const asleepCount = asleepTabIds.length;

    return {
      name: group.name,
      tabCount: group.tabIds.length,
      openTabCount,
      isAsleep: !!asleepGroups[groupIndex],
      estimatedMemoryMb: openTabCount * ESTIMATED_MEMORY_PER_TAB_MB,
      estimatedSavedMemoryMb: asleepCount * ESTIMATED_MEMORY_PER_TAB_MB,
      rating: latestRatings[groupIndex] ?? null,
      tabTitlesPreview: tabsDetailed.map((tab) => tab.title).slice(0, 5),
      tabsDetailed,
    };
  });

  const openTabCount = groupSnapshots.reduce((sum, group) => sum + group.openTabCount, 0);
  const asleepGroupCount = Object.keys(asleepGroups).filter((key) => groups[Number(key)]).length;
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
    groups: groupSnapshots.map((group) => ({
      name: group.name,
      tabCount: group.tabCount,
      openTabCount: group.openTabCount,
      isAsleep: group.isAsleep,
      estimatedMemoryMb: group.estimatedMemoryMb,
      estimatedSavedMemoryMb: group.estimatedSavedMemoryMb,
      rating: group.rating,
      tabTitlesPreview: group.tabTitlesPreview,
    })),
    autonomousSummary: {
      autoSleepCount: agentActions.filter((action) => action.type === "auto_sleep").length,
      autoWakeCount: agentActions.filter((action) => action.type === "auto_wake").length,
      undoCount: feedbackLog.filter((entry) => entry.type === "undo").length,
      regretCount: feedbackLog.filter((entry) => String(entry.type).includes("regret")).length,
      explicitBadCount: feedbackLog.filter((entry) => entry.type === "bad_feedback").length,
      explicitGoodCount: feedbackLog.filter((entry) => entry.type === "good_feedback").length,
    },
    baselineComparison: buildBaselineComparison(groupSnapshots, urlModel, protectedContexts),
  };
}

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
    agentPolicy: await getAgentPolicy(),
    actionLog: data[AGENT_ACTION_LOG_KEY] || [],
    feedbackLog: data[FEEDBACK_LOG_KEY] || [],
    protectedContexts: await getProtectedContexts(),
    recentActivations: await getRecentActivations(),
    urlModel: data[URL_MODEL_KEY] || {},
    groupModel: data[GROUP_MODEL_KEY] || {},
    autonomousSummary: studySnapshot.autonomousSummary,
    baselineComparison: studySnapshot.baselineComparison,
    openAiPolicySummary: await getOpenAiPolicySummary(),
  };
}
