// agent.js - local autonomous policy for Tab Agent v1

function buildHourAffinity(counts, currentHour) {
  const total = Object.values(counts || {}).reduce((sum, count) => sum + count, 0);
  if (!total) return 0;
  return (counts?.[String(currentHour)] || 0) / total;
}

function buildDayAffinity(counts, currentDay) {
  const total = Object.values(counts || {}).reduce((sum, count) => sum + count, 0);
  if (!total) return 0;
  return (counts?.[String(currentDay)] || 0) / total;
}

function buildSleepReason(features) {
  const reasons = [];

  if (features.minutesSinceLastActive >= 45) {
    reasons.push(`inactive for ${Math.round(features.minutesSinceLastActive)} min`);
  }
  if (features.visits24h <= 1) {
    reasons.push("rarely revisited today");
  }
  if (features.groupRecentlyActive === false) {
    reasons.push("current work context moved on");
  }
  if (features.safeSleepCount > features.regretCount) {
    reasons.push("past sleeps were low-risk");
  }

  return reasons.length
    ? `Slept because it was ${reasons.join(", ")}.`
    : "Slept because its near-term need score was low.";
}

function buildWakeReason(groupName) {
  if (groupName) {
    return `Woke related tabs because you re-entered the ${groupName} context.`;
  }
  return "Woke related tabs because you re-entered a linked context.";
}

async function buildTabFeatures(tab, groupName, activeGroupName, policy) {
  const [urlModelData, visits24h, protectedByUser] = await Promise.all([
    chrome.storage.local.get(URL_MODEL_KEY),
    getVisitsForUrl(tab.url, 24),
    isProtectedContext(tab.url, groupName),
  ]);

  const urlModel = urlModelData[URL_MODEL_KEY] || {};
  const model = urlModel[normalizeUrl(tab.url)] || {};
  const timestamp = Date.now();
  const lastActiveAt = model.lastActiveAt || null;
  const minutesSinceLastActive = lastActiveAt ? (timestamp - lastActiveAt) / 60000 : 999;
  const currentHour = new Date(timestamp).getHours();
  const currentDay = new Date(timestamp).getDay();

  return {
    normalizedUrl: normalizeUrl(tab.url),
    title: tab.title || "Untitled",
    groupName,
    minutesSinceLastActive,
    visits24h: visits24h.length,
    avgReturnMinutes: model.avgReturnMinutes || null,
    hourAffinity: buildHourAffinity(model.hourCounts || {}, currentHour),
    dayAffinity: buildDayAffinity(model.dayCounts || {}, currentDay),
    regretCount: model.regretCount || 0,
    safeSleepCount: model.safeSleepCount || 0,
    protectionCount: model.protectionCount || 0,
    activationCount: model.activationCount || 0,
    groupRecentlyActive: Boolean(activeGroupName && groupName && activeGroupName === groupName),
    protectedByUser,
    protectPinned: policy.protectPinnedTabs && Boolean(tab.pinned),
    protectAudible: policy.protectAudibleTabs && Boolean(tab.audible),
  };
}

function scoreNeed(features, policy, frequentUrls) {
  if (features.protectedByUser) return 1;
  if (features.protectPinned || features.protectAudible) return 1;
  if (features.minutesSinceLastActive <= policy.recentProtectMinutes) return 1;
  if (frequentUrls.has(features.normalizedUrl)) return 0.92;

  const recencyScore = clamp(1 - (features.minutesSinceLastActive / 120), 0, 1);
  const frequencyScore = clamp(features.visits24h / 5, 0, 1);
  const patternScore = clamp(features.hourAffinity * 0.7 + features.dayAffinity * 0.3, 0, 1);
  const regretPenalty = clamp(features.regretCount / 4, 0, 0.35);
  const safeDiscount = clamp(features.safeSleepCount / 8, 0, 0.2);
  const groupBonus = features.groupRecentlyActive ? 0.15 : 0;

  const score = clamp(
    recencyScore * 0.4 +
      frequencyScore * 0.2 +
      patternScore * 0.15 +
      groupBonus +
      regretPenalty -
      safeDiscount,
    0,
    1
  );

  return score;
}

async function decideAutonomousSleepCandidates(tabs, cached, policy) {
  if (!cached?.groups || !cached?.tabMap) return [];

  const frequentUrls = await getFrequentUrls(policy.frequentVisits24h, 24);
  const recentActivations = await getRecentActivations();
  const activeGroupName = recentActivations[0]?.groupName || null;
  const candidates = [];

  for (const tab of tabs) {
    if (!tab.url || tab.active) continue;
    const { groupName, groupIndex } = findGroupMatch(tab.url, cached);
    const features = await buildTabFeatures(tab, groupName, activeGroupName, policy);

    if (features.minutesSinceLastActive < policy.minInactiveMinutes) continue;
    if (features.protectedByUser || features.protectPinned || features.protectAudible) continue;

    const needScore = scoreNeed(features, policy, frequentUrls);
    const confidence = clamp(1 - needScore, 0, 1);

    if (needScore < policy.sleepThreshold) {
      candidates.push({
        tab,
        groupName,
        groupIndex,
        features,
        needScore,
        confidence,
        reason: buildSleepReason(features),
      });
    }
  }

  return candidates;
}

async function runAgentCycle() {
  const policy = await getAgentPolicy();
  if (!policy.enabled) return { slept: 0 };

  await finalizeAutoSleepOutcomes();

  const { cached, asleepGroups } = await getGroupingState();
  if (!cached?.groups?.length) return { slept: 0 };

  const tabs = await chrome.tabs.query({});
  const candidates = await decideAutonomousSleepCandidates(
    tabs.filter((tab) => tab.url && !tab.url.startsWith("chrome")),
    cached,
    policy
  );

  let slept = 0;
  const nextAsleepGroups = { ...(asleepGroups || {}) };

  for (const candidate of candidates) {
    try {
      await chrome.tabs.discard(candidate.tab.id);
      slept += 1;

      const action = await appendAgentAction({
        type: "auto_sleep",
        confidence: Number(candidate.confidence.toFixed(2)),
        score: Number(candidate.needScore.toFixed(2)),
        reason: candidate.reason,
        features: {
          minutesSinceLastActive: Number(candidate.features.minutesSinceLastActive.toFixed(2)),
          visits24h: candidate.features.visits24h,
          avgReturnMinutes: candidate.features.avgReturnMinutes,
          groupName: candidate.groupName,
          regretCount: candidate.features.regretCount,
          safeSleepCount: candidate.features.safeSleepCount,
        },
        target: {
          tabIds: [candidate.tab.id],
          urls: [candidate.tab.url],
          titles: [candidate.tab.title || "Untitled"],
          groupName: candidate.groupName,
          groupIndex: candidate.groupIndex,
        },
      });

      if (candidate.groupIndex >= 0) {
        nextAsleepGroups[candidate.groupIndex] = [
          ...(nextAsleepGroups[candidate.groupIndex] || []),
          candidate.tab.id,
        ];
      }

      await trackAutoSleepEntry({
        url: candidate.tab.url,
        tabId: candidate.tab.id,
        groupName: candidate.groupName,
        title: candidate.tab.title,
        actionId: action.id,
      });

      await logEvent("auto_slept", {
        tabCount: 1,
        groupName: candidate.groupName,
        confidence: action.confidence,
      });
    } catch (error) {
      console.warn("Tab Agent auto-sleep failed", candidate.tab.id, error);
    }
  }

  await chrome.storage.local.set({ [ASLEEP_GROUPS_KEY]: nextAsleepGroups });
  return { slept };
}

async function handleContextWake(activeTab) {
  const { cached, asleepGroups } = await getGroupingState();
  if (!cached?.groups?.length) return { woke: 0 };

  const { groupName, groupIndex } = findGroupMatch(activeTab.url, cached);
  if (!groupName || groupIndex < 0) return { woke: 0 };

  const asleepTabIds = asleepGroups[groupIndex] || [];
  if (asleepTabIds.length === 0) return { woke: 0 };

  for (const tabId of asleepTabIds) {
    try {
      await chrome.tabs.reload(tabId);
    } catch (error) {
      console.warn("Tab Agent auto-wake failed", tabId, error);
    }
  }

  const urls = asleepTabIds
    .map((tabId) => cached.tabMap[tabId]?.url)
    .filter(Boolean);

  await appendAgentAction({
    type: "auto_wake",
    confidence: 0.8,
    score: 0.8,
    reason: buildWakeReason(groupName),
    target: {
      tabIds: asleepTabIds,
      urls,
      titles: asleepTabIds.map((tabId) => cached.tabMap[tabId]?.title || "Untitled"),
      groupName,
      groupIndex,
    },
    features: {
      triggerUrl: activeTab.url,
      triggerTitle: activeTab.title || "Untitled",
      groupName,
    },
    outcome: {
      status: "executed",
      observedAt: Date.now(),
    },
  });

  const nextAsleepGroups = { ...(asleepGroups || {}) };
  delete nextAsleepGroups[groupIndex];
  await chrome.storage.local.set({ [ASLEEP_GROUPS_KEY]: nextAsleepGroups });

  await logEvent("auto_woken", {
    tabCount: asleepTabIds.length,
    groupName,
  });

  return { woke: asleepTabIds.length };
}
