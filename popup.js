// popup.js — the agent brain

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const groupsEl = document.getElementById("groups");
const regroupBtn = document.getElementById("regroup-btn");

const STORAGE_GROUPS_KEY = "cachedGroups";
const STORAGE_ASLEEP_KEY = "asleepGroups";

// ─── Entry point ─────────────────────────────────────────────────────────────

regroupBtn.addEventListener("click", () => runAgent(true));
runAgent(false);

// ─── Main agent loop ─────────────────────────────────────────────────────────

// forceRegroup = true  → always call Gemini Nano (Regroup button)
// forceRegroup = false → load from cache if available, only call AI if no cache

async function runAgent(forceRegroup) {
  hideError();
  groupsEl.style.display = "none";
  groupsEl.innerHTML = "";

  try {
    const frequentUrls = await getFrequentUrls(3, 24);

    if (!forceRegroup) {
      // Try loading cached groups first
      const cached = await loadCachedState();
      if (cached) {
        renderGroups(cached.groups, cached.tabMap, frequentUrls, cached.asleepGroups);
        return;
      }
    }

    // No cache or force regroup — call Gemini Nano
    showStatus("Grouping your tabs...");

    const tabs = await observeTabs();
    if (tabs.length === 0) {
      showError("No tabs found to group.");
      return;
    }

    const groups = await decideGroups(tabs);
    if (!groups || groups.length === 0) {
      showError("Couldn't generate groups. Try reopening the popup.");
      return;
    }

    // Build tabMap and save to storage
    const tabMap = {};
    for (const tab of tabs) tabMap[tab.id] = tab;

    await saveCachedState(groups, tabMap, {});
    renderGroups(groups, tabMap, frequentUrls, {});

  } catch (err) {
    console.error("Tab Agent error:", err);
    showError("Something went wrong: " + err.message);
  }
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function saveCachedState(groups, tabMap, asleepGroups) {
  await chrome.storage.local.set({
    [STORAGE_GROUPS_KEY]: { groups, tabMap },
    [STORAGE_ASLEEP_KEY]: asleepGroups
  });
}

async function loadCachedState() {
  const data = await chrome.storage.local.get([STORAGE_GROUPS_KEY, STORAGE_ASLEEP_KEY]);
  if (!data[STORAGE_GROUPS_KEY]) return null;
  return {
    groups: data[STORAGE_GROUPS_KEY].groups,
    tabMap: data[STORAGE_GROUPS_KEY].tabMap,
    asleepGroups: data[STORAGE_ASLEEP_KEY] || {}
  };
}

async function updateAsleepState(asleepGroups) {
  await chrome.storage.local.set({ [STORAGE_ASLEEP_KEY]: asleepGroups });
}

// ─── 1. Observe ──────────────────────────────────────────────────────────────

async function observeTabs() {
  const rawTabs = await chrome.tabs.query({});
  return rawTabs.map(tab => ({
    id: tab.id,
    title: tab.title || "Untitled",
    url: tab.url || "",
  })).filter(tab =>
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://") &&
    !tab.url.startsWith("about:")
  );
}

// ─── 2. Decide ───────────────────────────────────────────────────────────────

async function decideGroups(tabs) {
  const availability = await LanguageModel.availability();
  if (availability !== "available") {
    throw new Error(
      `Gemini Nano is not available (status: ${availability}). ` +
      `Open DevTools and run: await LanguageModel.create()`
    );
  }

  const session = await LanguageModel.create({
    systemPrompt: "You are a browser tab organizer. You group tabs by topic. You always respond with valid JSON only — no markdown, no explanation, no extra text."
  });

  const tabList = tabs.map(t => ({ id: t.id, title: t.title, url: t.url }));

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
  session.destroy();

  return parseGroupsFromResponse(response, tabs);
}

function parseGroupsFromResponse(response, tabs) {
  const cleaned = response.replace(/```json/gi, "").replace(/```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("AI returned invalid JSON. Try regrouping.");
  }

  if (!parsed.groups || !Array.isArray(parsed.groups)) {
    throw new Error("AI response had unexpected structure. Try regrouping.");
  }

  const validIds = new Set(tabs.map(t => t.id));
  return parsed.groups.map(group => ({
    name: group.name || "Unnamed group",
    tabIds: (group.tabIds || []).filter(id => validIds.has(id))
  })).filter(group => group.tabIds.length > 0);
}

// ─── 3. Render ───────────────────────────────────────────────────────────────

function renderGroups(groups, tabMap, frequentUrls, asleepGroupsInit) {
  // asleepGroupsInit is the persisted asleep state from storage
  // We keep a live copy in memory for this session
  const asleepGroups = { ...asleepGroupsInit };

  groups.forEach((group, groupIndex) => {
    const isAsleep = !!asleepGroups[groupIndex];
    const groupEl = createGroupElement(
      group, groupIndex, tabMap, frequentUrls,
      isAsleep, asleepGroups[groupIndex] || [],
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

  // ── Header ──
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
  sleepBtn.textContent = "Sleep";
  sleepBtn.title = "Suspend tabs in this group to free memory";
  sleepBtn.style.display = isAsleep ? "none" : "inline-block";

  const wakeBtn = document.createElement("button");
  wakeBtn.className = "btn-wake";
  wakeBtn.textContent = "Wake";
  wakeBtn.title = "Reload all tabs in this group";
  wakeBtn.style.display = isAsleep ? "inline-block" : "none";

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn-close";
  closeBtn.textContent = "Close";
  closeBtn.title = "Close all tabs in this group";

  actions.appendChild(sleepBtn);
  actions.appendChild(wakeBtn);
  actions.appendChild(closeBtn);
  header.appendChild(nameWrap);
  header.appendChild(actions);

  // ── Tab list ──
  const list = document.createElement("ul");
  list.className = "tab-list";

  for (const tabId of group.tabIds) {
    const tab = tabMap[tabId];
    if (!tab) continue;

    const isFrequent = frequentUrls.has(tab.url);
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
      badge.title = "This tab is visited often and won't be slept automatically";
      item.appendChild(badge);
    }

    list.appendChild(item);
  }

  groupEl.appendChild(header);
  groupEl.appendChild(list);

  // ── Button handlers ──
  sleepBtn.addEventListener("click", async () => {
    await sleepGroup(group, tabMap, frequentUrls, groupIndex, groupEl, sleepBtn, wakeBtn, statusBadge, list, asleepGroups);
  });

  wakeBtn.addEventListener("click", async () => {
    await wakeGroup(groupIndex, groupEl, sleepBtn, wakeBtn, statusBadge, list, asleepGroups);
  });

  closeBtn.addEventListener("click", async () => {
    await closeGroup(group, tabMap, frequentUrls, groupEl);
  });

  return groupEl;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function sleepGroup(group, tabMap, frequentUrls, groupIndex, groupEl, sleepBtn, wakeBtn, statusBadge, list, asleepGroups) {
  const frequentInGroup = group.tabIds.filter(id => tabMap[id] && frequentUrls.has(tabMap[id].url));
  const nonFrequent = group.tabIds.filter(id => tabMap[id] && !frequentUrls.has(tabMap[id].url));

  const toSleep = nonFrequent; // Sleep never touches frequent tabs

  if (toSleep.length === 0) {
    alert("All tabs in this group are frequently visited — none were slept.");
    return;
  }

  for (const tabId of toSleep) {
    try { await chrome.tabs.discard(tabId); }
    catch (e) { console.warn("Could not discard tab", tabId, e); }
  }

  // Persist asleep state
  asleepGroups[groupIndex] = toSleep;
  await updateAsleepState(asleepGroups);

  // Update UI
  groupEl.classList.add("group-asleep");
  sleepBtn.style.display = "none";
  wakeBtn.style.display = "inline-block";
  statusBadge.style.display = "inline-block";

  for (const tabId of toSleep) {
    const item = list.querySelector(`[data-tab-id="${tabId}"]`);
    if (item) item.classList.add("tab-asleep");
  }
}

async function wakeGroup(groupIndex, groupEl, sleepBtn, wakeBtn, statusBadge, list, asleepGroups) {
  const tabIds = asleepGroups[groupIndex] || [];

  for (const tabId of tabIds) {
    try { await chrome.tabs.reload(tabId); }
    catch (e) { console.warn("Could not reload tab", tabId, e); }
  }

  // Clear persisted asleep state
  delete asleepGroups[groupIndex];
  await updateAsleepState(asleepGroups);

  // Restore UI
  groupEl.classList.remove("group-asleep");
  sleepBtn.style.display = "inline-block";
  wakeBtn.style.display = "none";
  statusBadge.style.display = "none";
  list.querySelectorAll(".tab-asleep").forEach(el => el.classList.remove("tab-asleep"));
}

async function closeGroup(group, tabMap, frequentUrls, groupEl) {
  const frequentInGroup = group.tabIds.filter(id => tabMap[id] && frequentUrls.has(tabMap[id].url));
  const nonFrequent = group.tabIds.filter(id => tabMap[id] && !frequentUrls.has(tabMap[id].url));

  let toClose = nonFrequent;

  // If there are frequent tabs, ask the user what to do
  if (frequentInGroup.length > 0) {
    const word = frequentInGroup.length === 1 ? "tab" : "tabs";
    const confirmed = confirm(
      `This group has ${frequentInGroup.length} frequently visited ${word}. Close them too?`
    );
    if (confirmed) {
      toClose = group.tabIds.filter(id => tabMap[id]); // close everything
    }
    // if not confirmed, toClose stays as nonFrequent only
  }

  if (toClose.length === 0) return;

  try { await chrome.tabs.remove(toClose); }
  catch (e) { console.warn("Could not close tabs", e); }

  groupEl.remove();
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function showStatus(msg) {
  statusEl.innerHTML = `<span class="spinner"></span> ${msg}`;
  statusEl.style.display = "block";
}

function hideStatus() {
  statusEl.style.display = "none";
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
  hideStatus();
}

function hideError() {
  errorEl.style.display = "none";
}
