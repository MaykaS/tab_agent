// stats.js - memory measurement and grouping quality rating

const STORAGE_GROUPS_KEY = "cachedGroups";
const STORAGE_ASLEEP_KEY = "asleepGroups";
const STORAGE_SAVED_KEY = "memorySaved";
const STATS_ESTIMATED_MEMORY_PER_TAB_MB = 50;

document.addEventListener("DOMContentLoaded", async () => {
  await renderAll();

  setInterval(async () => {
    const data = await chrome.storage.local.get(STORAGE_GROUPS_KEY);
    if (!data[STORAGE_GROUPS_KEY]) {
      await renderAll();
    } else {
      await refreshMemory();
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
  const realTabIds = new Set(openTabs.map(tab => tab.id));
  const realUrls = new Set(openTabs.map(tab => tab.url).filter(Boolean));
  const groupUrls = groups.flatMap(group => group.tabIds.map(id => tabMap[id]?.url).filter(Boolean));
  const openCount = groupUrls.filter(url => realUrls.has(url)).length;

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
  const realTabIds = new Set(openTabs.map(tab => tab.id));
  const realUrls = new Set(openTabs.map(tab => tab.url).filter(Boolean));
  const groupUrls = cached.groups.flatMap(group => group.tabIds.map(id => cached.tabMap[id]?.url).filter(Boolean));

  const openCount = groupUrls.filter(url => realUrls.has(url)).length;
  document.getElementById("tab-count").textContent = openCount;
  document.getElementById("group-count").textContent = cached.groups.length;
  document.getElementById("memory-saved").textContent = savedMB.toFixed(1);

  await renderGroupTable(cached.groups, cached.tabMap, asleep, realTabIds, realUrls);
}

async function renderGroupTable(groups, tabMap, asleep, realTabIds, realUrls) {
  const wrap = document.getElementById("group-table-wrap");

  const hasRealData = false;
  const memoryByTabId = {};

  const groupMemories = groups.map(group => {
    return group.tabIds.reduce((sum, id) => sum + (memoryByTabId[id] || 0), 0);
  });
  const maxMem = Math.max(...groupMemories, 1);

  const totalMem = groupMemories.reduce((a, b) => a + b, 0);
  const estimatedTotalMem = groups.reduce((sum, group) => {
    const openInGroup = group.tabIds.filter(id => {
      const url = tabMap[id]?.url;
      return url && realUrls.has(url);
    }).length;
    return sum + (openInGroup * STATS_ESTIMATED_MEMORY_PER_TAB_MB);
  }, 0);

  document.getElementById("total-memory").textContent =
    hasRealData ? totalMem.toFixed(1) : estimatedTotalMem.toFixed(1);

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
    const mem = groupMemories[i];
    const pct = maxMem > 0 ? (mem / maxMem) * 100 : 0;
    const statusPill = isAsleep
      ? `<span class="status-pill pill-asleep">asleep</span>`
      : `<span class="status-pill pill-awake">awake</span>`;

    const memDisplay = hasRealData
      ? `<div class="mem-bar-wrap">
           <div class="mem-bar-bg">
             <div class="mem-bar-fill ${isAsleep ? "asleep" : ""}" style="width:${pct}%"></div>
           </div>
           <span class="mem-label">${mem.toFixed(1)} MB</span>
         </div>`
      : (() => {
          const openInGroup = group.tabIds.filter(id => {
            const url = tabMap[id]?.url;
            return url && realTabIds ? realUrls && realUrls.has(url) : true;
          }).length;
          const estMB = isAsleep ? 0 : openInGroup * STATS_ESTIMATED_MEMORY_PER_TAB_MB;
          return `<span style="font-size:12px;color:#888">${openInGroup} tab${openInGroup !== 1 ? "s" : ""} · ~${estMB} MB est.</span>`;
        })();

    html += `
      <tr>
        <td class="group-name-cell">${escapeHtml(group.name)}</td>
        <td>${group.tabIds.length}</td>
        <td>${statusPill}</td>
        <td>${memDisplay}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;

  if (!hasRealData) {
    html += `<p style="font-size:11px;color:#aaa;margin-top:10px;">
      Memory shown is estimated at ~50MB per tab - actual usage varies by page.
      Real per-tab data requires Chrome Dev channel.
    </p>`;
  }

  wrap.innerHTML = html;
  if (document.getElementById("no-data")) {
    document.getElementById("no-data").style.display = "none";
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
      Tab visits tracked: <strong>${exportData.visitCount ?? 0}</strong>
    `;

    document.getElementById("submit-btn").addEventListener("click", async () => {
      const btn = document.getElementById("submit-btn");
      const status = document.getElementById("submit-status");
      const studyResponses = {
        groupingUseful: getSelectedStudyValue("grouping-useful"),
        trustSleepClose: getSelectedStudyValue("trust-sleep-close"),
        wouldUseInRealBrowsing: getSelectedStudyValue("would-use-real"),
      };

      if (Object.values(studyResponses).some(value => value === null)) {
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
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Submit to study";
        status.textContent = `Submission failed: ${e.message}`;
        status.style.color = "#c0392b";
        console.error("Tab Agent submit failed:", e);
      }
    });
  } catch (e) {
    wrap.innerHTML = `
      <div style="font-size:12px;color:#c0392b;line-height:1.6;">
        Could not load the study submission form.<br>
        ${escapeHtml(e.message || "Unknown error")}
      </div>
    `;
    console.error("Tab Agent stats submit UI failed:", e);
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
      .map(id => tabMap[id]?.title || "Unknown tab")
      .slice(0, 5)
      .join(", ");
    const more = group.tabIds.length > 5 ? ` +${group.tabIds.length - 5} more` : "";

    const block = document.createElement("div");
    block.className = "group-rating";

    block.innerHTML = `
      <div class="group-rating-name">${escapeHtml(group.name)}</div>
      <div class="rating-tabs">${escapeHtml(tabTitles)}${more}</div>
      <div class="stars" id="stars-${i}">
        ${[1, 2, 3, 4, 5].map(n => `
          <div class="star" data-group="${i}" data-val="${n}" title="${ratingLabel(n)}">
            ${n <= 2 ? "✗" : n === 3 ? "~" : "✓"}
          </div>
        `).join("")}
      </div>
      <div class="rating-label" id="rating-label-${i}">Rate how well this group matches your mental model</div>
    `;

    form.appendChild(block);

    block.querySelectorAll(".star").forEach(star => {
      star.addEventListener("click", () => {
        const g = parseInt(star.dataset.group, 10);
        const v = parseInt(star.dataset.val, 10);
        ratings[g] = v;

        block.querySelectorAll(".star").forEach(s => {
          s.classList.toggle("selected", parseInt(s.dataset.val, 10) <= v);
        });

        document.getElementById(`rating-label-${g}`).textContent =
          `${v}/5 - ${ratingLabel(v)}`;

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
    form.querySelectorAll(".star").forEach(star => star.classList.remove("selected"));
    Object.keys(ratings).forEach(key => delete ratings[key]);
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
    ${pct >= 80 ? "Strong agreement - groupings match your mental model well" :
      pct >= 60 ? "Moderate agreement - some groups made sense, some did not" :
      "Low agreement - groupings need improvement"}
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
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderStudyQuestion(name, label, selectedValue) {
  return `
    <div style="font-size:12px;">
      <div style="margin-bottom:6px;font-weight:600;color:#333;">${escapeHtml(label)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${[1, 2, 3, 4, 5].map(value => `
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
  };
}
