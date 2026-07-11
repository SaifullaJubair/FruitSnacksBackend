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
