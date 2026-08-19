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
const scrollingReelHtml = `<!doctype html>
  <button><span aria-label="Commenter">Commenter</span>45</button>
  <div id="comments" style="height: 120px; overflow-y: auto"></div>
  <script>
    const comments = document.querySelector("#comments");
    let page = 0;
    Object.defineProperty(comments, "scrollHeight", { get: () => 480 });
    Object.defineProperty(comments, "clientHeight", { get: () => 120 });
    const render = () => {
      const first = page * 15 + 1;
      comments.innerHTML = Array.from({ length: 15 }, (_, index) => {
        const number = first + index;
        return '<div><div><div><div><a href="/commenter' + number + '/">commenter' + number + '</a><span>Game ' + number + '</span><a href="/p/DUlMlmsCrfM/c/' + number + '/">1 h</a></div></div></div></div>';
      }).join("");
    };
    comments.addEventListener("scroll", () => {
      if (comments.scrollTop > 0 && page < 2) {
        page += 1;
        comments.scrollTop = 0;
        render();
      }
    });
    document.querySelector("button").addEventListener("click", render);
  </script>`;

test("comment collection scrolls virtualized batches until Max leads is reached", async (t) => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "instagram-dm-studio-scroll-"));
  t.after(() => fsp.rm(profileDir, { recursive: true, force: true }));

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionRoot}`, `--load-extension=${extensionRoot}`],
  });
  t.after(() => context.close());

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const page = await context.newPage();
  await page.route(reelUrl, (route) => route.fulfill({ contentType: "text/html", body: scrollingReelHtml }));
  await page.goto(reelUrl);

  const result = await worker.evaluate(async ({ url }) => {
    const [tab] = await chrome.tabs.query({ url });
    await drivePostPageForComments(tab.id, url);
    return collectCommentBatches(tab.id, url, 30);
  }, { url: reelUrl });

  assert.equal(result.length, 30);
  assert.equal(result.at(-1).username, "commenter30");
});
