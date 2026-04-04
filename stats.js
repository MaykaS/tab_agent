// stats.js — memory measurement and grouping quality rating

const STORAGE_GROUPS_KEY = "cachedGroups";
const STORAGE_ASLEEP_KEY = "asleepGroups";
const STORAGE_SAVED_KEY  = "memorySaved";

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  await renderAll();
  // Refresh every 5 seconds — also retries renderAll if no cache was found yet
  setInterval(async () => {
    const data = await chrome.storage.local.get(STORAGE_GROUPS_KEY);
    if (!data[STORAGE_GROUPS_KEY]) {
      await renderAll(); // keep retrying until popup has run
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

  const cached     = data[STORAGE_GROUPS_KEY] || null;
  const asleep     = data[STORAGE_ASLEEP_KEY] || {};
  const savedMB    = data[STORAGE_SAVED_KEY]  || 0;

  document.getElementById("memory-saved").textContent = savedMB.toFixed(1);

  if (!cached || !cached.groups) {
    document.getElementById("tab-count").textContent   = "—";
    document.getElementById("group-count").textContent = "—";
    document.getElementById("total-memory").textContent = "—";
    document.getElementById("no-data").textContent =
      "No groups cached yet — click the Tab Agent icon in your toolbar to group your tabs first, then come back here.";
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

  document.getElementById("tab-count").textContent   = openCount;
  document.getElementById("group-count").textContent = groups.length;

  // Memory per group (reuse realTabIds already declared above)
  await renderGroupTable(groups, tabMap, asleep, realTabIds, realUrls);

  // Agreement rating form
  renderRatingForm(groups, tabMap);
}

// ─── Memory ──────────────────────────────────────────────────────────────────

async function refreshMemory() {
  const data = await chrome.storage.local.get([STORAGE_GROUPS_KEY, STORAGE_ASLEEP_KEY, STORAGE_SAVED_KEY]);
  const cached = data[STORAGE_GROUPS_KEY] || null;
  const asleep = data[STORAGE_ASLEEP_KEY] || {};
  const savedMB = data[STORAGE_SAVED_KEY] || 0;
  if (!cached) return;

  const openTabs = await chrome.tabs.query({});
  const realTabIds = new Set(openTabs.map(t => t.id));
  const realUrls = new Set(openTabs.map(t => t.url).filter(Boolean));
  const groupUrls = cached.groups.flatMap(g => g.tabIds.map(id => cached.tabMap[id]?.url).filter(Boolean));

  // Update all summary numbers
  const openCount = groupUrls.filter(url => realUrls.has(url)).length;
  document.getElementById("tab-count").textContent   = openCount;
  document.getElementById("group-count").textContent = cached.groups.length;
  document.getElementById("memory-saved").textContent = savedMB.toFixed(1);

  await renderGroupTable(cached.groups, cached.tabMap, asleep, realTabIds, realUrls);
}

async function renderGroupTable(groups, tabMap, asleep, realTabIds, realUrls) {
  const wrap = document.getElementById("group-table-wrap");

  // chrome.processes requires Chrome Dev channel — not available on stable.
  // We use tab count as a proxy for relative memory weight instead.
  const hasRealData = false;
  const memoryByTabId = {};

  // Calculate max memory for bar scaling
  const groupMemories = groups.map(group => {
    const mem = group.tabIds.reduce((sum, id) => sum + (memoryByTabId[id] || 0), 0);
    return mem;
  });
  const maxMem = Math.max(...groupMemories, 1);

  // Total memory
  const totalMem = groupMemories.reduce((a, b) => a + b, 0);
  document.getElementById("total-memory").textContent =
    hasRealData ? totalMem.toFixed(1) : "—";

  // Build table
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
             <div class="mem-bar-fill ${isAsleep ? 'asleep' : ''}" style="width:${pct}%"></div>
           </div>
           <span class="mem-label">${mem.toFixed(1)} MB</span>
         </div>`
      : (() => {
          const openInGroup = group.tabIds.filter(id => {
            const url = tabMap[id]?.url;
            return url && realTabIds ? realUrls && realUrls.has(url) : true;
          }).length;
          const estMB = isAsleep ? 0 : openInGroup * 50;
          return `<span style="font-size:12px;color:#888">${openInGroup} tab${openInGroup !== 1 ? 's' : ''} · ~${estMB} MB est.</span>`;
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
      Memory shown is estimated at ~50MB per tab — actual usage varies by page.
      Real per-tab data requires Chrome Dev channel.
    </p>`;
  }

  wrap.innerHTML = html;
  document.getElementById("no-data") && (document.getElementById("no-data").style.display = "none");
}

// ─── Agreement rating form ────────────────────────────────────────────────────

function renderRatingForm(groups, tabMap) {
  const form = document.getElementById("rating-form");
  const noMsg = document.getElementById("no-groups-msg");
  if (noMsg) noMsg.remove();

  const ratings = {};

  groups.forEach((group, i) => {
    const tabTitles = group.tabIds
      .map(id => tabMap[id]?.title || "Unknown tab")
      .slice(0, 5) // show max 5 tab titles
      .join(", ");
    const more = group.tabIds.length > 5 ? ` +${group.tabIds.length - 5} more` : "";

    const block = document.createElement("div");
    block.className = "group-rating";

    block.innerHTML = `
      <div class="group-rating-name">${escapeHtml(group.name)}</div>
      <div class="rating-tabs">${escapeHtml(tabTitles)}${more}</div>
      <div class="stars" id="stars-${i}">
        ${[1,2,3,4,5].map(n => `
          <div class="star" data-group="${i}" data-val="${n}" title="${ratingLabel(n)}">
            ${n <= 2 ? '✗' : n === 3 ? '~' : '✓'}
          </div>
        `).join("")}
      </div>
      <div class="rating-label" id="rating-label-${i}">Rate how well this group matches your mental model</div>
    `;

    form.appendChild(block);

    // Wire up star clicks
    block.querySelectorAll(".star").forEach(star => {
      star.addEventListener("click", () => {
        const g = parseInt(star.dataset.group);
        const v = parseInt(star.dataset.val);
        ratings[g] = v;

        // Highlight selected stars
        block.querySelectorAll(".star").forEach(s => {
          s.classList.toggle("selected", parseInt(s.dataset.val) <= v);
        });

        document.getElementById(`rating-label-${g}`).textContent =
          `${v}/5 — ${ratingLabel(v)}`;

        updateScore(ratings, groups.length);
      });
    });
  });

  // Submit button
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
    ${pct >= 80 ? "Strong agreement — groupings match your mental model well" :
      pct >= 60 ? "Moderate agreement — some groups made sense, some didn't" :
      "Low agreement — groupings need improvement"}
    </span>
  `;
}

async function saveRatings(ratings, groups) {
  const entry = {
    timestamp: Date.now(),
    groupCount: groups.length,
    ratings,
    avgScore: Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingLabel(n) {
  return ["", "Completely wrong", "Mostly wrong", "Partially right", "Mostly right", "Perfect"][n];
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
