/**
 * Cloudflare Zone IP Access Rules — block / unblock a single IP.
 * Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID.
 */
const axios = require("axios");

function getConfig() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  return { token, zoneId };
}

function isConfigured() {
  const { token, zoneId } = getConfig();
  return Boolean(token && zoneId);
}

async function blockIp(ip, notes = "Blocked via Mejoric moderation") {
  const { token, zoneId } = getConfig();
  if (!token || !zoneId) {
    const err = new Error(
      "Cloudflare is not configured (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID).",
    );
    err.code = "CF_NOT_CONFIGURED";
    throw err;
  }

  try {
    const res = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/access_rules/rules`,
      {
        mode: "block",
        configuration: {
          target: "ip",
          value: String(ip).trim(),
        },
        notes: String(notes || "").slice(0, 500),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      },
    );

    const data = res.data || {};
    if (res.status >= 400 || !data.success) {
      const msg =
        data?.errors?.[0]?.message ||
        data?.messages?.[0]?.message ||
        `Cloudflare block failed (${res.status})`;
      const err = new Error(msg);
      err.code = "CF_BLOCK_FAILED";
      err.details = data?.errors;
      throw err;
    }

    return {
      ruleId: data.result?.id,
      result: data.result,
    };
  } catch (err) {
    if (err.code === "CF_BLOCK_FAILED" || err.code === "CF_NOT_CONFIGURED") {
      throw err;
    }
    const wrapped = new Error(err.message || "Cloudflare block request failed");
    wrapped.code = "CF_BLOCK_FAILED";
    throw wrapped;
  }
}

async function unblockIp(cfRuleId) {
  if (!cfRuleId) return { skipped: true };
  const { token, zoneId } = getConfig();
  if (!token || !zoneId) {
    const err = new Error(
      "Cloudflare is not configured (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID).",
    );
    err.code = "CF_NOT_CONFIGURED";
    throw err;
  }

  try {
    const res = await axios.delete(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/access_rules/rules/${cfRuleId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      },
    );

    const data = res.data || {};
    if (res.status === 404) {
      return { deleted: false, alreadyGone: true };
    }
    if (res.status >= 400 || data.success === false) {
      const msg =
        data?.errors?.[0]?.message ||
        data?.messages?.[0]?.message ||
        `Cloudflare unblock failed (${res.status})`;
      const err = new Error(msg);
      err.code = "CF_UNBLOCK_FAILED";
      err.details = data?.errors;
      throw err;
    }

    return { deleted: true, result: data.result };
  } catch (err) {
    if (err.code === "CF_UNBLOCK_FAILED" || err.code === "CF_NOT_CONFIGURED") {
      throw err;
    }
    const wrapped = new Error(err.message || "Cloudflare unblock request failed");
    wrapped.code = "CF_UNBLOCK_FAILED";
    throw wrapped;
  }
}

module.exports = {
  isConfigured,
  blockIp,
  unblockIp,
};
