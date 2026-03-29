// popup.js — the agent brain
// Runs the full observe → decide → act loop every time the popup opens.

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const groupsEl = document.getElementById("groups");
const regroupBtn = document.getElementById("regroup-btn");

// ─── Entry point ────────────────────────────────────────────────────────────

regroupBtn.addEventListener("click", () => runAgent());
runAgent();

// ─── Main agent loop ─────────────────────────────────────────────────────────

async function runAgent() {
  showStatus("Grouping your tabs...");
  hideError();
  groupsEl.style.display = "none";
  groupsEl.innerHTML = "";

  try {
    // 1. OBSERVE — read open tabs and visit history
    const tabs = await observeTabs();
    if (tabs.length === 0) {
      showError("No tabs found to group.");
      return;
    }

    const frequentUrls = await getFrequentUrls(3, 24);

    // 2. DECIDE — ask Gemini Nano to group the tabs
    const groups = await decidGroups(tabs);
    if (!groups || groups.length === 0) {
      showError("Couldn't generate groups. Try reopening the popup.");
      return;
    }

    // 3. RENDER — show groups in the popup
    renderGroups(groups, tabs, frequentUrls);

  } catch (err) {
    console.error("Tab Agent error:", err);
    showError("Something went wrong: " + err.message);
  }
}

// ─── 1. Observe ──────────────────────────────────────────────────────────────

async function observeTabs() {
  const rawTabs = await chrome.tabs.query({});
  return rawTabs.map(tab => ({
    id: tab.id,
    title: tab.title || "Untitled",
    url: tab.url || "",
  })).filter(tab =>
    // Filter out Chrome internal pages — nothing useful to group there
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://") &&
    !tab.url.startsWith("about:")
  );
}

// ─── 2. Decide ───────────────────────────────────────────────────────────────

async function decidGroups(tabs) {
  // Check Gemini Nano is available
  const availability = await LanguageModel.availability();
  if (availability !== "available") {
    throw new Error(
      `Gemini Nano is not available (status: ${availability}). ` +
      `Make sure you've enabled the flags and the model has finished downloading. ` +
      `Open DevTools and run: await LanguageModel.create()`
    );
  }

  const session = await LanguageModel.create({
    systemPrompt: "You are a browser tab organizer. You group tabs by topic. You always respond with valid JSON only — no markdown, no explanation, no extra text."
  });

  const tabList = tabs.map(t => ({
    id: t.id,
    title: t.title,
    url: t.url
  }));

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
  // Strip markdown code fences if Gemini wraps its response
  const cleaned = response
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("AI returned invalid JSON. Try regrouping.");
  }

  if (!parsed.groups || !Array.isArray(parsed.groups)) {
    throw new Error("AI response had unexpected structure. Try regrouping.");
  }

  // Validate: make sure every tabId in the response actually exists
  const validIds = new Set(tabs.map(t => t.id));
  return parsed.groups.map(group => ({
    name: group.name || "Unnamed group",
    tabIds: (group.tabIds || []).filter(id => validIds.has(id))
  })).filter(group => group.tabIds.length > 0);
}

// ─── 3. Render ───────────────────────────────────────────────────────────────

function renderGroups(groups, tabs, frequentUrls) {
  const tabMap = {};
  for (const tab of tabs) tabMap[tab.id] = tab;

  for (const group of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "group";

    // Header: group name + action buttons
    const header = document.createElement("div");
    header.className = "group-header";

    const nameEl = document.createElement("span");
    nameEl.className = "group-name";
    nameEl.textContent = group.name;

    const actions = document.createElement("div");
    actions.className = "group-actions";

    const sleepBtn = document.createElement("button");
    sleepBtn.className = "btn-sleep";
    sleepBtn.textContent = "Sleep";
    sleepBtn.title = "Suspend tabs in this group to free memory";
    sleepBtn.addEventListener("click", () => sleepGroup(group, tabMap, frequentUrls, groupEl));

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn-close";
    closeBtn.textContent = "Close";
    closeBtn.title = "Close all tabs in this group";
    closeBtn.addEventListener("click", () => closeGroup(group, tabMap, frequentUrls, groupEl));

    actions.appendChild(sleepBtn);
    actions.appendChild(closeBtn);
    header.appendChild(nameEl);
    header.appendChild(actions);

    // Tab list
    const list = document.createElement("ul");
    list.className = "tab-list";

    for (const tabId of group.tabIds) {
      const tab = tabMap[tabId];
      if (!tab) continue;

      const isFrequent = frequentUrls.has(tab.url);

      const item = document.createElement("li");
      item.className = "tab-item";

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
    groupsEl.appendChild(groupEl);
  }

  hideStatus();
  groupsEl.style.display = "block";
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function sleepGroup(group, tabMap, frequentUrls, groupEl) {
  const toSleep = group.tabIds.filter(id => {
    const tab = tabMap[id];
    return tab && !frequentUrls.has(tab.url);
  });

  if (toSleep.length === 0) {
    alert("All tabs in this group are frequently visited — none were slept.");
    return;
  }

  for (const tabId of toSleep) {
    try {
      await chrome.tabs.discard(tabId);
    } catch (e) {
      console.warn("Could not discard tab", tabId, e);
    }
  }

  groupEl.remove();
}

async function closeGroup(group, tabMap, frequentUrls, groupEl) {
  const toClose = group.tabIds.filter(id => {
    const tab = tabMap[id];
    return tab && !frequentUrls.has(tab.url);
  });

  if (toClose.length === 0) {
    alert("All tabs in this group are frequently visited — none were closed.");
    return;
  }

  try {
    await chrome.tabs.remove(toClose);
  } catch (e) {
    console.warn("Could not close tabs", e);
  }

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
