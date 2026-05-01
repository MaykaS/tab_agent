// agent.js - local autonomous policy for Tab Agent v2

const OBSERVATION_CANDIDATE_LIMIT = 2;
const HIGH_VALUE_HOSTS = [
  "notion.so",
  "docs.google.com",
  "drive.google.com",
  "calendar.google.com",
  "mail.google.com",
  "outlook.office.com",
  "outlook.cloud.microsoft",
  "github.com",
  "vercel.com",
  "figma.com",
];
const RECRUITING_HOST_MARKERS = [
  "linkedin.com",
  "jobs.ashbyhq.com",
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
  "indeed.com",
];
const TOOLING_HOST_MARKERS = [
  "github.com",
  "vercel.com",
  "localhost",
  "127.0.0.1",
  "tab-agent-web.vercel.app",
];

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

function matchesHost(hostname, patterns) {
  return patterns.some((pattern) => hostname === pattern || hostname.endsWith(`.${pattern}`));
}

function buildSleepReason(features) {
  const reasons = [];

  if (typeof features.minutesSinceLastActive === "number" && features.minutesSinceLastActive >= 45) {
    reasons.push(`inactive for ${Math.round(features.minutesSinceLastActive)} min`);
  }
  if (features.visits24h <= 1) {
    reasons.push("rarely revisited today");
  }
  if (features.groupRecentlyActive === false) {
    reasons.push("current work context moved on");
  }
  if (features.safeSleepCount + features.groupSafeSleepCount + features.memorySafeScore > 0) {
    reasons.push("past low-risk patterns support sleeping it");
  }

  return reasons.length
    ? `Slept because it was ${reasons.join(", ")}.`
    : "Slept because its near-term need score was low.";
}

function buildObservationReason(features) {
  const base = buildSleepReason(features).replace(/^Slept/, "Would sleep");
  return `${base} Observation mode is still learning your safe contexts first.`;
}

function buildWakeReason(groupName) {
  if (groupName) {
    return `Woke related tabs because you re-entered the ${groupName} context.`;
  }
  return "Woke related tabs because you re-entered a linked context.";
}

function buildRecentContextSignals(recentActivations, normalizedUrl, groupName) {
  const recentWindowMinutes = 45;
  const recentGroupReentry = (recentActivations || []).some((entry) => {
    if (!entry?.timestamp) return false;
    const ageMinutes = (Date.now() - entry.timestamp) / 60000;
    return ageMinutes <= recentWindowMinutes && groupName && entry.groupName === groupName;
  });
  const recentUrlReentry = (recentActivations || []).some((entry) => {
    if (!entry?.timestamp) return false;
    const ageMinutes = (Date.now() - entry.timestamp) / 60000;
    return ageMinutes <= recentWindowMinutes && entry.normalizedUrl === normalizedUrl;
  });
  return { recentGroupReentry, recentUrlReentry };
}

function buildMemorySignals(memorySummary, normalizedUrl, groupName, hostname) {
  const cautionAreas = memorySummary?.cautionAreas || [];
  const safeSleepAreas = memorySummary?.safeSleepAreas || [];
  const domainKey = hostname.replace(/^www\./, "");

  const cautionMatch = cautionAreas.find((entry) =>
    (entry.key && entry.key === normalizedUrl) ||
    (entry.type === "group" && groupName && entry.label === groupName) ||
    (entry.domain && entry.domain === domainKey)
  );
  const safeMatch = safeSleepAreas.find((entry) =>
    (entry.key && entry.key === normalizedUrl) ||
    (entry.type === "group" && groupName && entry.label === groupName) ||
    (entry.domain && entry.domain === domainKey)
  );

  return {
    cautious: cautionMatch || null,
    safe: safeMatch || null,
    memoryRiskScore: cautionMatch?.score || 0,
    memorySafeScore: safeMatch?.score || 0,
  };
}

function scoreNeed(features, policy, frequentUrls) {
  if (features.protectedByUser) return 1;
  if (features.protectPinned || features.protectAudible) return 1;
  if (features.coldStart) return 0.78;
  if (features.groupProtectionCount > 0) return 0.92;
  if (features.minutesSinceLastActive !== null && features.minutesSinceLastActive <= policy.recentProtectMinutes) return 1;
  if (frequentUrls.has(features.normalizedUrl)) return 0.95;

  const recencyScore = clamp(1 - (features.minutesSinceLastActive / 180), 0, 1);
  const frequencyScore = clamp(features.visits24h / 5, 0, 1);
  const patternScore = clamp(features.hourAffinity * 0.7 + features.dayAffinity * 0.3, 0, 1);
  const regretPenalty = clamp(features.regretCount / 4, 0, 0.3);
  const safeDiscount = clamp(features.safeSleepCount / 8, 0, 0.12);
  const groupBonus =
    features.groupRecentlyActive && features.minutesSinceLastActive !== null && features.minutesSinceLastActive <= 15
      ? 0.18
      : 0;
  const groupRecentShield =
    features.groupMinutesSinceLastActive !== null &&
    features.groupMinutesSinceLastActive <= 10 &&
    features.minutesSinceLastActive !== null &&
    features.minutesSinceLastActive <= 20
      ? 0.15
      : 0;
  const highValueShield = features.highValueContext ? 0.16 : 0;
  const recruitingShield = features.recruitingContext ? 0.12 : 0;
  const toolingShield = features.toolingContext ? 0.1 : 0;
  const recentReentryShield = features.recentGroupReentry || features.recentUrlReentry ? 0.18 : 0;
  const groupRegretPenalty = clamp(features.groupRegretCount / 4, 0, 0.18);
  const groupSafeDiscount = clamp(features.groupSafeSleepCount / 8, 0, 0.08);
  const memoryCautionBonus = clamp(features.memoryRiskScore / 10, 0, 0.16);
  const memorySafeDiscount = clamp(features.memorySafeScore / 12, 0, 0.06);

  return clamp(
    recencyScore * 0.35 +
      frequencyScore * 0.2 +
      patternScore * 0.12 +
      groupBonus +
      groupRecentShield +
      highValueShield +
      recruitingShield +
      toolingShield +
      recentReentryShield +
      regretPenalty +
      groupRegretPenalty +
      memoryCautionBonus -
      safeDiscount -
      groupSafeDiscount -
      memorySafeDiscount,
    0,
    1
  );
}

function isObservationCandidate(features, policy, frequentUrls) {
  if (features.coldStart) return false;
  if (features.protectedByUser || features.protectPinned || features.protectAudible) return false;
  if (features.minutesSinceLastActive === null || features.minutesSinceLastActive < Math.max(policy.minInactiveMinutes, 45)) return false;
  if (frequentUrls.has(features.normalizedUrl)) return false;
  if (features.groupRecentlyActive || features.recentGroupReentry || features.recentUrlReentry) return false;
  if (features.regretCount > 0 || features.groupRegretCount > 0) return false;
  if (features.protectionCount > 0 || features.groupProtectionCount > 0 || features.memoryRiskScore > 0) return false;
  if (features.visits24h > 1) return false;
  return true;
}

function isAutonomousSleepCandidate(features, policy, frequentUrls, autonomyState, needScore) {
  if (autonomyState.mode !== "trusted_autonomy") return false;
  if (!isObservationCandidate(features, policy, frequentUrls)) return false;
  if (features.highValueContext || features.recruitingContext || features.toolingContext) return false;
  if (features.minutesSinceLastActive < Math.max(policy.minInactiveMinutes, 75)) return false;
  if (features.safeSleepCount + features.groupSafeSleepCount + features.memorySafeScore < 1 && features.minutesSinceLastActive < 180) return false;
  return needScore < policy.sleepThreshold;
}

async function buildTabFeatures(tab, groupName, activeGroupName, policy, context) {
  const normalizedUrl = normalizeUrl(tab.url);
  const model = context.urlModel[normalizedUrl] || {};
  const groupSummary = groupName ? (context.groupModel[groupName] || {}) : {};
  const timestamp = Date.now();
  const lastActiveAt = model.lastActiveAt || null;
  const minutesSinceLastActive = lastActiveAt ? (timestamp - lastActiveAt) / 60000 : null;
  const currentHour = new Date(timestamp).getHours();
  const currentDay = new Date(timestamp).getDay();
  const groupLastActiveAt = groupSummary.lastActiveAt || null;
  const groupMinutesSinceLastActive = groupLastActiveAt
    ? (timestamp - groupLastActiveAt) / 60000
    : null;
  const hostname = getHostname(tab.url);
  const protectedByUser = Boolean(
    context.protectedContexts.urls?.[normalizedUrl] ||
    (groupName && context.protectedContexts.groups?.[groupName])
  );
  const { recentGroupReentry, recentUrlReentry } = buildRecentContextSignals(context.recentActivations, normalizedUrl, groupName);
  const memorySignals = buildMemorySignals(context.memorySummary, normalizedUrl, groupName, hostname);

  return {
    normalizedUrl,
    hostname,
    title: tab.title || "Untitled",
    groupName,
    minutesSinceLastActive,
    visits24h: context.visitsByUrl[normalizedUrl] || 0,
    avgReturnMinutes: model.avgReturnMinutes || null,
    hourAffinity: buildHourAffinity(model.hourCounts || {}, currentHour),
    dayAffinity: buildDayAffinity(model.dayCounts || {}, currentDay),
    regretCount: model.regretCount || 0,
    safeSleepCount: model.safeSleepCount || 0,
    protectionCount: model.protectionCount || 0,
    activationCount: model.activationCount || 0,
    groupRecentlyActive: Boolean(activeGroupName && groupName && activeGroupName === groupName),
    groupMinutesSinceLastActive,
    groupProtectionCount: groupSummary.protectionCount || 0,
    groupRegretCount: groupSummary.regretCount || 0,
    groupSafeSleepCount: groupSummary.safeSleepCount || 0,
    protectedByUser,
    protectPinned: policy.protectPinnedTabs && Boolean(tab.pinned),
    protectAudible: policy.protectAudibleTabs && Boolean(tab.audible),
    coldStart: !lastActiveAt,
    highValueContext: matchesHost(hostname, HIGH_VALUE_HOSTS),
    recruitingContext: matchesHost(hostname, RECRUITING_HOST_MARKERS),
    toolingContext: matchesHost(hostname, TOOLING_HOST_MARKERS),
    recentGroupReentry,
    recentUrlReentry,
    memoryRiskScore: memorySignals.memoryRiskScore,
    memorySafeScore: memorySignals.memorySafeScore,
    memoryCautionLabel: memorySignals.cautious?.label || null,
  };
}

async function buildDecisionContext(policy) {
  const [urlModelData, groupModelData, protectedContexts, recentActivations, visits, memorySummary, autonomyState] = await Promise.all([
    chrome.storage.local.get(URL_MODEL_KEY),
    chrome.storage.local.get(GROUP_MODEL_KEY),
    getProtectedContexts(),
    getRecentActivations(),
    getVisits(),
    getPolicyMemorySnapshot(),
    getAutonomyState(),
  ]);

  const visitsByUrl = {};
  const visitCutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const visit of visits || []) {
    if (visit.timestamp <= visitCutoff) continue;
    visitsByUrl[visit.normalizedUrl || normalizeUrl(visit.url)] = (visitsByUrl[visit.normalizedUrl || normalizeUrl(visit.url)] || 0) + 1;
  }

  return {
    urlModel: urlModelData[URL_MODEL_KEY] || {},
    groupModel: groupModelData[GROUP_MODEL_KEY] || {},
    protectedContexts,
    recentActivations,
    memorySummary,
    autonomyState,
    visitsByUrl,
    policy,
  };
}

async function decideAutonomousSleepCandidates(tabs, cached, policy) {
  if (!cached?.groups || !cached?.tabMap) return { autonomyState: getDefaultAutonomyState(), automatic: [], observed: [] };

  const frequentUrls = await getFrequentUrls(policy.frequentVisits24h, 24);
  const context = await buildDecisionContext(policy);
  const activeGroupName = context.recentActivations[0]?.groupName || null;
  const automatic = [];
  const observed = [];

  for (const tab of tabs) {
    if (!tab.url || tab.active) continue;
    const { groupName, groupIndex } = findGroupMatch(tab.url, cached);
    const features = await buildTabFeatures(tab, groupName, activeGroupName, policy, context);
    const needScore = scoreNeed(features, policy, frequentUrls);
    const confidence = clamp(1 - needScore, 0, 1);
    const candidate = {
      tab,
      groupName,
      groupIndex,
      features,
      needScore,
      confidence,
      reason: buildSleepReason(features),
      observationReason: buildObservationReason(features),
    };

    if (isAutonomousSleepCandidate(features, policy, frequentUrls, context.autonomyState, needScore)) {
      automatic.push(candidate);
      continue;
    }

    if (context.autonomyState.mode === "observing" && isObservationCandidate(features, policy, frequentUrls)) {
      observed.push(candidate);
    }
  }

  observed.sort((a, b) => a.needScore - b.needScore);

  return {
    autonomyState: context.autonomyState,
    automatic,
    observed: observed.slice(0, OBSERVATION_CANDIDATE_LIMIT),
  };
}

async function runAgentCycle() {
  const policy = await getEffectiveAgentPolicy();
  if (!policy.enabled) return { slept: 0, mode: "disabled" };

  await finalizeAutoSleepOutcomes();

  const { cached, asleepGroups } = await getGroupingState();
  if (!cached?.groups?.length) return { slept: 0, mode: "idle" };

  const tabs = await chrome.tabs.query({});
  const decisions = await decideAutonomousSleepCandidates(
    tabs.filter((tab) => tab.url && !tab.url.startsWith("chrome")),
    cached,
    policy
  );

  if (decisions.autonomyState.mode !== "trusted_autonomy") {
    let observedCount = 0;
    for (const candidate of decisions.observed) {
      if (!(await shouldRecordObservationSuggestion(candidate.tab.url))) continue;

      await appendAgentAction({
        type: "observe_sleep",
        confidence: Number(candidate.confidence.toFixed(2)),
        score: Number(candidate.needScore.toFixed(2)),
        reason: candidate.observationReason,
        features: {
          minutesSinceLastActive: Number(candidate.features.minutesSinceLastActive?.toFixed?.(2) || 0),
          visits24h: candidate.features.visits24h,
          avgReturnMinutes: candidate.features.avgReturnMinutes,
          groupName: candidate.groupName,
          regretCount: candidate.features.regretCount,
          safeSleepCount: candidate.features.safeSleepCount,
          highValueContext: candidate.features.highValueContext,
        },
        target: {
          tabIds: [candidate.tab.id],
          urls: [candidate.tab.url],
          titles: [candidate.tab.title || "Untitled"],
          groupName: candidate.groupName,
          groupIndex: candidate.groupIndex,
        },
        outcome: {
          status: "observing",
          observedAt: Date.now(),
        },
      });
      await rememberObservationSuggestion(candidate.tab.url);
      observedCount += 1;
    }

    return {
      slept: 0,
      observed: observedCount,
      mode: decisions.autonomyState.mode,
    };
  }

  let slept = 0;
  const nextAsleepGroups = { ...(asleepGroups || {}) };

  for (const candidate of decisions.automatic) {
    try {
      await chrome.tabs.discard(candidate.tab.id);
      slept += 1;
      await clearObservationSuggestion(candidate.tab.url);

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
          highValueContext: candidate.features.highValueContext,
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

      await appendTabEvent({
        eventType: "sleep",
        tabId: candidate.tab.id,
        url: candidate.tab.url,
        title: candidate.tab.title || "Untitled",
        groupName: candidate.groupName,
        source: "agent",
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
  return { slept, mode: decisions.autonomyState.mode };
}

async function handleContextWake(activeTab) {
  const autonomyState = await getAutonomyState();
  const { cached, asleepGroups } = await getGroupingState();
  if (!cached?.groups?.length) return { woke: 0, mode: autonomyState.mode };

  const { groupName, groupIndex } = findGroupMatch(activeTab.url, cached);
  if (!groupName || groupIndex < 0) return { woke: 0, mode: autonomyState.mode };

  const asleepTabIds = asleepGroups[groupIndex] || [];
  if (asleepTabIds.length === 0) return { woke: 0, mode: autonomyState.mode };

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
  const titles = asleepTabIds.map((tabId) => cached.tabMap[tabId]?.title || "Untitled");

  await appendAgentAction({
    type: "auto_wake",
    confidence: 0.8,
    score: 0.8,
    reason: buildWakeReason(groupName),
    target: {
      tabIds: asleepTabIds,
      urls,
      titles,
      groupName,
      groupIndex,
    },
    features: {
      triggerUrl: activeTab.url,
      triggerTitle: activeTab.title || "Untitled",
      groupName,
      autonomyMode: autonomyState.mode,
    },
    outcome: {
      status: "executed",
      observedAt: Date.now(),
    },
  });

  const nextAsleepGroups = { ...(asleepGroups || {}) };
  delete nextAsleepGroups[groupIndex];
  await chrome.storage.local.set({ [ASLEEP_GROUPS_KEY]: nextAsleepGroups });

  for (let i = 0; i < urls.length; i += 1) {
    await appendTabEvent({
      eventType: "wake",
      tabId: asleepTabIds[i],
      url: urls[i],
      title: titles[i],
      groupName,
      source: "agent",
    });
  }

  await logEvent("auto_woken", {
    tabCount: asleepTabIds.length,
    groupName,
  });

  return { woke: asleepTabIds.length, mode: autonomyState.mode };
}
