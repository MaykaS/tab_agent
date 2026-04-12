// background.js - autonomous observer and agent loop

importScripts("storage.js", "agent.js");

const liveTabMetadata = new Map();

async function resolveGroupNameForUrl(url) {
  if (!shouldTrackTabUrl(url)) return null;
  const { cached } = await getGroupingState();
  return findGroupMatch(url, cached).groupName || null;
}

function rememberLiveTab(tab, groupName = null) {
  if (!tab?.id || !shouldTrackTabUrl(tab.url)) return;
  liveTabMetadata.set(tab.id, {
    tabId: tab.id,
    url: tab.url,
    title: tab.title || "Untitled",
    groupName: groupName || null,
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const policy = await getAgentPolicy();
    await saveAgentPolicy(policy);
    chrome.alarms.create("tab-agent-cycle", { periodInMinutes: 5 });
  } catch (error) {
    console.warn("Tab Agent background install init failed", error);
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("tab-agent-cycle", { periodInMinutes: 5 });
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab?.url || tab.url.startsWith("chrome")) return;

    await writeVisit(tab.url);
    const { groupName } = await updateBehaviorModels(tab);
    rememberLiveTab(tab, groupName);
    await recordRecentActivation(tab, groupName);

    const quickReopenMarked = await markAutoSleepOutcome(tab.url, "regret_reopen_within_5m");
    if (!quickReopenMarked) {
      await markAutoSleepOutcome(tab.url, "regret_reopen_within_15m");
    }

    await handleContextWake(tab);
  } catch (err) {
    console.warn("Tab Agent background: could not process activation", err);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    if (!shouldTrackTabUrl(tab?.url)) return;
    const groupName = await resolveGroupNameForUrl(tab.url);
    rememberLiveTab(tab, groupName);
    await appendTabEvent({
      eventType: "open",
      tabId: tab.id,
      url: tab.url,
      title: tab.title || "Untitled",
      groupName,
      source: "user",
    });
  } catch (error) {
    console.warn("Tab Agent background: could not process tab create", error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (!shouldTrackTabUrl(changeInfo.url || tab?.url)) return;

    const nextUrl = changeInfo.url || tab.url;
    const previous = liveTabMetadata.get(tabId);
    const shouldLogOpen = !previous || previous.url !== nextUrl;
    const groupName = await resolveGroupNameForUrl(nextUrl);

    rememberLiveTab({
      id: tabId,
      url: nextUrl,
      title: tab?.title || previous?.title || "Untitled",
    }, groupName);

    if (shouldLogOpen) {
      await appendTabEvent({
        eventType: "open",
        tabId,
        url: nextUrl,
        title: tab?.title || previous?.title || "Untitled",
        groupName,
        source: "user",
      });
    }
  } catch (error) {
    console.warn("Tab Agent background: could not process tab update", error);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const meta = liveTabMetadata.get(tabId);
    if (!meta?.url) return;

    await appendTabEvent({
      eventType: "close",
      tabId,
      url: meta.url,
      title: meta.title || "Untitled",
      groupName: meta.groupName || null,
      source: "user",
    });
  } catch (error) {
    console.warn("Tab Agent background: could not process tab removal", error);
  } finally {
    liveTabMetadata.delete(tabId);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tab-agent-cycle") return;

  try {
    await runAgentCycle();
  } catch (error) {
    console.warn("Tab Agent background: agent cycle failed", error);
  }
});
