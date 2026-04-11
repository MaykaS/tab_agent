// background.js - autonomous observer and agent loop

importScripts("storage.js", "agent.js");

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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "tab-agent-cycle") return;

  try {
    await runAgentCycle();
  } catch (error) {
    console.warn("Tab Agent background: agent cycle failed", error);
  }
});
