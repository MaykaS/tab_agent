// stats.js - memory measurement, autonomous agent activity, and study submission

const STORAGE_GROUPS_KEY = "cachedGroups";
const STORAGE_ASLEEP_KEY = "asleepGroups";
const STORAGE_SAVED_KEY = "memorySaved";
const STATS_ESTIMATED_MEMORY_PER_TAB_MB = 50;
const ACTION_FEED_LIMIT = 8;

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
            ${openInGroup} open tab${openInGroup !== 1 ? "s" : ""} · estimated
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

  const [actions, openAiSummary] = await Promise.all([
    getAgentActionLog(ACTION_FEED_LIMIT),
    getOpenAiPolicySummary(),
  ]);

  if (!actions.length && !openAiSummary) {
    wrap.innerHTML = `
      <p style="font-size:13px;color:#888;margin-bottom:10px;">No autonomous actions yet.</p>
      <p style="font-size:12px;color:#aaa;">Once the background agent starts auto-sleeping or waking tabs, this feed will explain what it did and let you undo or protect contexts.</p>
    `;
    return;
  }

  const summaryHtml = openAiSummary
    ? `
      <div style="margin-bottom:14px;padding:12px 14px;background:#f7fbff;border:1px solid #d9ecfb;border-radius:8px;">
        <div style="font-size:12px;font-weight:600;color:#1a6fa3;margin-bottom:6px;">OpenAI policy summary</div>
        <div style="font-size:12px;color:#555;line-height:1.6;">${escapeHtml(openAiSummary.summary || "No summary yet.")}</div>
        ${Array.isArray(openAiSummary.recommendations) && openAiSummary.recommendations.length
          ? `<div style="font-size:12px;color:#666;margin-top:8px;">Recommendations: ${escapeHtml(openAiSummary.recommendations.join(" · "))}</div>`
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
              <span style="font-size:11px;color:#888;">confidence ${(Number(action.confidence || 0) * 100).toFixed(0)}%</span>
              <span style="font-size:11px;color:#888;">${new Date(action.createdAt).toLocaleString()}</span>
            </div>
            <div style="font-size:13px;font-weight:600;color:#333;margin-top:6px;">
              ${escapeHtml(action.target?.groupName || action.target?.titles?.[0] || "Untitled target")}
            </div>
            <div style="font-size:12px;color:#555;line-height:1.6;margin-top:4px;">
              ${escapeHtml(action.reason || "No explanation recorded.")}
            </div>
            <div style="font-size:12px;color:#888;margin-top:6px;">
              Outcome: ${escapeHtml(action.outcome?.status || "pending")}
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

  wrap.innerHTML = `
    ${summaryHtml}
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px;">
      <div style="font-size:12px;color:#666;">Recent autonomous actions and feedback</div>
      <button class="btn btn-primary" id="generate-openai-summary">Generate AI summary</button>
    </div>
    <div style="display:grid;gap:10px;">${actionCards}</div>
    <div id="agent-feedback-status" style="font-size:12px;color:#666;margin-top:10px;"></div>
  `;

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

  const summaryButton = document.getElementById("generate-openai-summary");
  if (summaryButton) {
    summaryButton.addEventListener("click", async () => {
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
          Only usage statistics are sent - no tab URLs or personal information. Memory values are estimated.
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
      Participant ID: <strong>${escapeHtml(exportData.participantId || participantId)}</strong> &nbsp;·&nbsp;
      Tabs: <strong>${exportData.tabCount ?? 0}</strong> &nbsp;·&nbsp;
      Groups: <strong>${exportData.groupCount ?? 0}</strong> &nbsp;·&nbsp;
      Open tabs: <strong>${exportData.openTabCount ?? 0}</strong> &nbsp;·&nbsp;
      Asleep tabs: <strong>${exportData.asleepTabCount ?? 0}</strong><br>
      Sessions logged: <strong>${(exportData.sessionLog || []).length}</strong> &nbsp;·&nbsp;
      Rating sessions: <strong>${exportData.ratingCount ?? 0}</strong> &nbsp;·&nbsp;
      Avg rating: <strong>${Number(exportData.avgRating ?? 0).toFixed(1)}/5</strong> &nbsp;·&nbsp;
      Memory saved: <strong>${Number(exportData.memorySavedEstimateMb ?? exportData.memorySaved ?? 0).toFixed(0)} MB est.</strong> &nbsp;·&nbsp;
      Total tab memory: <strong>${Number(exportData.totalTabMemoryEstimateMb ?? 0).toFixed(0)} MB est.</strong> &nbsp;·&nbsp;
      Tab visits tracked: <strong>${exportData.visitCount ?? 0}</strong><br>
      Auto-sleeps: <strong>${autoSummary.autoSleepCount ?? 0}</strong> &nbsp;·&nbsp;
      Auto-wakes: <strong>${autoSummary.autoWakeCount ?? 0}</strong> &nbsp;·&nbsp;
      Undo count: <strong>${autoSummary.undoCount ?? 0}</strong> &nbsp;·&nbsp;
      Regret count: <strong>${autoSummary.regretCount ?? 0}</strong> &nbsp;·&nbsp;
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
            ${n <= 2 ? "✕" : n === 3 ? "~" : "✓"}
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
  };
}
