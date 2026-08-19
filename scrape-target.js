(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.InstagramScrapeTarget = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MEDIA_PATHS = new Set(["p", "reel", "reels", "tv"]);

  function getMediaIdentity(rawUrl) {
    const parsed = new URL(String(rawUrl || "").trim());
    const hostname = parsed.hostname.replace(/^www\./i, "");
    if (hostname !== "instagram.com") {
      throw new Error("The post URL must be an Instagram URL.");
    }

    const [kind, shortcode] = parsed.pathname.split("/").filter(Boolean);
    if (!MEDIA_PATHS.has(kind) || !shortcode) {
      throw new Error("The URL must point to an Instagram post or reel.");
    }

    return { kind, shortcode };
  }

  function normalizeMediaUrl(rawUrl) {
    const { kind, shortcode } = getMediaIdentity(rawUrl);
    const canonicalKind = kind === "reel" || kind === "reels" ? "reels" : kind;
    return `https://www.instagram.com/${canonicalKind}/${shortcode}/`;
  }

  function isRequestedMediaUrl(requestedUrl, loadedUrl) {
    try {
      return getMediaIdentity(requestedUrl).shortcode === getMediaIdentity(loadedUrl).shortcode;
    } catch {
      return false;
    }
  }

  return { getMediaIdentity, normalizeMediaUrl, isRequestedMediaUrl };
});
