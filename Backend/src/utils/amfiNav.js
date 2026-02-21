const AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

function parseNav(value) {
  if (!value || !String(value).trim()) return 0;
  try {
    return parseFloat(String(value).trim().replace(/,/g, ""));
  } catch {
    return 0;
  }
}

/**
 * Fetch full AMFI NAV file once and return a Map of amfi_code -> { nav, schemeName, date }.
 * Use this to enrich multiple funds in one request (e.g. portfolio by session).
 */
export async function fetchAmfiNavMap() {
  const map = new Map();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(AMFI_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FundTracker/1.0)"
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("[fetchAmfiNavMap] HTTP error:", response.status);
      return map;
    }

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      if (!line || line.startsWith("Scheme Code")) continue;
      const parts = line.split(";");
      if (parts.length < 5) continue;

      const amfiCode = parts[0].trim();
      if (!amfiCode) continue;

      map.set(amfiCode, {
        nav: parseNav(parts[4]),
        schemeName: parts[3].trim(),
        date: parts[5]?.trim() || new Date().toISOString().split("T")[0]
      });
    }
  } catch (error) {
    console.error("[fetchAmfiNavMap] Error:", error.message);
  }
  return map;
}

/**
 * Fetch current NAV from AMFI for a single AMFI code (for fund detail endpoints).
 */
export async function fetchCurrentNav(amfiCode) {
  const map = await fetchAmfiNavMap();
  const entry = map.get(amfiCode);
  if (!entry) return null;
  return {
    nav: entry.nav,
    schemeName: entry.schemeName,
    date: entry.date
  };
}
