// stats.js - memory measurement, autonomous agent activity, and study submission

const STORAGE_GROUPS_KEY = "cachedGroups";
const STORAGE_ASLEEP_KEY = "asleepGroups";
const STORAGE_SAVED_KEY = "memorySaved";
const STATS_ESTIMATED_MEMORY_PER_TAB_MB = 50;
const ACTION_FEED_LIMIT = 8;
const EVENT_FEED_LIMIT = 12;

function buildExportFilename(participantId) {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const safeParticipantId = String(participantId || "tab-agent").replace(/[^a-z0-9_-]+/gi, "-");
  return `tab-agent-export-${safeParticipantId}-${stamp}.json`;
}

function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function captureDetailsState(root) {
  if (!root) return {};
  const state = {};
  root.querySelectorAll("details[id]").forEach((details) => {
    state[details.id] = details.open;
  });
  return state;
}

function truncateMiddle(text, maxLength = 72) {
  const value = String(text || "");
  if (value.length <= maxLength) return value;
  const head = Math.ceil((maxLength - 3) / 2);
  const tail = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, head)}...${value.slice(value.length - tail)}`;
}

function formatModeLabel(mode) {
  return mode === "trusted_autonomy" ? "Trusted autonomy" : "Observation mode";
}

function buildMiniStat(label, value, tone = "neutral") {
  const toneStyles = {
    neutral: "color:#111827;background:#f9fafb;border:1px solid #eceff3;",
    positive: "color:#166534;background:#f0fdf4;border:1px solid #dcfce7;",
    caution: "color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;",
    info: "color:#1d4ed8;background:#eff6ff;border:1px solid #dbeafe;",
  };

  return `
    <div style="min-width:120px;flex:1;padding:12px 14px;border-radius:10px;${toneStyles[tone] || toneStyles.neutral}">
      <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${escapeHtml(label)}</div>
      <div style="font-size:20px;font-weight:700;">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function renderMemoryTags(items, emptyLabel, tone = "neutral", labelKey = "label") {
  const tones = {
    neutral: "background:#f3f4f6;color:#4b5563;border:1px solid #e5e7eb;",
    caution: "background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;",
    safe: "background:#f0fdf4;color:#166534;border:1px solid #dcfce7;",
    info: "background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;",
  };

  if (!items || items.length === 0) {
    return `<span style="font-size:12px;color:#9ca3af;">${escapeHtml(emptyLabel)}</span>`;
  }

  return items
    .map((item) => {
      const label = item?.[labelKey] || item?.groupName || item?.url || "Untitled";
      return `<span style="display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:600;${tones[tone] || tones.neutral}">${escapeHtml(String(label))}</span>`;
    })
    .join("");
}

function formatSignedReward(value) {
  const amount = Number(value || 0);
  if (amount > 0) return `+${amount}`;
  if (amount < 0) return `${amount}`;
  return "0";
}

function formatOutcomeLabel(outcome) {
  return String(outcome || "pending").replaceAll("_", " ");
}

function formatDecisionTarget(target = {}) {
  return target.groupName || target.title || target.label || "Untitled context";
}

function getRewardTone(reward) {
  if (reward > 0) return "positive";
  if (reward < 0) return "caution";
  return "neutral";
}

function buildRewardWhy(outcome) {
  if (typeof buildRewardExplanation === "function") {
    return buildRewardExplanation(outcome);
  }
  return "No clear positive or negative outcome has been recorded yet.";
}

function buildAutonomyHeadline(autonomyState) {
  if (autonomyState.mode === "trusted_autonomy") {
    return "Trusted autonomy: Tab Agent may sleep only high-confidence, low-risk tabs.";
  }
  return "Observation mode: Tab Agent is learning your patterns before sleeping tabs automatically.";
}

function buildAutonomySupportCopy(autonomyState) {
  const reasons = autonomyState.reasons || [];
  const negativeSignals = autonomyState.signals?.negativeCount || 0;
  const positiveSignals = autonomyState.signals?.positiveCount || 0;

  if (autonomyState.mode === "trusted_autonomy") {
    return "Autonomy is unlocked because recent behavior, feedback, and trust signals are stable enough for conservative automatic sleeping.";
  }
  if (negativeSignals > positiveSignals + 1) {
    return "Autonomy is blocked because recent mistakes or regret signals require more caution.";
  }
  if (reasons.length) {
    return "Autonomy is not unlocked yet because the agent still needs more history, feedback, or stability before it should act automatically.";
  }
  return "Autonomy is still being earned. The agent prefers missing a sleep over breaking focus.";
}

function buildNeededSignals(autonomyState) {
  const signals = autonomyState.signals || {};
  const needs = [];

  if ((signals.historyEvents || 0) < 4 && (signals.recentVisits || 0) < 15 && (signals.recentActivations || 0) < 8) {
    needs.push("more real browsing history");
  }
  if ((signals.positiveCount || 0) < 2 && (signals.protectCount || 0) < 1) {
    needs.push("more feedback or safe outcomes");
  }
  if ((signals.negativeCount || 0) > (signals.positiveCount || 0) + 1) {
    needs.push("fewer recent regret or undo signals");
  }

  return needs;
}

function splitCurrentAndLearnedAreas(items, exportData) {
  const openTabs = exportData.openTabsSnapshot || [];
  const openGroups = new Set((exportData.groups || []).filter((group) => group.openTabCount > 0).map((group) => group.name));
  const openUrls = new Set(openTabs.map((tab) => normalizeUrl(tab.url)));
  const openTitles = new Set(openTabs.map((tab) => String(tab.title || "").trim()).filter(Boolean));

  const current = [];
  const learned = [];

  for (const item of items || []) {
    const label = String(item?.label || item?.groupName || "").trim();
    const key = item?.key ? normalizeUrl(item.key) : "";
    const matchesCurrent =
      (item?.type === "group" && openGroups.has(label)) ||
      (key && openUrls.has(key)) ||
      (label && openTitles.has(label));

    if (matchesCurrent) {
      current.push(item);
    } else {
      learned.push(item);
    }
  }

  return { current, learned };
}

document.addEventListener("DOMContentLoaded", async () => {
  await renderAll();

  setInterval(async () => {
    const data = await chrome.storage.local.get(STORAGE_GROUPS_KEY);
    if (!data[STORAGE_GROUPS_KEY]) {
      await renderAll();
    } else {
      await refreshMemory();
      await renderAgentActivitySection();
    }
  }, 5000);
});

async function renderAll() {
  const data = await chrome.storage.local.get([
    STORAGE_GROUPS_KEY,
    STORAGE_ASLEEP_KEY,
    STORAGE_SAVED_KEY,
  ]);

  const cached = data[STORAGE_GROUPS_KEY] || null;
  const asleep = data[STORAGE_ASLEEP_KEY] || {};
  const savedMB = data[STORAGE_SAVED_KEY] || 0;

  document.getElementById("memory-saved").textContent = savedMB.toFixed(1);
  await renderAgentActivitySection();
  await renderSubmitSection();

  if (!cached || !cached.groups) {
    document.getElementById("tab-count").textContent = "-";
    document.getElementById("group-count").textContent = "-";
    document.getElementById("total-memory").textContent = "-";
    document.getElementById("no-data").textContent =
      "No groups cached yet - click the Tab Agent icon in your toolbar to group your tabs first, then come back here.";
    document.getElementById("no-data").style.display = "block";
    const form = document.getElementById("rating-form");
    if (form) {
      form.innerHTML = `<p id="no-groups-msg" style="font-size:13px;color:#888;">No groups to rate - open the popup first.</p>`;
    }
    document.getElementById("score-result").style.display = "none";
    return;
  }

  const { groups, tabMap } = cached;
  const openTabs = await chrome.tabs.query({});
  const realTabIds = new Set(openTabs.map((tab) => tab.id));
  const realUrls = new Set(openTabs.map((tab) => normalizeUrl(tab.url)).filter(Boolean));
  const groupUrls = groups.flatMap((group) =>
    group.tabIds.map((id) => normalizeUrl(tabMap[id]?.url)).filter(Boolean)
  );
  const openCount = groupUrls.filter((url) => realUrls.has(url)).length;

  document.getElementById("tab-count").textContent = openCount;
  document.getElementById("group-count").textContent = groups.length;

  await renderGroupTable(groups, tabMap, asleep, realTabIds, realUrls);
  renderRatingForm(groups, tabMap);
}

async function refreshMemory() {
  const data = await chrome.storage.local.get([
    STORAGE_GROUPS_KEY,
    STORAGE_ASLEEP_KEY,
    STORAGE_SAVED_KEY,
  ]);

  const cached = data[STORAGE_GROUPS_KEY] || null;
  const asleep = data[STORAGE_ASLEEP_KEY] || {};
  const savedMB = data[STORAGE_SAVED_KEY] || 0;

  if (!cached) return;

  const openTabs = await chrome.tabs.query({});
  const realTabIds = new Set(openTabs.map((tab) => tab.id));
  const realUrls = new Set(openTabs.map((tab) => normalizeUrl(tab.url)).filter(Boolean));
  const groupUrls = cached.groups.flatMap((group) =>
    group.tabIds.map((id) => normalizeUrl(cached.tabMap[id]?.url)).filter(Boolean)
  );

  const openCount = groupUrls.filter((url) => realUrls.has(url)).length;
  document.getElementById("tab-count").textContent = openCount;
  document.getElementById("group-count").textContent = cached.groups.length;
  document.getElementById("memory-saved").textContent = savedMB.toFixed(1);

  await renderGroupTable(cached.groups, cached.tabMap, asleep, realTabIds, realUrls);
}

async function renderGroupTable(groups, tabMap, asleep, realTabIds, realUrls) {
  const wrap = document.getElementById("group-table-wrap");

  const groupMemories = groups.map((group) => {
    const openInGroup = group.tabIds.filter((id) => {
      const url = normalizeUrl(tabMap[id]?.url);
      return url && realUrls.has(url);
    }).length;
    return openInGroup * STATS_ESTIMATED_MEMORY_PER_TAB_MB;
  });
  const maxMem = Math.max(...groupMemories, 1);
  const estimatedTotalMem = groupMemories.reduce((sum, memory) => sum + memory, 0);

  document.getElementById("total-memory").textContent = estimatedTotalMem.toFixed(1);

  let html = `
    <table>
      <thead>
        <tr>
          <th style="width:35%">Group</th>
          <th style="width:15%">Tabs</th>
          <th style="width:15%">Status</th>
          <th style="width:35%">Memory</th>
        </tr>
      </thead>
      <tbody>
  `;

  groups.forEach((group, i) => {
    const isAsleep = !!asleep[i];
    const estMB = groupMemories[i];
    const pct = maxMem > 0 ? (estMB / maxMem) * 100 : 0;
    const openInGroup = group.tabIds.filter((id) => {
      const url = normalizeUrl(tabMap[id]?.url);
      return url && realUrls.has(url);
    }).length;
    const statusPill = isAsleep
      ? `<span class="status-pill pill-asleep">asleep</span>`
      : `<span class="status-pill pill-awake">awake</span>`;

    html += `
      <tr>
        <td class="group-name-cell">${escapeHtml(group.name)}</td>
        <td>${group.tabIds.length}</td>
        <td>${statusPill}</td>
        <td>
          <div class="mem-bar-wrap">
            <div class="mem-bar-bg">
              <div class="mem-bar-fill ${isAsleep ? "asleep" : ""}" style="width:${pct}%"></div>
            </div>
            <span class="mem-label">~${estMB.toFixed(0)} MB</span>
          </div>
          <div style="font-size:12px;color:#888;margin-top:4px;">
            ${openInGroup} open tab${openInGroup !== 1 ? "s" : ""} - estimated
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>
    <p style="font-size:11px;color:#aaa;margin-top:10px;">
      Memory shown is estimated at ~50MB per tab - actual usage varies by page.
      Real per-tab data requires Chrome Dev channel.
    </p>`;

  wrap.innerHTML = html;
  if (document.getElementById("no-data")) {
    document.getElementById("no-data").style.display = "none";
  }
}

async function renderAgentActivitySection() {
  const wrap = document.getElementById("agent-activity-wrap");
  if (!wrap) return;

  const [actions, openAiSummary, tabEvents, exportData, conservativeDecisions] = await Promise.all([
    getAgentActionLog(ACTION_FEED_LIMIT),
    getOpenAiPolicySummary(),
    typeof getTabEventLog === "function" ? getTabEventLog(EVENT_FEED_LIMIT) : Promise.resolve([]),
    loadExportData(),
    typeof getRecentConservativeDecisions === "function" ? getRecentConservativeDecisions(4) : Promise.resolve([]),
  ]);

  const autonomyState = exportData.autonomyState || {};
  const memorySummary = exportData.agentMemorySummary || {};
  const evaluationSummary = exportData.evaluationSummary || {};
  const autoSummary = exportData.autonomousSummary || {};
  const rewardLedger = (exportData.rewardLedger || []).slice(0, 6);
  const cautionAreas = (memorySummary.cautionAreas || []).slice(0, 5);
  const safeAreas = (memorySummary.safeSleepAreas || []).slice(0, 5);
  const wakePatterns = (memorySummary.wakePatterns || []).slice(0, 3);
  const cautionSplit = splitCurrentAndLearnedAreas(cautionAreas, exportData);
  const safeSplit = splitCurrentAndLearnedAreas(safeAreas, exportData);
  const explicitGood = autoSummary.explicitGoodCount ?? 0;
  const frictionCount =
    (evaluationSummary.feedbackSpecificErrors?.undoCount ?? autoSummary.undoCount ?? 0) +
    (evaluationSummary.feedbackSpecificErrors?.regretCount ?? autoSummary.regretCount ?? 0) +
    (evaluationSummary.feedbackSpecificErrors?.explicitBadCount ?? autoSummary.explicitBadCount ?? 0);
  const trustPercent = Math.round((autonomyState.progress || 0) * 100);

  if (!actions.length && !openAiSummary && !tabEvents.length && !autonomyState.mode) {
    wrap.innerHTML = `
      <p style="font-size:13px;color:#888;margin-bottom:10px;">No agent activity yet.</p>
      <p style="font-size:12px;color:#aaa;">Use the popup a bit first. This page will start showing trust progress, learned context, and recent actions.</p>
    `;
    return;
  }

  const summaryHtml = openAiSummary
    ? `
      <div style="margin-bottom:14px;padding:12px 14px;background:#f7fbff;border:1px solid #d9ecfb;border-radius:10px;">
        <div style="font-size:12px;font-weight:600;color:#1a6fa3;margin-bottom:6px;">Advisory summary</div>
        <div style="font-size:12px;color:#555;line-height:1.5;">${escapeHtml(openAiSummary.summary || "No summary yet.")}</div>
        ${Array.isArray(openAiSummary.recommendations) && openAiSummary.recommendations.length
          ? `<div style="font-size:11px;color:#6b7280;margin-top:8px;">${escapeHtml(openAiSummary.recommendations.slice(0, 2).join(" | "))}</div>`
          : ""}
      </div>
    `
    : "";

  const actionCards = actions.map((action) => {
    const badgeColor = action.type === "auto_sleep" ? "#b26d00" : "#1a6fa3";
    const canUndo = action.type === "auto_sleep" && action.outcome?.status !== "undo";

    return `
      <div style="padding:12px 14px;border:1px solid #eee;border-radius:8px;background:#fafafa;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${badgeColor};">${escapeHtml(action.type.replace("_", " "))}</span>
              <span style="font-size:11px;color:#888;">${(Number(action.confidence || 0) * 100).toFixed(0)}%</span>
              <span style="font-size:11px;color:#888;">${new Date(action.createdAt).toLocaleTimeString()}</span>
            </div>
            <div style="font-size:13px;font-weight:600;color:#333;margin-top:6px;">
              ${escapeHtml(action.target?.groupName || action.target?.titles?.[0] || "Untitled target")}
            </div>
            <div style="font-size:12px;color:#555;line-height:1.5;margin-top:4px;">
              ${escapeHtml(action.reason || "No explanation recorded.")}
            </div>
            <div style="font-size:12px;color:#888;margin-top:6px;">
              ${escapeHtml(action.outcome?.status || "pending")}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            ${canUndo ? `<button class="btn btn-secondary" data-agent-action="undo" data-action-id="${action.id}" style="margin-left:0;">Undo</button>` : ""}
            <button class="btn btn-secondary" data-agent-action="protect" data-action-id="${action.id}" style="margin-left:0;">Protect</button>
            <button class="btn btn-secondary" data-agent-action="good" data-action-id="${action.id}" style="margin-left:0;">Good</button>
            <button class="btn btn-secondary" data-agent-action="bad" data-action-id="${action.id}" style="margin-left:0;">Bad</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const eventCards = tabEvents.slice(0, EVENT_FEED_LIMIT).map((event) => `
    <div style="padding:10px 12px;border:1px solid #eee;border-radius:8px;background:#fff;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#555;">${escapeHtml(String(event.eventType || "unknown").replaceAll("_", " "))}</span>
            <span style="font-size:11px;color:#888;">${escapeHtml(event.source || "user")}</span>
          </div>
          <div style="font-size:12px;font-weight:600;color:#333;margin-top:4px;">
            ${escapeHtml(event.groupName || event.title || "Untitled")}
          </div>
          <div style="font-size:12px;color:#666;line-height:1.5;margin-top:2px;">
            ${escapeHtml(truncateMiddle(event.url || ""))}
          </div>
        </div>
        <div style="font-size:11px;color:#888;white-space:nowrap;">${new Date(event.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  `).join("");

  const detailsState = captureDetailsState(wrap);
  const autonomyReasons = (autonomyState.reasons || [])
    .map((reason) => `<li style="margin-left:18px;color:#4b5563;line-height:1.5;">${escapeHtml(reason)}</li>`)
    .join("");
  const neededSignals = buildNeededSignals(autonomyState)
    .map((item) => `<span style="display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#f3f4f6;color:#4b5563;border:1px solid #e5e7eb;">${escapeHtml(item)}</span>`)
    .join("");
  const rewardRows = rewardLedger.map((entry) => {
    const tone = getRewardTone(entry.reward);
    const toneStyles = {
      positive: "color:#166534;background:#f0fdf4;border:1px solid #dcfce7;",
      caution: "color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;",
      neutral: "color:#4b5563;background:#f9fafb;border:1px solid #eceff3;",
    };
    return `
      <tr>
        <td>${new Date(entry.time).toLocaleTimeString()}</td>
        <td>${escapeHtml(formatDecisionTarget(entry.target))}</td>
        <td>${escapeHtml(formatOutcomeLabel(entry.outcome))}</td>
        <td><span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;${toneStyles[tone]}">${escapeHtml(formatSignedReward(entry.reward))}</span></td>
        <td style="line-height:1.5;color:#555;">${escapeHtml(entry.why || buildRewardWhy(entry.outcome))}</td>
      </tr>
    `;
  }).join("");
  const conservativeCards = conservativeDecisions.map((decision) => `
    <div style="padding:12px 14px;border:1px solid #eee;border-radius:8px;background:#fff;">
      <div style="font-size:12px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(decision.label || "Conservative decision")}</div>
      <div style="font-size:13px;font-weight:600;color:#333;margin-top:6px;">${escapeHtml(formatDecisionTarget(decision.target))}</div>
      <div style="font-size:12px;color:#555;line-height:1.5;margin-top:4px;">${escapeHtml(decision.reason || "The agent stayed cautious here.")}</div>
    </div>
  `).join("");
  const trustSummary = `
    <div style="display:grid;gap:12px;">
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${buildMiniStat("Mode", formatModeLabel(autonomyState.mode), autonomyState.mode === "trusted_autonomy" ? "positive" : "info")}
        ${buildMiniStat("Trust progress", `${trustPercent}%`, autonomyState.mode === "trusted_autonomy" ? "positive" : "info")}
        ${buildMiniStat("Recent wins", explicitGood + (evaluationSummary.wakeSuccessCount ?? 0), "positive")}
        ${buildMiniStat("Recent friction", frictionCount, frictionCount > 0 ? "caution" : "neutral")}
      </div>
      <div style="padding:14px;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;">
        <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:6px;">${escapeHtml(buildAutonomyHeadline(autonomyState))}</div>
        <div style="font-size:12px;color:#375a7f;line-height:1.6;">${escapeHtml(buildAutonomySupportCopy(autonomyState))}</div>
        ${autonomyReasons
          ? `<ul style="margin:10px 0 0 0;padding:0;">${autonomyReasons}</ul>`
          : ""}
        ${neededSignals
          ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">${neededSignals}</div>`
          : ""}
      </div>
      <div style="padding:14px;border:1px solid #eceff3;border-radius:10px;background:#fafafa;">
        <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">How the agent learns</div>
        <div style="font-size:12px;color:#555;line-height:1.6;margin-bottom:10px;">Tab Agent learns from both explicit feedback and implicit browser behavior. It stays conservative on purpose because it is better to miss a sleep than to break focus.</div>
        <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
          <div style="padding:12px;border:1px solid #dcfce7;border-radius:10px;background:#f0fdf4;">
            <div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:8px;">Positive signals</div>
            <div style="font-size:12px;color:#166534;line-height:1.6;">Tab stayed asleep for 15 minutes: safe outcome</div>
            <div style="font-size:12px;color:#166534;line-height:1.6;">User clicked Good</div>
          </div>
          <div style="padding:12px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;">
            <div style="font-size:12px;font-weight:700;color:#9a3412;margin-bottom:8px;">Negative or caution signals</div>
            <div style="font-size:12px;color:#9a3412;line-height:1.6;">User reopened a slept tab quickly</div>
            <div style="font-size:12px;color:#9a3412;line-height:1.6;">User manually woke a slept group</div>
            <div style="font-size:12px;color:#9a3412;line-height:1.6;">User clicked Undo, Bad, or Protect</div>
          </div>
        </div>
      </div>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
        <div style="padding:12px 14px;border:1px solid #eceff3;border-radius:10px;background:#fff;">
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">What I'm protecting</div>
          <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-bottom:8px;">Protected groups, regretted URLs, and contexts where focus seems fragile.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">${renderMemoryTags(cautionSplit.current.concat(cautionSplit.learned), "No protected or caution-heavy area yet.", "caution")}</div>
        </div>
        <div style="padding:12px 14px;border:1px solid #eceff3;border-radius:10px;background:#fff;">
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">What seems safe to sleep</div>
          <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-bottom:8px;">URLs and groups with repeated low-regret sleep outcomes.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">${renderMemoryTags(safeSplit.learned.concat(safeSplit.current), "Still learning safe contexts.", "safe")}</div>
        </div>
        <div style="padding:12px 14px;border:1px solid #eceff3;border-radius:10px;background:#fff;">
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">Where wake helped</div>
          <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-bottom:8px;">Contexts where waking related tabs looked useful after re-entry.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">${renderMemoryTags(wakePatterns, "No useful wake pattern yet.", "info")}</div>
        </div>
      </div>
    </div>
  `;
  const baselineMinutes = exportData.baselineComparison?.fixedRuleThresholdMinutes ?? 30;

  wrap.innerHTML = `
    ${trustSummary}
    ${summaryHtml}
    <div style="margin-top:16px;padding:14px;border:1px solid #eceff3;border-radius:10px;background:#fff;">
      <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">Reward ledger</div>
      <div style="font-size:12px;color:#555;line-height:1.6;margin-bottom:10px;">Recent autonomous sleep actions are translated into simple reward-shaped signals. This helps tune the local policy without turning Tab Agent into a full online RL system.</div>
      ${rewardRows
        ? `<table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Target/context</th>
                <th>Outcome</th>
                <th>Reward</th>
                <th>Why this reward was assigned</th>
              </tr>
            </thead>
            <tbody>${rewardRows}</tbody>
          </table>`
        : `<div style="font-size:12px;color:#888;">No autonomous sleep outcomes yet. Once the agent sleeps tabs, this ledger will show what happened and how it affected future caution.</div>`}
    </div>
    <div style="margin-top:16px;padding:14px;border:1px solid #eceff3;border-radius:10px;background:#fff;">
      <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">Recent conservative decisions</div>
      <div style="font-size:12px;color:#555;line-height:1.6;margin-bottom:10px;">These are examples of why the agent held back instead of sleeping a tab. The goal is to make caution visible, not invisible.</div>
      ${conservativeCards
        ? `<div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">${conservativeCards}</div>`
        : `<div style="font-size:12px;color:#888;">No conservative decisions to highlight yet.</div>`}
    </div>
    <div style="margin-top:16px;padding:14px;border:1px solid #eceff3;border-radius:10px;background:#fff;">
      <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">Evaluation framing</div>
      <div style="font-size:12px;color:#555;line-height:1.6;margin-bottom:10px;">The comparison here is product and research framing, not a claim that Tab Agent always wins. The hard part of tab management is regret, so the point is to compare memory savings against interruption cost.</div>
      <table>
        <thead>
          <tr>
            <th>Approach</th>
            <th>Personalization</th>
            <th>Autonomy</th>
            <th>Feedback loop</th>
            <th>Risk control</th>
            <th>Explainability</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Static rule</td>
            <td>None</td>
            <td>Sleep anything inactive after ~${baselineMinutes} min</td>
            <td>No</td>
            <td>Low</td>
            <td>High</td>
          </tr>
          <tr>
            <td>Manual assistant</td>
            <td>User-driven</td>
            <td>Manual grouping, sleep, and wake</td>
            <td>Only through the user</td>
            <td>High</td>
            <td>High</td>
          </tr>
          <tr>
            <td>Tab Agent</td>
            <td>Local behavior model</td>
            <td>Conservative autonomous sleep and context wake</td>
            <td>Explicit and implicit</td>
            <td>Caution-first</td>
            <td>High</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin:14px 0 12px;">
      <div style="font-size:12px;color:#666;">Review and export</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <button class="btn btn-secondary" id="export-agent-data">Export data</button>
        <button class="btn btn-primary" id="generate-openai-summary">Generate AI summary</button>
      </div>
    </div>
    <details id="agent-actions-details" style="border:1px solid #eee;border-radius:8px;background:#fcfcfc;" ${detailsState["agent-actions-details"] ? "open" : ""}>
      <summary style="padding:10px 12px;cursor:pointer;font-size:12px;color:#666;font-weight:600;list-style:none;">
        Recent actions (${actions.length})
      </summary>
      <div style="padding:12px;border-top:1px solid #f0f0f0;">
        ${actionCards
          ? `<div style="display:grid;gap:10px;">${actionCards}</div>`
          : `<div style="font-size:12px;color:#888;">No autonomous actions captured yet.</div>`}
      </div>
    </details>
    <div style="margin-top:16px;">
      <details id="tab-event-details" style="border:1px solid #eee;border-radius:8px;background:#fcfcfc;" ${detailsState["tab-event-details"] ? "open" : ""}>
        <summary style="padding:10px 12px;cursor:pointer;font-size:12px;color:#666;font-weight:600;list-style:none;">
          Event log (${tabEvents.length})
        </summary>
        <div style="padding:0 12px 12px 12px;border-top:1px solid #f0f0f0;">
          <div style="font-size:11px;color:#888;margin:10px 0;">
            Showing the newest ${Math.min(tabEvents.length, EVENT_FEED_LIMIT)} lifecycle events.
          </div>
          ${eventCards
            ? `<div style="display:grid;gap:8px;">${eventCards}</div>`
            : `<div style="font-size:12px;color:#888;">No tab events yet.</div>`}
        </div>
      </details>
    </div>
    <div id="agent-feedback-status" style="font-size:12px;color:#666;margin-top:10px;"></div>
  `;

  wrap.querySelectorAll("details button").forEach((button) => {
    const stopToggle = (event) => event.stopPropagation();
    button.addEventListener("pointerdown", stopToggle);
    button.addEventListener("click", stopToggle);
  });

  wrap.querySelectorAll("[data-agent-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const actionId = button.dataset.actionId;
      const type = button.dataset.agentAction;
      const status = document.getElementById("agent-feedback-status");
      status.textContent = "Updating...";

      try {
        if (type === "undo") {
          await undoAgentAction(actionId);
        } else if (type === "protect") {
          await protectActionTarget(actionId);
        } else if (type === "good" || type === "bad") {
          await recordExplicitActionFeedback(actionId, type);
        }

        status.textContent = "Action feedback saved.";
        await renderAgentActivitySection();
      } catch (error) {
        status.textContent = `Could not update action: ${error.message}`;
        status.style.color = "#c0392b";
      }
    });
  });

  const exportButton = document.getElementById("export-agent-data");
  if (exportButton) {
    exportButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const status = document.getElementById("agent-feedback-status");
      exportButton.disabled = true;
      exportButton.textContent = "Exporting...";
      status.textContent = "Preparing export...";
      status.style.color = "#666";

      try {
        const payload = await loadExportData();
        downloadJsonFile(buildExportFilename(payload.participantId), payload);
        status.textContent = "Export downloaded.";
      } catch (error) {
        status.textContent = `Export failed: ${error.message}`;
        status.style.color = "#c0392b";
      } finally {
        exportButton.disabled = false;
        exportButton.textContent = "Export data";
      }
    });
  }

  const summaryButton = document.getElementById("generate-openai-summary");
  if (summaryButton) {
    summaryButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const status = document.getElementById("agent-feedback-status");
      summaryButton.disabled = true;
      summaryButton.textContent = "Generating...";
      status.textContent = "Generating OpenAI summary...";
      status.style.color = "#666";

      try {
        const payload = await loadExportData();
        const response = await fetch("https://tab-agent-web.vercel.app/api/agent-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Server error ${response.status}`);
        }

        const json = await response.json();
        await saveOpenAiPolicySummary(json);
        status.textContent = "OpenAI summary updated.";
        await renderAgentActivitySection();
      } catch (error) {
        status.textContent = `Summary failed: ${error.message}`;
        status.style.color = "#c0392b";
      } finally {
        summaryButton.disabled = false;
        summaryButton.textContent = "Generate AI summary";
      }
    });
  }
}

async function renderSubmitSection() {
  const wrap = document.getElementById("submit-wrap");
  if (!wrap) return;

  wrap.innerHTML = `<div style="font-size:12px;color:#666;padding:8px 0;">Loading study submission form...</div>`;

  try {
    const participantId = await loadParticipantId();
    const savedResponses = await loadStudyResponses();

    wrap.innerHTML = `
      <div style="margin-top:8px;">
        <p style="font-size:13px;color:#555;margin-bottom:14px;line-height:1.6;">
          Submitting your data helps validate the research claims for this project.
          The study payload can include grouped tab metadata, event logs, action outcomes, and learning signals used for benchmarking. Do not submit if your current tabs include sensitive information. Memory values are estimated.
        </p>
        <div style="font-size:12px;color:#555;margin-bottom:10px;">
          Participant ID: <strong>${escapeHtml(participantId)}</strong>
        </div>
        <div style="display:grid;gap:12px;margin-bottom:14px;">
          ${renderStudyQuestion("grouping-useful", "Was the grouping useful?", savedResponses.groupingUseful)}
          ${renderStudyQuestion("trust-sleep-close", "Did you trust the sleep/close suggestions?", savedResponses.trustSleepClose)}
          ${renderStudyQuestion("would-use-real", "Would you use this in real browsing?", savedResponses.wouldUseInRealBrowsing)}
        </div>
        <div id="submit-preview" style="background:#f7f7f7;border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;font-size:12px;color:#555;margin-bottom:14px;line-height:1.8;">
          Loading data preview...
        </div>
        <button id="submit-btn" style="padding:8px 20px;background:#1a6fa3;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;">
          Submit to study
        </button>
        <span id="submit-status" style="font-size:12px;margin-left:12px;color:#555;"></span>
      </div>
    `;

    const exportData = await loadExportData();
    const autoSummary = exportData.autonomousSummary || {};
    const baseline = exportData.baselineComparison || {};
    document.getElementById("submit-preview").innerHTML = `
      Participant ID: <strong>${escapeHtml(exportData.participantId || participantId)}</strong> &nbsp;-&nbsp;
      Tabs: <strong>${exportData.tabCount ?? 0}</strong> &nbsp;-&nbsp;
      Groups: <strong>${exportData.groupCount ?? 0}</strong> &nbsp;-&nbsp;
      Open tabs: <strong>${exportData.openTabCount ?? 0}</strong> &nbsp;-&nbsp;
      Asleep tabs: <strong>${exportData.asleepTabCount ?? 0}</strong><br>
      Sessions logged: <strong>${(exportData.sessionLog || []).length}</strong> &nbsp;-&nbsp;
      Rating sessions: <strong>${exportData.ratingCount ?? 0}</strong> &nbsp;-&nbsp;
      Avg rating: <strong>${Number(exportData.avgRating ?? 0).toFixed(1)}/5</strong> &nbsp;-&nbsp;
      Memory saved: <strong>${Number(exportData.memorySavedEstimateMb ?? exportData.memorySaved ?? 0).toFixed(0)} MB est.</strong> &nbsp;-&nbsp;
      Total tab memory: <strong>${Number(exportData.totalTabMemoryEstimateMb ?? 0).toFixed(0)} MB est.</strong> &nbsp;-&nbsp;
      Tab visits tracked: <strong>${exportData.visitCount ?? 0}</strong><br>
      Auto-sleeps: <strong>${autoSummary.autoSleepCount ?? 0}</strong> &nbsp;-&nbsp;
      Auto-wakes: <strong>${autoSummary.autoWakeCount ?? 0}</strong> &nbsp;-&nbsp;
      Undo count: <strong>${autoSummary.undoCount ?? 0}</strong> &nbsp;-&nbsp;
      Regret count: <strong>${autoSummary.regretCount ?? 0}</strong> &nbsp;-&nbsp;
      Rule baseline est.: <strong>${baseline.estimatedRuleMemorySavedMb ?? 0} MB</strong>
    `;

    document.getElementById("submit-btn").addEventListener("click", async () => {
      const btn = document.getElementById("submit-btn");
      const status = document.getElementById("submit-status");
      const studyResponses = {
        groupingUseful: getSelectedStudyValue("grouping-useful"),
        trustSleepClose: getSelectedStudyValue("trust-sleep-close"),
        wouldUseInRealBrowsing: getSelectedStudyValue("would-use-real"),
      };

      if (Object.values(studyResponses).some((value) => value === null)) {
        status.textContent = "Please answer all three study questions before submitting.";
        status.style.color = "#c0392b";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Submitting...";
      btn.style.background = "";
      status.textContent = "";
      status.style.color = "";

      try {
        await saveStudyResponses(studyResponses);
        const data = await loadExportData();
        const res = await fetch("https://tab-agent-web.vercel.app/api/collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          btn.textContent = "Submitted!";
          btn.style.background = "#2e7d32";
          status.textContent = "Thank you - your data has been recorded.";
        } else {
          const responseText = await res.text();
          throw new Error(`Server error ${res.status}: ${responseText || res.statusText}`);
        }
      } catch (error) {
        btn.disabled = false;
        btn.textContent = "Submit to study";
        status.textContent = `Submission failed: ${error.message}`;
        status.style.color = "#c0392b";
        console.error("Tab Agent submit failed:", error);
      }
    });
  } catch (error) {
    wrap.innerHTML = `
      <div style="font-size:12px;color:#c0392b;line-height:1.6;">
        Could not load the study submission form.<br>
        ${escapeHtml(error.message || "Unknown error")}
      </div>
    `;
    console.error("Tab Agent stats submit UI failed:", error);
  }
}

function renderRatingForm(groups, tabMap) {
  const form = document.getElementById("rating-form");
  const noMsg = document.getElementById("no-groups-msg");
  if (noMsg) noMsg.remove();

  form.innerHTML = "";
  const ratings = {};

  groups.forEach((group, i) => {
    const tabTitles = group.tabIds
      .map((id) => tabMap[id]?.title || "Unknown tab")
      .slice(0, 5)
      .join(", ");
    const more = group.tabIds.length > 5 ? ` +${group.tabIds.length - 5} more` : "";

    const block = document.createElement("div");
    block.className = "group-rating";

    block.innerHTML = `
      <div class="group-rating-name">${escapeHtml(group.name)}</div>
      <div class="rating-tabs">${escapeHtml(tabTitles)}${more}</div>
      <div class="stars" id="stars-${i}">
        ${[1, 2, 3, 4, 5].map((n) => `
          <div class="star" data-group="${i}" data-val="${n}" title="${ratingLabel(n)}">
            ${n <= 2 ? "x" : n === 3 ? "~" : "v"}
          </div>
        `).join("")}
      </div>
      <div class="rating-label" id="rating-label-${i}">Rate how well this group matches your mental model</div>
    `;

    form.appendChild(block);

    block.querySelectorAll(".star").forEach((star) => {
      star.addEventListener("click", () => {
        const g = parseInt(star.dataset.group, 10);
        const v = parseInt(star.dataset.val, 10);
        ratings[g] = v;

        block.querySelectorAll(".star").forEach((ratingStar) => {
          ratingStar.classList.toggle("selected", parseInt(ratingStar.dataset.val, 10) <= v);
        });

        document.getElementById(`rating-label-${g}`).textContent = `${v}/5 - ${ratingLabel(v)}`;
        updateScore(ratings, groups.length);
      });
    });
  });

  const btnRow = document.createElement("div");
  btnRow.style.marginTop = "16px";
  btnRow.innerHTML = `
    <button class="btn btn-primary" id="save-ratings">Save ratings</button>
    <button class="btn btn-secondary" id="clear-ratings">Clear</button>
  `;
  form.appendChild(btnRow);

  document.getElementById("save-ratings").addEventListener("click", async () => {
    await saveRatings(ratings, groups);
  });

  document.getElementById("clear-ratings").addEventListener("click", () => {
    form.querySelectorAll(".star").forEach((star) => star.classList.remove("selected"));
    Object.keys(ratings).forEach((key) => delete ratings[key]);
    document.getElementById("score-result").style.display = "none";
    groups.forEach((_, i) => {
      const label = document.getElementById(`rating-label-${i}`);
      if (label) label.textContent = "Rate how well this group matches your mental model";
    });
  });
}

function updateScore(ratings, total) {
  const keys = Object.keys(ratings);
  if (keys.length < total) return;

  const avg = keys.reduce((sum, key) => sum + ratings[key], 0) / keys.length;
  const pct = Math.round((avg / 5) * 100);

  const result = document.getElementById("score-result");
  result.style.display = "block";
  result.innerHTML = `
    Agreement score: <strong>${pct}%</strong> (avg ${avg.toFixed(1)}/5 across ${total} groups)
    <br><span style="font-size:12px;font-weight:400;color:#555;">
    ${pct >= 80 ? "Strong agreement - groupings match your mental model well"
      : pct >= 60 ? "Moderate agreement - some groups made sense, some did not"
      : "Low agreement - groupings need improvement"}
    </span>
  `;
}

async function saveRatings(ratings, groups) {
  const values = Object.values(ratings);
  const entry = {
    timestamp: Date.now(),
    groupCount: groups.length,
    ratings,
    avgScore: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
  };

  const data = await chrome.storage.local.get("ratingHistory");
  const history = data.ratingHistory || [];
  history.push(entry);
  await chrome.storage.local.set({ ratingHistory: history });

  const btn = document.getElementById("save-ratings");
  btn.textContent = "Saved!";
  btn.style.background = "#2e7d32";
  setTimeout(() => {
    btn.textContent = "Save ratings";
    btn.style.background = "";
  }, 2000);
}

function ratingLabel(n) {
  return ["", "Completely wrong", "Mostly wrong", "Partially right", "Mostly right", "Perfect"][n];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderStudyQuestion(name, label, selectedValue) {
  return `
    <div style="font-size:12px;">
      <div style="margin-bottom:6px;font-weight:600;color:#333;">${escapeHtml(label)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${[1, 2, 3, 4, 5].map((value) => `
          <label style="display:flex;align-items:center;gap:4px;color:#555;">
            <input type="radio" name="${name}" value="${value}" ${selectedValue === value ? "checked" : ""}>
            <span>${value}</span>
          </label>
        `).join("")}
      </div>
      <div style="margin-top:4px;color:#888;">1 = low, 5 = high</div>
    </div>
  `;
}

function getSelectedStudyValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? Number(checked.value) : null;
}

async function loadParticipantId() {
  if (typeof getParticipantId === "function") {
    return getParticipantId();
  }

  const data = await chrome.storage.local.get("participantId");
  if (data.participantId) return data.participantId;

  const participantId = `TA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  await chrome.storage.local.set({ participantId });
  return participantId;
}

async function loadStudyResponses() {
  if (typeof getStudyResponses === "function") {
    return getStudyResponses();
  }

  const data = await chrome.storage.local.get("studyResponses");
  return data.studyResponses || {
    groupingUseful: null,
    trustSleepClose: null,
    wouldUseInRealBrowsing: null,
  };
}

async function loadExportData() {
  if (typeof getAllDataForExport === "function") {
    return getAllDataForExport();
  }

  const data = await chrome.storage.local.get(null);
  return {
    participantId: data.participantId || await loadParticipantId(),
    exportedAt: new Date().toISOString(),
    sessionLog: data.sessionLog || [],
    ratingHistory: data.ratingHistory || [],
    memorySaved: data.memorySaved || 0,
    visitCount: (data.visits || []).length,
    tabCount: 0,
    openTabCount: 0,
    groupCount: 0,
    asleepGroupCount: 0,
    asleepTabCount: 0,
    ratingCount: 0,
    avgRating: 0,
    memorySavedEstimateMb: data.memorySaved || 0,
    totalTabMemoryEstimateMb: 0,
    memoryMetricsAreEstimated: true,
    studyResponses: await loadStudyResponses(),
    groups: [],
    autonomousSummary: {},
    baselineComparison: {},
    rewardLedger: [],
  };
}

