(function () {
  "use strict";

  const DEFAULT_ORDER = ["hero", "booking", "homes", "reviews", "stories", "about", "highlights", "stats"];
  const THEMES = {
    original: null,
    "warm-japandi": {
      bg: "#f7f1e8", surface: "#fffdf8", ink: "#473c34", muted: "#796c61", accent: "#a7664f", soft: "#eadbd0", radius: "26px", shadow: "0 18px 50px rgba(71,60,52,.10)"
    },
    "tropical-boutique": {
      bg: "#fbf8f0", surface: "#fffdf7", ink: "#163b2d", muted: "#64746c", accent: "#c96845", soft: "#dce8dc", radius: "24px", shadow: "0 18px 50px rgba(31,77,58,.11)"
    },
    "midnight-luxury": {
      bg: "#141414", surface: "#1e1e1e", ink: "#f5efe6", muted: "#c7bbad", accent: "#d7b98e", soft: "#2b2925", radius: "22px", shadow: "0 22px 60px rgba(0,0,0,.28)"
    },
    "coastal-calm": {
      bg: "#f2f6f6", surface: "#fbfdfd", ink: "#274553", muted: "#687f88", accent: "#527b8d", soft: "#dce8e8", radius: "28px", shadow: "0 18px 48px rgba(51,87,101,.10)"
    }
  };

  function normalizedPath() {
    try {
      return decodeURIComponent(location.pathname || "/").replace(/\/$/, "") || "/";
    } catch (_) {
      return "/";
    }
  }

  function mainPagesContainer() {
    return document.getElementById("roomGrid")?.closest("body > .container, .container") || null;
  }

  function sectionNode(key) {
    const map = {
      hero: () => document.getElementById("hero"),
      booking: () => document.getElementById("bookingSearch"),
      homes: () => mainPagesContainer(),
      reviews: () => document.getElementById("sharedCustomerReviews"),
      stories: () => document.querySelector("body > .story-section"),
      about: () => document.getElementById("about"),
      highlights: () => document.querySelector("body > .highlights-section"),
      stats: () => document.querySelector("body > .stats-bar")
    };
    return map[key]?.() || null;
  }

  function sanitize(config = {}) {
    const theme = Object.prototype.hasOwnProperty.call(THEMES, config.theme) ? config.theme : "original";
    const requested = Array.isArray(config.order) ? config.order : [];
    const order = [];
    for (const key of requested) {
      if (DEFAULT_ORDER.includes(key) && !order.includes(key)) order.push(key);
    }
    for (const key of DEFAULT_ORDER) if (!order.includes(key)) order.push(key);
    return { theme, order };
  }

  function ensureThemeStyle() {
    let style = document.getElementById("h3cn-site-theme-runtime");
    if (style) return style;
    style = document.createElement("style");
    style.id = "h3cn-site-theme-runtime";
    style.textContent = `
      html[data-site-theme]:not([data-site-theme="original"]) body{background:var(--st-bg)!important;color:var(--st-ink);transition:background .22s ease,color .22s ease}
      html[data-site-theme]:not([data-site-theme="original"]) #hero,
      html[data-site-theme]:not([data-site-theme="original"]) #bookingSearch .booking-search-card,
      html[data-site-theme]:not([data-site-theme="original"]) #sharedCustomerReviews,
      html[data-site-theme]:not([data-site-theme="original"]) body>.story-section,
      html[data-site-theme]:not([data-site-theme="original"]) #about,
      html[data-site-theme]:not([data-site-theme="original"]) body>.highlights-section,
      html[data-site-theme]:not([data-site-theme="original"]) body>.stats-bar{border-color:color-mix(in srgb,var(--st-accent) 18%,transparent)!important}
      html[data-site-theme]:not([data-site-theme="original"]) #bookingSearch .booking-search-card,
      html[data-site-theme]:not([data-site-theme="original"]) #roomGrid>*,
      html[data-site-theme]:not([data-site-theme="original"]) #sharedCustomerReviews>*,
      html[data-site-theme]:not([data-site-theme="original"]) body>.story-section>*,
      html[data-site-theme]:not([data-site-theme="original"]) #about>*{border-radius:var(--st-radius)!important}
      html[data-site-theme]:not([data-site-theme="original"]) #bookingSearch .booking-search-card{background:var(--st-surface)!important;box-shadow:var(--st-shadow)!important}
      html[data-site-theme]:not([data-site-theme="original"]) #bookingSearch h1,
      html[data-site-theme]:not([data-site-theme="original"]) #bookingSearch h2,
      html[data-site-theme]:not([data-site-theme="original"]) #roomGrid h1,
      html[data-site-theme]:not([data-site-theme="original"]) #roomGrid h2,
      html[data-site-theme]:not([data-site-theme="original"]) #roomGrid h3,
      html[data-site-theme]:not([data-site-theme="original"]) #sharedCustomerReviews h2,
      html[data-site-theme]:not([data-site-theme="original"]) #about h2{color:var(--st-ink)!important}
      html[data-site-theme]:not([data-site-theme="original"]) #bookingSearch p,
      html[data-site-theme]:not([data-site-theme="original"]) #sharedCustomerReviews p,
      html[data-site-theme]:not([data-site-theme="original"]) #about p{color:var(--st-muted)!important}
      html[data-site-theme="midnight-luxury"] #bookingSearch .booking-search-field,
      html[data-site-theme="midnight-luxury"] #bookingSearch .booking-price-item,
      html[data-site-theme="midnight-luxury"] #bookingSearch .booking-price-note{background:#282828!important;border-color:#3a3732!important;color:#e9dfd3!important}
      html[data-site-theme="midnight-luxury"] #bookingSearch select,
      html[data-site-theme="midnight-luxury"] #bookingSearch input{color:#f5efe6!important;background:transparent!important}
      html[data-site-theme]:not([data-site-theme="original"]) .site-theme-accent{color:var(--st-accent)!important}
      @media(max-width:768px){html[data-site-theme]:not([data-site-theme="original"]) #bookingSearch .booking-search-card{border-radius:min(var(--st-radius),22px)!important;box-shadow:0 10px 28px rgba(25,35,40,.08)!important}}
    `;
    document.head.appendChild(style);
    return style;
  }

  function applyTheme(themeName) {
    const root = document.documentElement;
    const theme = THEMES[themeName] || null;
    root.dataset.siteTheme = themeName in THEMES ? themeName : "original";
    if (!theme) {
      ["--st-bg", "--st-surface", "--st-ink", "--st-muted", "--st-accent", "--st-soft", "--st-radius", "--st-shadow"].forEach(key => root.style.removeProperty(key));
      return;
    }
    ensureThemeStyle();
    root.style.setProperty("--st-bg", theme.bg);
    root.style.setProperty("--st-surface", theme.surface);
    root.style.setProperty("--st-ink", theme.ink);
    root.style.setProperty("--st-muted", theme.muted);
    root.style.setProperty("--st-accent", theme.accent);
    root.style.setProperty("--st-soft", theme.soft);
    root.style.setProperty("--st-radius", theme.radius);
    root.style.setProperty("--st-shadow", theme.shadow);
  }

  function applyOrder(order) {
    if (normalizedPath() !== "/") return;
    const nodes = order.map(sectionNode).filter(Boolean);
    const parent = document.body;
    const movable = nodes.filter(node => node.parentElement === parent);
    if (movable.length < 2) return;

    let first = movable[0];
    for (const node of movable.slice(1)) {
      if (node.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) continue;
      first = node;
    }
    const marker = document.createComment("site-presentation-order");
    parent.insertBefore(marker, first);
    let cursor = marker;
    for (const node of movable) {
      parent.insertBefore(node, cursor.nextSibling);
      cursor = node;
    }
    marker.remove();
  }

  function applyConfig(raw) {
    const config = sanitize(raw);
    window.__h3cnSitePresentation = config;
    applyTheme(config.theme);
    applyOrder(config.order);
    document.documentElement.dataset.sitePresentationReady = "1";
    window.dispatchEvent(new CustomEvent("sitepresentation:applied", { detail: config }));
  }

  async function load() {
    if (window.__H3CN_SITE_PRESENTATION__) {
      applyConfig(window.__H3CN_SITE_PRESENTATION__);
      return;
    }
    try {
      const response = await fetch("/api/site-presentation", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      applyConfig(payload?.config || {});
    } catch (error) {
      console.warn("Site presentation fallback to original", error);
      applyConfig({ theme: "original", order: DEFAULT_ORDER });
    }
  }

  function reapply() {
    if (!window.__h3cnSitePresentation) return;
    requestAnimationFrame(() => {
      applyTheme(window.__h3cnSitePresentation.theme);
      applyOrder(window.__h3cnSitePresentation.order);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
  window.addEventListener("popstate", reapply);
  window.addEventListener("sitepresentation:refresh", load);
  window.__applyH3cnSitePresentation = applyConfig;
})();