// ── Crypto helpers ────────────────────────────────────────────
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function encryptApiKey(rawValue) {
  const cryptoKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(rawValue)
  );
  const exportedKey = await crypto.subtle.exportKey("raw", cryptoKey);
  return {
    apiKeyEncrypted: bufToBase64(encrypted),
    apiKeyIv: bufToBase64(iv),
    apiKeyCryptoKey: bufToBase64(exportedKey),
  };
}

const DEFAULT_AUTO_FETCH_URL = "https://n8n.srv765660.hstgr.cloud/webhook/ada824b2-daf0-4209-b302-38cbcce1e57e";
const DEFAULT_MARK_DONE_URL  = "https://n8n.srv765660.hstgr.cloud/webhook/405003b5-07bb-47bf-a087-15714542fd31";

// ── DOM refs ──────────────────────────────────────────────────
const fetchUrlInput     = document.getElementById("fetch-url");
const fetchIntervalSel  = document.getElementById("fetch-interval");
const toggleBtn         = document.getElementById("toggle-autofetch");
const autofetchStatus   = document.getElementById("autofetch-status");
const apikeyEntry       = document.getElementById("apikey-entry");
const apikeyInput       = document.getElementById("apikey-input");
const apikeySaveBtn     = document.getElementById("apikey-save");
const apikeySavedDiv    = document.getElementById("apikey-saved");
const apikeyReplaceBtn  = document.getElementById("apikey-replace");
const apikeyDeleteBtn   = document.getElementById("apikey-delete");
const statusEl          = document.getElementById("settings-status");

function setStatus(msg, state = "idle") {
  statusEl.textContent = msg;
  statusEl.dataset.state = state;
}

// ── Render helpers ────────────────────────────────────────────
function renderAutoFetch(enabled) {
  toggleBtn.textContent = enabled ? "Disable" : "Enable";
  autofetchStatus.textContent = enabled ? "Active" : "Inactive";
  autofetchStatus.dataset.state = enabled ? "active" : "inactive";
}

function renderApiKey(hasSaved) {
  apikeyEntry.hidden  = hasSaved;
  apikeySavedDiv.hidden = !hasSaved;
  apikeyInput.value   = "";
}

// ── Load on open ──────────────────────────────────────────────
async function loadSettings() {
  const {
    autoFetchUrl          = DEFAULT_AUTO_FETCH_URL,
    autoFetchIntervalHours = 3,
    autoFetchEnabled      = false,
    apiKeyEncrypted       = null,
  } = await chrome.storage.local.get([
    "autoFetchUrl", "autoFetchIntervalHours", "autoFetchEnabled", "apiKeyEncrypted",
  ]);

  fetchUrlInput.value    = autoFetchUrl;
  fetchIntervalSel.value = String(autoFetchIntervalHours);
  renderAutoFetch(autoFetchEnabled);
  renderApiKey(!!apiKeyEncrypted);
}

loadSettings();

// ── Auto-fetch toggle ─────────────────────────────────────────
toggleBtn.addEventListener("click", async () => {
  const url   = fetchUrlInput.value.trim();
  const hours = parseFloat(fetchIntervalSel.value);
  const { autoFetchEnabled = false } = await chrome.storage.local.get("autoFetchEnabled");
  const next = !autoFetchEnabled;

  if (next && !url) {
    setStatus("Please enter a URL before enabling.", "error");
    return;
  }

  await chrome.storage.local.set({
    autoFetchUrl: url,
    autoFetchIntervalHours: hours,
    autoFetchEnabled: next,
  });

  if (next) {
    chrome.alarms.create("IG_AUTO_FETCH", { periodInMinutes: hours * 60 });
    setStatus(`Auto-fetch enabled - every ${hours < 1 ? hours * 60 + " min" : hours + "h"}.`, "success");
  } else {
    await chrome.alarms.clear("IG_AUTO_FETCH");
    setStatus("Auto-fetch disabled.", "idle");
  }

  renderAutoFetch(next);
});

// Persist URL / interval changes immediately so toggle picks them up
fetchUrlInput.addEventListener("change", () =>
  chrome.storage.local.set({ autoFetchUrl: fetchUrlInput.value.trim() })
);

fetchIntervalSel.addEventListener("change", async () => {
  const hours = parseFloat(fetchIntervalSel.value);
  await chrome.storage.local.set({ autoFetchIntervalHours: hours });
  const { autoFetchEnabled = false } = await chrome.storage.local.get("autoFetchEnabled");
  if (autoFetchEnabled) {
    await chrome.alarms.clear("IG_AUTO_FETCH");
    chrome.alarms.create("IG_AUTO_FETCH", { periodInMinutes: hours * 60 });
    setStatus(`Interval updated - every ${hours < 1 ? hours * 60 + " min" : hours + "h"}.`);
  }
});

// ── API key ───────────────────────────────────────────────────
apikeySaveBtn.addEventListener("click", async () => {
  const raw = apikeyInput.value.trim();
  if (!raw) { setStatus("API key is empty.", "error"); return; }
  try {
    const payload = await encryptApiKey(raw);
    await chrome.storage.local.set(payload);
    renderApiKey(true);
    setStatus("Key saved and encrypted.", "success");
  } catch (err) {
    setStatus(`Encryption error: ${err.message}`, "error");
  }
});

apikeyReplaceBtn.addEventListener("click", () => {
  renderApiKey(false);
  apikeyInput.focus();
});

apikeyDeleteBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["apiKeyEncrypted", "apiKeyIv", "apiKeyCryptoKey"]);
  renderApiKey(false);
  setStatus("Key deleted.", "idle");
});

// ── Mark Done Webhook ─────────────────────────────────────────
const markDoneUrlInput = document.getElementById("mark-done-url");

async function loadMarkDoneSettings() {
  const { markDoneUrl = DEFAULT_MARK_DONE_URL } = await chrome.storage.local.get("markDoneUrl");
  markDoneUrlInput.value = markDoneUrl;
}

loadMarkDoneSettings();

markDoneUrlInput.addEventListener("change", () =>
  chrome.storage.local.set({ markDoneUrl: markDoneUrlInput.value.trim() })
);
