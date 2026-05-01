// popup.js - popup surface for grouping, sleeping, waking, and trust status

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const groupsEl = document.getElementById("groups");
const regroupBtn = document.getElementById("regroup-btn");
const statsBtn = document.getElementById("stats-btn");

const STORAGE_GROUPS_KEY = "cachedGroups";
const STORAGE_ASLEEP_KEY = "asleepGroups";
const STORAGE_SAVED_KEY = "memorySaved";
const MODE_NOTICE_ID = "mode-notice";
let latestRunId = 0;

regroupBtn.addEventListener("click", () => runAgent(true));
statsBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") });
});

runAgent(false);

async function runAgent(forceRegroup) {
  const runId = ++latestRunId;
  hideError();
  hideModeNotice();
  groupsEl.style.display = "none";
  groupsEl.innerHTML = "";

  try {
    const [frequentUrls, autonomyState] = await Promise.all([
      getFrequentUrls(3, 24),
      typeof getAutonomyState === "function"
        ? getAutonomyState()
        : Promise.resolve({ mode: "observing", observationMode: true }),
    ]);

    if (!forceRegroup) {
      const cached = await loadCachedState();
      if (cached) {
        showModeNotice(autonomyState, cached.groupMode || "cached");
        renderGroups(cached.groups, cached.tabMap, frequentUrls, cached.asleepGroups);
        if (cached.groupMode !== "ai_grouping") {
          void upgradeGroupingInBackground(runId, autonomyState, frequentUrls);
        }
        return;
      }
    }

    const tabs = await observeTabs();
    if (tabs.length === 0) {
      showError("No tabs found to group.");
      return;
    }

    const tabMap = {};
    for (const tab of tabs) {
      tabMap[tab.id] = tab;
    }

    const fallbackGroups = buildFallbackGroups(tabs);
    await saveCachedState(fallbackGroups, tabMap, {}, "fallback_grouping");
    await logEvent("grouped", {
      tabCount: tabs.length,
      groupCount: fallbackGroups.length,
      frequentTabCount: frequentUrls.size,
      groupNames: fallbackGroups.map((group) => group.name),
      forced: forceRegroup,
      mode: "fallback_grouping",
    });

    showModeNotice(autonomyState, "fallback_grouping");
    renderGroups(fallbackGroups, tabMap, frequentUrls, {});
    void upgradeGroupingInBackground(runId, autonomyState, frequentUrls, tabs, tabMap, forceRegroup);
  } catch (err) {
    console.error("Tab Agent error:", err);
    showError("Something went wrong: " + err.message);
  }
}

async function saveCachedState(groups, tabMap, asleepGroups, groupMode = "ai_grouping") {
  await chrome.storage.local.set({
    [STORAGE_GROUPS_KEY]: { groups, tabMap, groupMode },
    [STORAGE_ASLEEP_KEY]: asleepGroups,
  });
}

async function loadCachedState() {
  const data = await chrome.storage.local.get([STORAGE_GROUPS_KEY, STORAGE_ASLEEP_KEY]);
  if (!data[STORAGE_GROUPS_KEY]) return null;
  return {
    groups: data[STORAGE_GROUPS_KEY].groups,
    tabMap: data[STORAGE_GROUPS_KEY].tabMap,
    groupMode: data[STORAGE_GROUPS_KEY].groupMode || "cached",
    asleepGroups: data[STORAGE_ASLEEP_KEY] || {},
  };
}

async function updateAsleepState(asleepGroups) {
  await chrome.storage.local.set({ [STORAGE_ASLEEP_KEY]: asleepGroups });
}

async function observeTabs() {
  const rawTabs = await chrome.tabs.query({});
  return rawTabs
    .map((tab) => ({
      id: tab.id,
      title: tab.title || "Untitled",
      url: tab.url || "",
    }))
    .filter(
      (tab) =>
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://") &&
        !tab.url.startsWith("about:")
    );
}

async function upgradeGroupingInBackground(runId, autonomyState, frequentUrls, tabs = null, tabMap = null, forced = false) {
  const sourceTabs = tabs || (await observeTabs());
  if (!sourceTabs.length) return;

  const sourceTabMap = tabMap || Object.fromEntries(sourceTabs.map((tab) => [tab.id, tab]));

  showStatus("Refining groups with on-device AI...");
  const aiResult = await tryAiGrouping(sourceTabs);
  if (!aiResult || latestRunId !== runId) {
    hideStatus();
    return;
  }

  await saveCachedState(aiResult.groups, sourceTabMap, {}, aiResult.mode);
  await logEvent("regrouped_with_ai", {
    tabCount: sourceTabs.length,
    groupCount: aiResult.groups.length,
    frequentTabCount: frequentUrls.size,
    groupNames: aiResult.groups.map((group) => group.name),
    forced,
    mode: aiResult.mode,
  });

  groupsEl.innerHTML = "";
  showModeNotice(autonomyState, aiResult.mode);
  renderGroups(aiResult.groups, sourceTabMap, frequentUrls, {});
}

async function tryAiGrouping(tabs) {
  if (typeof LanguageModel === "undefined" || typeof LanguageModel.availability !== "function") {
    return null;
  }

  let availability = "unavailable";
  try {
    availability = await LanguageModel.availability();
  } catch {
    return null;
  }

  if (availability !== "available") {
    return null;
  }

  const session = await LanguageModel.create({
    systemPrompt:
      "You are a browser tab organizer. You group tabs by topic. You always respond with valid JSON only, with no markdown, no explanation, and no extra text.",
    expectedInputLanguages: ["en"],
    outputLanguage: "en",
  });

  try {
    const tabList = tabs.map((tab) => ({ id: tab.id, title: tab.title, url: tab.url }));
    const prompt = `Group these browser tabs by topic.
Return ONLY a JSON object in exactly this format, with no extra text:
{
  "groups": [
    { "name": "group name", "tabIds": [1, 2, 3] }
  ]
}

Rules:
- Create 2 to 6 groups maximum
- Every tab must appear in exactly one group
- Group names should be short (2-4 words)
- If a tab doesn't fit anywhere, put it in a group called "Other"

Tabs:
${JSON.stringify(tabList, null, 2)}`;

    const response = await session.prompt(prompt);
    return {
      groups: parseGroupsFromResponse(response, tabs),
      mode: "ai_grouping",
    };
  } finally {
    session.destroy();
  }
}

function buildFallbackGroups(tabs) {
  const grouped = new Map();

  for (const tab of tabs) {
    const groupName = inferFallbackGroupName(tab);
    if (!grouped.has(groupName)) grouped.set(groupName, []);
    grouped.get(groupName).push(tab.id);
  }

  return Array.from(grouped.entries()).map(([name, tabIds]) => ({
    name,
    tabIds,
  }));
}

function inferFallbackGroupName(tab) {
  const title = (tab.title || "").trim();
  const url = tab.url || "";
  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  if (/mail|inbox|outlook/i.test(title) || /mail|outlook/.test(hostname)) return "Comms";
  if (/calendar|meeting|zoom|meet/i.test(title) || /calendar|meet/.test(hostname)) return "Schedule";
  if (/github|vercel|localhost|stack overflow|terminal|tab agent/i.test(title) || /github|vercel|localhost|127\.0\.0\.1/.test(hostname)) return "Build";
  if (/notion|docs|drive|slides|sheets/i.test(title) || /notion|docs\.google|drive\.google/.test(hostname)) return "Workspace";
  if (/linkedin|job|career|internship|resume/i.test(title) || /linkedin|greenhouse|lever|workdayjobs|ashbyhq/.test(hostname)) return "Career";
  if (/news|article|read|blog|substack/i.test(title)) return "Reading";
  if (hostname) return hostname.split(".")[0].replace(/^\w/, (value) => value.toUpperCase());
  return "Other";
}

function parseGroupsFromResponse(response, tabs) {
  const cleaned = response.replace(/```json/gi, "").replace(/```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON. Try regrouping.");
  }

  if (!parsed.groups || !Array.isArray(parsed.groups)) {
    throw new Error("AI response had unexpected structure. Try regrouping.");
  }

  const validIds = new Set(tabs.map((tab) => tab.id));
  const groups = parsed.groups
    .map((group) => ({
      name: group.name || "Unnamed group",
      tabIds: (group.tabIds || []).filter((id) => validIds.has(id)),
    }))
    .filter((group) => group.tabIds.length > 0);

  const assignedIds = new Set(groups.flatMap((group) => group.tabIds));
  const unassignedIds = tabs.map((tab) => tab.id).filter((id) => !assignedIds.has(id));

  if (unassignedIds.length > 0) {
    groups.push({
      name: "Other",
      tabIds: unassignedIds,
    });
  }

  return groups.length
    ? groups
    : [
        {
          name: "Other",
          tabIds: tabs.map((tab) => tab.id),
        },
      ];
}

function renderGroups(groups, tabMap, frequentUrls, asleepGroupsInit) {
  const asleepGroups = { ...asleepGroupsInit };

  groups.forEach((group, groupIndex) => {
    const isAsleep = !!asleepGroups[groupIndex];
    const groupEl = createGroupElement(
      group,
      groupIndex,
      tabMap,
      frequentUrls,
      isAsleep,
      asleepGroups[groupIndex] || [],
      asleepGroups
    );
    groupsEl.appendChild(groupEl);
  });

  hideStatus();
  groupsEl.style.display = "block";
}

function createGroupElement(group, groupIndex, tabMap, frequentUrls, isAsleep, asleepTabIds, asleepGroups) {
  const groupEl = document.createElement("div");
  groupEl.className = "group" + (isAsleep ? " group-asleep" : "");
  groupEl.dataset.groupIndex = groupIndex;

  const header = document.createElement("div");
  header.className = "group-header";

  const nameWrap = document.createElement("div");
  nameWrap.className = "group-name-wrap";

  const nameEl = document.createElement("span");
  nameEl.className = "group-name";
  nameEl.textContent = group.name;

  const statusBadge = document.createElement("span");
  statusBadge.className = "group-status-badge";
  statusBadge.textContent = "asleep";
  statusBadge.style.display = isAsleep ? "inline-block" : "none";

  nameWrap.appendChild(nameEl);
  nameWrap.appendChild(statusBadge);

  const actions = document.createElement("div");
  actions.className = "group-actions";

  const sleepBtn = document.createElement("button");
  sleepBtn.className = "btn-sleep";
  sleepBtn.type = "button";
  sleepBtn.textContent = "Sleep";
  sleepBtn.title = "Suspend tabs in this group to free memory";
  sleepBtn.style.display = isAsleep ? "none" : "inline-block";

  const wakeBtn = document.createElement("button");
  wakeBtn.className = "btn-wake";
  wakeBtn.type = "button";
  wakeBtn.textContent = "Wake";
  wakeBtn.title = "Reload all tabs in this group";
  wakeBtn.style.display = isAsleep ? "inline-block" : "none";

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn-close";
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.title = "Close all tabs in this group";

  actions.appendChild(sleepBtn);
  actions.appendChild(wakeBtn);
  actions.appendChild(closeBtn);
  header.appendChild(nameWrap);
  header.appendChild(actions);

  const list = document.createElement("ul");
  list.className = "tab-list";

  for (const tabId of group.tabIds) {
    const tab = tabMap[tabId];
    if (!tab) continue;

    const isFrequent = frequentUrls.has(normalizeUrl(tab.url));
    const wasSlept = isAsleep && asleepTabIds.includes(tabId);

    const item = document.createElement("li");
    item.className = "tab-item" + (wasSlept ? " tab-asleep" : "");
    item.dataset.tabId = tabId;

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title;
    title.title = tab.url;
    item.appendChild(title);

    if (isFrequent) {
      const badge = document.createElement("span");
      badge.className = "badge-frequent";
      badge.textContent = "frequent";
      badge.title = "This tab is visited often and will stay more protected.";
      item.appendChild(badge);
    }

    list.appendChild(item);
  }

  groupEl.appendChild(header);
  groupEl.appendChild(list);

  sleepBtn.addEventListener("click", async () => {
    await sleepGroup(group, tabMap, frequentUrls, groupIndex, groupEl, sleepBtn, wakeBtn, statusBadge, list, asleepGroups);
  });

  wakeBtn.addEventListener("click", async () => {
    await wakeGroup(group, groupIndex, tabMap, groupEl, sleepBtn, wakeBtn, statusBadge, list, asleepGroups);
  });

  closeBtn.addEventListener("click", async () => {
    await closeGroup(group, tabMap, frequentUrls, groupEl);
  });

  return groupEl;
}

async function sleepGroup(group, tabMap, frequentUrls, groupIndex, groupEl, sleepBtn, wakeBtn, statusBadge, list, asleepGroups) {
  const frequentInGroup = group.tabIds.filter((id) => tabMap[id] && frequentUrls.has(normalizeUrl(tabMap[id].url)));
  const nonFrequent = group.tabIds.filter((id) => tabMap[id] && !frequentUrls.has(normalizeUrl(tabMap[id].url)));

  let toSleep = nonFrequent;

  if (frequentInGroup.length > 0) {
    if (nonFrequent.length === 0) {
      const word = frequentInGroup.length === 1 ? "tab" : "tabs";
      const confirmed = confirm(`All ${frequentInGroup.length} ${word} in this group are frequently visited. Sleep them anyway?`);
      if (!confirmed) return;
      toSleep = frequentInGroup;
    } else {
      const word = frequentInGroup.length === 1 ? "tab" : "tabs";
      const confirmed = confirm(`This group has ${frequentInGroup.length} frequently visited ${word}. Sleep them too?`);
      if (confirmed) {
        toSleep = group.tabIds.filter((id) => tabMap[id]);
      }
    }
  }

  if (toSleep.length === 0) return;

  for (const tabId of toSleep) {
    try {
      await chrome.tabs.discard(tabId);
    } catch (error) {
      console.warn("Could not discard tab", tabId, error);
    }
  }

  for (const tabId of toSleep) {
    const tab = tabMap[tabId];
    if (!tab?.url) continue;
    await appendTabEvent({
      eventType: "sleep",
      tabId,
      url: tab.url,
      title: tab.title || "Untitled",
      groupName: group.name,
      source: "user",
    });
  }

  asleepGroups[groupIndex] = toSleep;
  await updateAsleepState(asleepGroups);

  try {
    const savedMB = toSleep.length * 50;
    const data = await chrome.storage.local.get(STORAGE_SAVED_KEY);
    const prev = data[STORAGE_SAVED_KEY] || 0;
    await chrome.storage.local.set({ [STORAGE_SAVED_KEY]: prev + savedMB });
    await logEvent("slept", {
      tabCount: toSleep.length,
      frequentTabCount: group.tabIds.length - toSleep.length,
      groupName: group.name,
      estimatedMBSaved: savedMB,
    });
  } catch {
    // Best effort only.
  }

  groupEl.classList.add("group-asleep");
  sleepBtn.style.display = "none";
  wakeBtn.style.display = "inline-block";
  statusBadge.style.display = "inline-block";

  for (const tabId of toSleep) {
    const item = list.querySelector(`[data-tab-id="${tabId}"]`);
    if (item) item.classList.add("tab-asleep");
  }
}

async function wakeGroup(group, groupIndex, tabMap, groupEl, sleepBtn, wakeBtn, statusBadge, list, asleepGroups) {
  const tabIds = asleepGroups[groupIndex] || [];

  for (const tabId of tabIds) {
    try {
      await chrome.tabs.reload(tabId);
    } catch (error) {
      console.warn("Could not reload tab", tabId, error);
    }
  }

  for (const tabId of tabIds) {
    const tab = tabMap[tabId];
    if (!tab?.url) continue;
    await appendTabEvent({
      eventType: "wake",
      tabId,
      url: tab.url,
      title: tab.title || "Untitled",
      groupName: group.name,
      source: "user",
    });
    await markAutoSleepOutcome(tab.url, "manual_wake_after_sleep");
  }

  delete asleepGroups[groupIndex];
  await updateAsleepState(asleepGroups);
  await logEvent("woken", { tabCount: tabIds.length, groupName: group.name, groupIndex });

  groupEl.classList.remove("group-asleep");
  sleepBtn.style.display = "inline-block";
  wakeBtn.style.display = "none";
  statusBadge.style.display = "none";
  list.querySelectorAll(".tab-asleep").forEach((element) => element.classList.remove("tab-asleep"));
}

async function closeGroup(group, tabMap, frequentUrls, groupEl) {
  const realTabs = await chrome.tabs.query({});
  const urlToRealId = {};
  for (const tab of realTabs) {
    if (tab.url) urlToRealId[normalizeUrl(tab.url)] = tab.id;
  }

  const groupUrls = group.tabIds.map((id) => tabMap[id]?.url).filter(Boolean);
  const frequentGroupUrls = groupUrls.filter((url) => frequentUrls.has(normalizeUrl(url)));
  const nonFrequentUrls = groupUrls.filter((url) => !frequentUrls.has(normalizeUrl(url)));

  let urlsToClose = nonFrequentUrls;
  let closeAll = false;

  if (frequentGroupUrls.length > 0) {
    const word = frequentGroupUrls.length === 1 ? "tab" : "tabs";
    const confirmed = confirm(`This group has ${frequentGroupUrls.length} frequently visited ${word}. Close them too?`);
    if (confirmed) {
      urlsToClose = groupUrls;
      closeAll = true;
    }
  } else {
    closeAll = true;
  }

  if (urlsToClose.length === 0) return;

  const idsToClose = urlsToClose.map((url) => urlToRealId[normalizeUrl(url)]).filter(Boolean);
  if (idsToClose.length > 0) {
    try {
      await chrome.tabs.remove(idsToClose);
    } catch {
      for (const tabId of idsToClose) {
        try {
          await chrome.tabs.remove(tabId);
        } catch {
          // Ignore stale tab failures.
        }
      }
    }

    await logEvent("closed", {
      tabCount: idsToClose.length,
      groupName: group.name,
      includedFrequent: closeAll && frequentGroupUrls.length > 0,
    });
  }

  if (closeAll) {
    groupEl.remove();
    await removeGroupFromCache(group);
  } else {
    for (const url of urlsToClose) {
      const id = group.tabIds.find((tabId) => tabMap[tabId]?.url === url);
      if (id) {
        const item = groupEl.querySelector(`[data-tab-id="${id}"]`);
        if (item) item.remove();
      }
    }
    await removeTabsFromGroupCache(group, urlsToClose);
  }
}

async function removeGroupFromCache(group) {
  const data = await chrome.storage.local.get(STORAGE_GROUPS_KEY);
  if (!data[STORAGE_GROUPS_KEY]) return;
  const { groups, tabMap, groupMode } = data[STORAGE_GROUPS_KEY];
  const updated = groups.filter((entry) => entry.name !== group.name);
  await chrome.storage.local.set({ [STORAGE_GROUPS_KEY]: { groups: updated, tabMap, groupMode } });
}

async function removeTabsFromGroupCache(group, closedUrls) {
  const data = await chrome.storage.local.get(STORAGE_GROUPS_KEY);
  if (!data[STORAGE_GROUPS_KEY]) return;
  const { groups, tabMap, groupMode } = data[STORAGE_GROUPS_KEY];
  const closedUrlSet = new Set(closedUrls);
  const updated = groups.map((entry) => {
    if (entry.name !== group.name) return entry;
    return {
      ...entry,
      tabIds: entry.tabIds.filter((id) => !closedUrlSet.has(tabMap[id]?.url)),
    };
  });
  await chrome.storage.local.set({ [STORAGE_GROUPS_KEY]: { groups: updated, tabMap, groupMode } });
}

function showModeNotice(autonomyState, groupingMode) {
  const existing = document.getElementById(MODE_NOTICE_ID);
  if (existing) existing.remove();

  const notice = document.createElement("div");
  notice.id = MODE_NOTICE_ID;
  notice.style.cssText = [
    "margin-bottom:10px",
    "padding:9px 10px",
    "border:1px solid #e5e7eb",
    "border-radius:8px",
    "background:#fafafa",
    "font-size:11px",
    "line-height:1.45",
    "color:#4b5563",
  ].join(";");

  const modeLabel = autonomyState?.mode === "trusted_autonomy" ? "Trusted autonomy" : "Observation mode";
  const reasonText = autonomyState?.reasons?.[0] || "Protecting focus first while learning your safer contexts.";
  const fallbackText =
    groupingMode === "fallback_grouping"
      ? `<div style="margin-top:4px;color:#6b7280;">Using simple local grouping while on-device AI is unavailable.</div>`
      : "";

  notice.innerHTML = `
    <div style="font-weight:600;color:#111827;">${modeLabel}</div>
    <div style="margin-top:3px;">${reasonText}</div>
    ${fallbackText}
  `;

  const anchor = statusEl.style.display !== "none" ? statusEl : groupsEl;
  anchor.parentNode.insertBefore(notice, anchor);
}

function hideModeNotice() {
  const existing = document.getElementById(MODE_NOTICE_ID);
  if (existing) existing.remove();
}

function showStatus(message) {
  statusEl.innerHTML = `<span class="spinner"></span> ${message}`;
  statusEl.style.display = "block";
}

function hideStatus() {
  statusEl.style.display = "none";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = "block";
  hideStatus();
}

function hideError() {
  errorEl.style.display = "none";
}
