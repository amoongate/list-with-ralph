// api/listing.js  (build: og-preview-v1)
// Serves the listing detail template with per-listing link-preview tags
// (Open Graph + Twitter) injected, so texted or shared listing links show
// the home's photo, address, and price. The page itself still renders
// client-side exactly as before.

const SB_URL = "https://emguqhnftdvhbufcddtz.supabase.co";
const SB_KEY = "sb_publishable_emkrL8EVhWO0CAH4R0Wiug_BZtPGv9T";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function money(n) {
  return (n || n === 0) ? "$" + Number(n).toLocaleString("en-US") : "";
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;

  // 1) load the static detail template from this same deployment
  let html;
  try {
    const t = await fetch(`https://${host}/listing`);
    html = await t.text();
  } catch (e) {
    res.status(500).send("Template unavailable");
    return;
  }

  // 2) look up the listing and inject preview tags (skip silently on any failure)
  try {
    const q = `${SB_URL}/rest/v1/listings?select=address,city,state,title,status,price,sold_price,hero_image,gallery&slug=eq.${encodeURIComponent(slug)}&published=is.true&limit=1`;
    const r = await fetch(q, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    const rows = await r.json();
    const l = Array.isArray(rows) && rows[0];
    if (l) {
      const img = l.hero_image || (Array.isArray(l.gallery) && l.gallery[0] && l.gallery[0].url) || "";
      const title = `${l.address} | Ralph Richardson`;
      const priceTxt = l.status === "sold"
        ? (money(l.sold_price) ? money(l.sold_price) + " Sold" : "Sold")
        : money(l.price);
      const desc = [l.title, priceTxt, [l.city, l.state].filter(Boolean).join(", ")]
        .filter(Boolean).join(" \u00b7 ");
      const tags = [
        `<meta property="og:type" content="website">`,
        `<meta property="og:site_name" content="List With Ralph">`,
        `<meta property="og:title" content="${esc(title)}">`,
        `<meta property="og:description" content="${esc(desc)}">`,
        img ? `<meta property="og:image" content="${esc(img)}">` : "",
        `<meta property="og:url" content="https://${esc(host)}/listings/${esc(slug)}">`,
        `<meta name="twitter:card" content="summary_large_image">`,
        `<meta name="twitter:title" content="${esc(title)}">`,
        img ? `<meta name="twitter:image" content="${esc(img)}">` : ""
      ].filter(Boolean).join("\n");
      html = html.replace("<title>Listing | Ralph Richardson</title>", `<title>${esc(title)}</title>`);
      html = html.replace("</head>", tags + "\n</head>");
    }
  } catch (e) { /* serve the plain template if lookup fails */ }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(html);
}
