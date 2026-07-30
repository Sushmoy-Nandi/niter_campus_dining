export async function triggerLiveSheetSync() {
  const syncUrl = process.env.GOOGLE_SCRIPT_AUTO;
  if (!syncUrl) return;

  try {
    // We send a POST request to the Google Script Web App webhook.
    // We don't await the result deeply because we want it to run in the background.
    fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "sync" }),
    }).catch((e) => console.error("Failed to trigger live sheet sync", e));
  } catch (error) {
    console.error("Live sheet sync error", error);
  }
}
