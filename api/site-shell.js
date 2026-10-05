import fs from "node:fs";
import path from "node:path";
import { getAdminDatabase } from "../lib/firebase-admin.js";

const ALLOWED_THEMES = new Set(["original", "warm-japandi", "tropical-boutique", "midnight-luxury", "coastal-calm"]);
const DEFAULT_ORDER = ["hero", "booking", "homes", "reviews", "stories", "about", "highlights", "stats"];
let cachedHtml = "";

function getHtml() {
  if (!cachedHtml) cachedHtml = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  return cachedHtml;
}

function sanitize(raw = {}) {
  const theme = ALLOWED_THEMES.has(String(raw.theme || "")) ? String(raw.theme) : "original";
  const order = [];
  for (const key of Array.isArray(raw.order) ? raw.order.map(String) : []) {
    if (DEFAULT_ORDER.includes(key) && !order.includes(key)) order.push(key);
  }
  for (const key of DEFAULT_ORDER) if (!order.includes(key)) order.push(key);
  return { theme, order, version: Math.max(1, Number(raw.version || 1) || 1) };
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  let config = sanitize({});
  try {
    const snapshot = await getAdminDatabase().ref("productOps/sitePresentation/published").get();
    if (snapshot.exists()) config = sanitize(snapshot.val());
  } catch (error) {
    console.error("site shell presentation fallback", error);
  }

  const boot = `<script>window.__H3CN_SITE_PRESENTATION__=${safeJson(config)};</script><script defer src="/site-presentation.js?v=v760-site-studio"></script>`;
  const html = getHtml().replace("</body>", `${boot}\n</body>`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).send(html);
}
