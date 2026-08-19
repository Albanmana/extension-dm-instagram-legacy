const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeMediaUrl,
  isRequestedMediaUrl,
} = require("../scrape-target.js");

test("normalizes legacy and current Reel URLs to the current /reels/ route", () => {
  assert.equal(
    normalizeMediaUrl("https://www.instagram.com/reel/DUlMlmsCrfM/?utm_source=test"),
    "https://www.instagram.com/reels/DUlMlmsCrfM/"
  );
  assert.equal(
    normalizeMediaUrl("https://www.instagram.com/reels/DUlMlmsCrfM/"),
    "https://www.instagram.com/reels/DUlMlmsCrfM/"
  );
});

test("keeps comment scraping pinned to the requested Reel while the Reels feed is present", () => {
  const requested = "https://www.instagram.com/reels/DUlMlmsCrfM/";

  assert.equal(isRequestedMediaUrl(requested, "https://www.instagram.com/reels/DUlMlmsCrfM/"), true);
  assert.equal(isRequestedMediaUrl(requested, "https://www.instagram.com/reels/DWzD9vJh3cZ/"), false);
});
