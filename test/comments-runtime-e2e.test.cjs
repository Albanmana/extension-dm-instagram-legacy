const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { chromium } = require(
  "/Users/albanpro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

const extensionRoot = path.resolve(__dirname, "..");
const reelUrl = "https://www.instagram.com/reels/DUlMlmsCrfM/";
const reelHtml = `<!doctype html>
  <button><span aria-label="Commenter">Commenter</span>2</button>
  <main id="comments"></main>
  <script>
    document.querySelector("button").addEventListener("click", () => {
      document.querySelector("#comments").innerHTML = '<div><div><div><div><a href="/buyermind.xyz/">buyermind.xyz</a><span>Game</span><a href="/p/DUlMlmsCrfM/c/123/">1 h</a></div></div></div></div>';
    });
  </script>`;

test("extension opens the Reel comments panel through Chrome input before extracting commenters", async (t) => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "instagram-dm-studio-runtime-"));
  t.after(() => fsp.rm(profileDir, { recursive: true, force: true }));

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionRoot}`, `--load-extension=${extensionRoot}`],
  });
  t.after(() => context.close());

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const page = await context.newPage();
  await page.route(reelUrl, (route) => route.fulfill({ contentType: "text/html", body: reelHtml }));
  await page.goto(reelUrl);

  const result = await worker.evaluate(async ({ url }) => {
    const [tab] = await chrome.tabs.query({ url });
    if (!tab?.id) throw new Error("Mock Reel tab not found.");
    await drivePostPageForComments(tab.id, url);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return fallbackCollectCommentsFromDom(tab.id, url);
  }, { url: reelUrl });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].username, "buyermind.xyz");
  assert.equal(result.items[0].comment_text, "Game");
});
