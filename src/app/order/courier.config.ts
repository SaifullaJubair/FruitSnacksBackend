import { getCachedSetting } from "../../helpers/settingCache";
import ApiError from "../../errors/ApiError";

/**
 * Courier credentials, read from the settings document.
 *
 * DELIBERATELY NO `process.env` FALLBACK.
 *
 * The .env on this deployment still carries the PREVIOUS owner's Pathao and
 * Steadfast keys (this codebase is a rebrand of another shop). A `DB || env`
 * fallback would mean: client has not entered their credentials yet -> we
 * quietly ship their customer's parcel on the previous owner's account. A
 * missing config must fail loudly, not fall back to someone else's account.
 *
 * So: no credentials in the settings doc = the courier is simply not
 * configured, and the admin gets told so.
 */

export type PathaoConfig = {
  base_url: string;
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
  store_id: string;
  webhook_secret: string;
};

export type SteadfastConfig = {
  base_url: string;
  api_key: string;
  api_secret: string;
  webhook_secret: string;
};

const PATHAO_LIVE = "https://api-hermes.pathao.com/aladdin/api/v1";
const PATHAO_SANDBOX = "https://courier-api-sandbox.pathao.com/aladdin/api/v1";
const STEADFAST_BASE = "https://portal.packzy.com/api/v1";

// Reuses the shared settings cache (helpers/settingCache.ts) rather than keeping
// its own. Every settings-update path already calls invalidateSettingCache(), so
// a credential change takes effect on the next courier call — a second cache
// here would just be one more thing to forget to invalidate.
const loadSetting = async (): Promise<any> => (await getCachedSetting()) || {};

const missing = (courier: string, fields: string[]) =>
  new ApiError(
    400,
    `${courier} credentials are not configured (${fields.join(", ")}). ` +
      `Set them in Admin → Settings → Courier.`,
  );

/**
 * Credentials for READ-ONLY Pathao lookups — the city / zone / area lists the
 * checkout address form is built from. This is the ONE place with a process.env
 * fallback, and it is deliberate.
 *
 * The rule everywhere else is: no credentials in the settings document means the
 * courier is not configured, and we fail loudly rather than ship a customer's
 * parcel on the previous owner's account. That rule protects money and parcels.
 * A zone list moves neither: it returns the same public list of Dhaka areas
 * whichever merchant account asks for it.
 *
 * Without a fallback, a shop that has not entered its Pathao credentials yet has
 * no checkout at all — the customer cannot pick an address, so they cannot order,
 * from any courier. That is a worse failure than the one we are guarding against.
 *
 * Note what this does NOT return: `store_id`. Sending a parcel requires one, and
 * it only ever comes from the settings document (getPathaoConfig). So these
 * credentials cannot be used to send an order to anyone's account, by accident or
 * otherwise — they can only read a list.
 */
export type PathaoLookupConfig = {
  base_url: string;
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
};

export const getPathaoLookupConfig = async (): Promise<PathaoLookupConfig> => {
  const s = (await loadSetting()) || {};

  // The shop's own credentials win the moment they are entered — the fallback is
  // only ever reached while the settings are still empty.
  const fromDb = {
    client_id: (s.pathao_client_id || "").trim(),
    client_secret: (s.pathao_client_secret || "").trim(),
    username: (s.pathao_username || "").trim(),
    password: (s.pathao_password || "").trim(),
  };
  const complete = Object.values(fromDb).every(Boolean);

  const cfg: PathaoLookupConfig = complete
    ? { base_url: s.pathao_sandbox ? PATHAO_SANDBOX : PATHAO_LIVE, ...fromDb }
    : {
        base_url: process.env.PATHAO_BASE_URL?.trim() || PATHAO_LIVE,
        client_id: (process.env.PATHAO_CLIENT_ID || "").trim(),
        client_secret: (process.env.PATHAO_CLIENT_SECRET || "").trim(),
        username: (process.env.PATHAO_CLIENT_EMAIL || "").trim(),
        password: (process.env.PATHAO_CLIENT_PASSWORD || "").trim(),
      };

  const blank = (
    ["client_id", "client_secret", "username", "password"] as const
  ).filter((k) => !cfg[k]);
  if (blank.length) throw missing("Pathao", blank as unknown as string[]);

  return cfg;
};

/** Throws with an actionable message when Pathao is off or half-configured. */
export const getPathaoConfig = async (): Promise<PathaoConfig> => {
  const s = (await loadSetting()) || {};
  if (!s.pathao_enabled) {
    throw new ApiError(
      400,
      "Pathao is turned off. Enable it in Admin → Settings → Courier.",
    );
  }

  const cfg: PathaoConfig = {
    base_url: s.pathao_sandbox ? PATHAO_SANDBOX : PATHAO_LIVE,
    client_id: (s.pathao_client_id || "").trim(),
    client_secret: (s.pathao_client_secret || "").trim(),
    username: (s.pathao_username || "").trim(),
    password: (s.pathao_password || "").trim(),
    store_id: (s.pathao_store_id || "").trim(),
    webhook_secret: (s.pathao_webhook_secret || "").trim(),
  };

  // webhook_secret is NOT required to send an order — only to receive status
  // updates — so it is not in this list.
  const required: (keyof PathaoConfig)[] = [
    "client_id",
    "client_secret",
    "username",
    "password",
    "store_id",
  ];
  const blank = required.filter((k) => !cfg[k]);
  if (blank.length) throw missing("Pathao", blank as string[]);

  return cfg;
};

/** Throws with an actionable message when Steadfast is off or half-configured. */
export const getSteadfastConfig = async (): Promise<SteadfastConfig> => {
  const s = (await loadSetting()) || {};
  if (!s.steadfast_enabled) {
    throw new ApiError(
      400,
      "Steadfast is turned off. Enable it in Admin → Settings → Courier.",
    );
  }

  const cfg: SteadfastConfig = {
    base_url: STEADFAST_BASE,
    api_key: (s.steadfast_api_key || "").trim(),
    api_secret: (s.steadfast_api_secret || "").trim(),
    webhook_secret: (s.steadfast_webhook_secret || "").trim(),
  };

  const blank = (["api_key", "api_secret"] as (keyof SteadfastConfig)[]).filter(
    (k) => !cfg[k],
  );
  if (blank.length) throw missing("Steadfast", blank as string[]);

  return cfg;
};

/**
 * Webhook secrets, read WITHOUT the enabled/complete checks above — a webhook
 * can arrive at any time and we must be able to verify it (or refuse it) on its
 * own terms. Returns "" when unset; callers must treat that as "cannot verify"
 * and refuse, never as "skip the check".
 */
export const getWebhookSecrets = async (): Promise<{
  pathao: string;
  steadfast: string;
}> => {
  const s = (await loadSetting()) || {};
  return {
    pathao: (s.pathao_webhook_secret || "").trim(),
    steadfast: (s.steadfast_webhook_secret || "").trim(),
  };
};
