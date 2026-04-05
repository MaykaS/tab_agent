// stats.js - memory measurement and grouping quality rating

const STORAGE_GROUPS_KEY = "cachedGroups";
const STORAGE_ASLEEP_KEY = "asleepGroups";
const STORAGE_SAVED_KEY  = "memorySaved";

// Init

document.addEventListener("DOMContentLoaded", async () => {
  await renderAll();

  // Refresh every 5 seconds; if groups are not cached yet, keep retrying renderAll.
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
    STORAGE_SAVED_KEY
  ]);

  const cached = data[STORAGE_GROUPS_KEY] || null;
  const asleep = data[STORAGE_ASLEEP_KEY] || {};
  const savedMB = data[STORAGE_SAVED_KEY] || 0;

  document.getElementById("memory-saved").textContent = savedMB.toFixed(1);

  if (!cached || !cached.groups) {
    document.getElementById("tab-count").textContent = "-";
    document.getElementById("group-count").textContent = "-";
    document.getElementById("total-memory").textContent = "-";
    document.getElementById("no-data").textContent =
      "No groups cached yet - click the Tab Agent icon in your toolbar to group your tabs first, then come back here.";
    document.getElementById("no-data").style.display = "block";
    return;
  }

  const { groups, tabMap } = cached;

  // Count real open tabs by matching URLs (cached IDs may be stale)
  const openTabs = await chrome.tabs.query({});
  const realTabIds = new Set(openTabs.map(t => t.id));
  const realUrls = new Set(openTabs.map(t => t.url).filter(Boolean));
  const groupUrls = groups.flatMap(g => g.tabIds.map(id => tabMap[id]?.url).filter(Boolean));
  const openCount = groupUrls.filter(url => realUrls.has(url)).length;

  document.getElementById("tab-count").textContent = openCount;
  document.getElementById("group-count").textContent = groups.length;

  await renderGroupTable(groups, tabMap, asleep, realTabIds, realUrls);
  await renderSubmitSection();
  renderRatingForm(groups, tabMap);
}

// Memory

async function refreshMemory() {
  const data = await chrome.storage.local.get([
    STORAGE_GROUPS_KEY,
    STORAGE_ASLEEP_KEY,
    STORAGE_SAVED_KEY
  ]);

  const cached = data[STORAGE_GROUPS_KEY] || null;
  const asleep = data[STORAGE_ASLEEP_KEY] || {};
  const savedMB = data[STORAGE_SAVED_KEY] || 0;

  if (!cached) return;

  const openTabs = await chrome.tabs.query({});
  const realTabIds = new Set(openTabs.map(t => t.id));
  const realUrls = new Set(openTabs.map(t => t.url).filter(Boolean));
  const groupUrls = cached.groups.flatMap(g => g.tabIds.map(id => cached.tabMap[id]?.url).filter(Boolean));

  const openCount = groupUrls.filter(url => realUrls.has(url)).length;
  document.getElementById("tab-count").textContent = openCount;
  document.getElementById("group-count").textContent = cached.groups.length;
  document.getElementById("memory-saved").textContent = savedMB.toFixed(1);

  await renderGroupTable(cached.groups, cached.tabMap, asleep, realTabIds, realUrls);
}

async function renderGroupTable(groups, tabMap, asleep, realTabIds, realUrls) {
  const wrap = document.getElementById("group-table-wrap");

  // chrome.processes requires Chrome Dev channel. On stable, use tab count as a proxy.
  const hasRealData = false;
  const memoryByTabId = {};

  const groupMemories = groups.map(group => {
    return group.tabIds.reduce((sum, id) => sum + (memoryByTabId[id] || 0), 0);
  });
  const maxMem = Math.max(...groupMemories, 1);

  const totalMem = groupMemories.reduce((a, b) => a + b, 0);
  document.getElementById("total-memory").textContent =
    hasRealData ? totalMem.toFixed(1) : "-";

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
          const estMB = isAsleep ? 0 : openInGroup * 50;
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

// Research data submission

async function renderSubmitSection() {
  const wrap = document.getElementById("submit-wrap");
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="margin-top:8px;">
      <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:14px;line-height:1.6;">
        Submitting your data helps validate the research claims for this project.
        Only usage statistics are sent - no tab URLs or personal information.
      </p>
      <div id="submit-preview" style="background:var(--color-background-secondary);border:1px solid var(--color-border-tertiary);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--color-text-secondary);margin-bottom:14px;line-height:1.8;">
        Loading data preview...
      </div>
      <button id="submit-btn" style="padding:8px 20px;background:#1a6fa3;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;">
        Submit to study
      </button>
      <span id="submit-status" style="font-size:12px;margin-left:12px;color:var(--color-text-secondary);"></span>
    </div>
  `;

  const exportData = await getAllDataForExport();
  document.getElementById("submit-preview").innerHTML = `
    Sessions logged: <strong>${exportData.sessionLog.length}</strong> &nbsp;·&nbsp;
    Rating sessions: <strong>${exportData.ratingHistory.length}</strong> &nbsp;·&nbsp;
    Memory saved: <strong>${exportData.memorySaved.toFixed(0)} MB est.</strong> &nbsp;·&nbsp;
    Tab visits tracked: <strong>${exportData.visitCount}</strong>
  `;

  document.getElementById("submit-btn").addEventListener("click", async () => {
    const btn = document.getElementById("submit-btn");
    const status = document.getElementById("submit-status");
    btn.disabled = true;
    btn.textContent = "Submitting...";
    btn.style.background = "";
    status.textContent = "";
    status.style.color = "";

    try {
      const data = await getAllDataForExport();
      const res = await fetch("https://tabagentweb-on16.vercel.app/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
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
}

// Agreement rating form

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
    form.querySelectorAll(".star").forEach(s => s.classList.remove("selected"));
    Object.keys(ratings).forEach(k => delete ratings[k]);
    document.getElementById("score-result").style.display = "none";
    groups.forEach((_, i) => {
      const lbl = document.getElementById(`rating-label-${i}`);
      if (lbl) lbl.textContent = "Rate how well this group matches your mental model";
    });
  });
}

function updateScore(ratings, total) {
  const keys = Object.keys(ratings);
  if (keys.length < total) return;

  const avg = keys.reduce((sum, k) => sum + ratings[k], 0) / keys.length;
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
    avgScore: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
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

// Helpers

function ratingLabel(n) {
  return ["", "Completely wrong", "Mostly wrong", "Partially right", "Mostly right", "Perfect"][n];
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
