import geoip from "geoip-lite";

// S4+S5 Phase 1B — IP-based enrichment for CAPI user_data.
// geoip-lite ships an offline MaxMind GeoLite2 country/city DB
// (~50MB in node_modules). Lookups are synchronous in-memory —
// no API call, no latency.
//
// Bangladesh accuracy: city-level ~85% on major hubs (Dhaka,
// Chittagong, Sylhet); rural mobile IPs may misroute to the
// upstream ISP city. Form-derived data (when present) overrides
// this so logged-in / checkout flows always win.

export interface GeoEnriched {
  ct?: string; // city, lowercase
  st?: string; // region/state, lowercase
  country?: string; // ISO 2-letter, lowercase
}

// Strip the IPv6 mapping wrapper (::ffff:) and grab the first hop in
// x-forwarded-for chains. geoip-lite handles both v4 and v6 lookups.
const cleanIp = (raw?: string): string => {
  if (!raw) return "";
  const first = raw.split(",")[0]?.trim() || "";
  return first.replace(/^::ffff:/, "");
};

export const enrichFromIp = (rawIp?: string): GeoEnriched => {
  const ip = cleanIp(rawIp);
  if (!ip) return {};
  // Loopback / private IPs return null; nothing to enrich on local dev.
  const geo = geoip.lookup(ip);
  if (!geo) return {};
  return {
    ct: geo.city ? geo.city.toLowerCase().trim() : undefined,
    st: geo.region ? geo.region.toLowerCase().trim() : undefined,
    country: geo.country ? geo.country.toLowerCase().trim() : undefined,
  };
};
