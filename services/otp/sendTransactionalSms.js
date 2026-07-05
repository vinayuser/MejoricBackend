require("dotenv").config();
const axios = require("axios");
const { throwError } = require("../../utils");
const { formatMobileNumber } = require("./formatMobileNumber");

const TWO_FACTOR_BASE_URL = "https://2factor.in/API/V1";

/**
 * Send a custom transactional SMS via 2factor Transactional SMS API.
 * Requires TWO_FACTOR_API_KEY and TWO_FACTOR_SENDER_ID (DLT-approved sender ID).
 */
exports.sendTransactionalSms = async (mobile, message) => {
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  if (!apiKey) throwError(500, "TWO_FACTOR_API_KEY is not configured");

  const senderId = process.env.TWO_FACTOR_SENDER_ID;
  if (!senderId) {
    throwError(
      500,
      "TWO_FACTOR_SENDER_ID is not configured (required for transactional SMS)",
    );
  }

  const text = String(message || "").trim();
  if (!text) throwError(422, "SMS message is required");
  if (text.length > 1000) throwError(422, "SMS message is too long (max 1000 chars)");

  const formattedMobile = formatMobileNumber(mobile);
  if (!formattedMobile) throwError(422, "Invalid mobile number");

  const url = `${TWO_FACTOR_BASE_URL}/${apiKey}/ADDON_SERVICES/SEND/TSMS`;

  try {
    const response = await axios.post(
      url,
      {
        From: senderId,
        To: formattedMobile,
        Msg: text,
      },
      {
        headers: { "Content-Type": "application/json" },
        maxBodyLength: Infinity,
        timeout: 30000,
      },
    );

    const data = response?.data;
    if (data?.Status !== "Success") {
      throwError(502, data?.Details || "Failed to send SMS");
    }

    return {
      mobile: formattedMobile,
      sessionId: data?.Details || null,
      status: data?.Status,
    };
  } catch (error) {
    if (error.statusCode) throw error;

    const apiDetails =
      error?.response?.data?.Details ||
      (typeof error?.response?.data === "string"
        ? error.response.data.slice(0, 200)
        : null);

    console.error(
      "Error sending transactional SMS:",
      apiDetails || error?.response?.data || error.message,
    );

    throwError(
      502,
      apiDetails || error.message || "Failed to send SMS",
    );
  }
};
