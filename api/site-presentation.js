import { getAdminDatabase } from "../lib/firebase-admin.js";

const THEMES = new Set([
  "original",
  "warm-japandi",
  "tropical-boutique",
  "midnight-luxury",
  "coastal-calm"
]);

const SECTIONS = [
  "hero",
  "booking",
  "homes",
  "reviews",
  "stories",
  "about",
  "highlights",
  "stats"
];

const DEFAULT_CONFIG = Object.freeze({
  theme: "original",
  order: SECTIONS,
  version: 1,
  publishedAt: 0
});

function sanitizeConfig(raw = {}) {
  const theme = THEMES.has(String(raw.theme || "")) ? String(raw.theme) : "original";
  const requested = Array.isArray(raw.order) ? raw.order.map(String) : [];
  const order = [];

  for (const key of requested) {
    if (SECTIONS.includes(key) && !order.includes(key)) order.push(key);
  }
  for (const key of SECTIONS) {
    if (!order.includes(key)) order.push(key);
  }

  return {
    theme,
    order,
    version: Math.max(1, Number(raw.version || 1) || 1),
    publishedAt: Number(raw.publishedAt || raw.updatedAt || 0) || 0
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const db = getAdminDatabase();
    const snapshot = await db.ref("productOps/sitePresentation/published").get();
    const config = snapshot.exists() ? sanitizeConfig(snapshot.val()) : { ...DEFAULT_CONFIG };

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ ok: true, config });
  } catch (error) {
    console.error("site-presentation read failed", error);
    res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
    return res.status(200).json({ ok: true, config: { ...DEFAULT_CONFIG }, fallback: true });
  }
}
