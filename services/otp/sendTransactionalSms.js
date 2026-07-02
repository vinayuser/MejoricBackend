require("dotenv").config();
const axios = require("axios");
const { throwError } = require("../../utils");
const { formatMobileNumber } = require("./formatMobileNumber");

const TWO_FACTOR_BASE_URL = "https://2factor.in/API/V1";

/**
 * Send a custom transactional SMS via 2factor ADD_SMS API.
 * Requires TWO_FACTOR_API_KEY. Optional TWO_FACTOR_SENDER_ID for DLT sender header.
 */
exports.sendTransactionalSms = async (mobile, message) => {
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  if (!apiKey) throwError(500, "TWO_FACTOR_API_KEY is not configured");

  const text = String(message || "").trim();
  if (!text) throwError(422, "SMS message is required");
  if (text.length > 1000) throwError(422, "SMS message is too long (max 1000 chars)");

  const formattedMobile = formatMobileNumber(mobile);
  if (!formattedMobile) throwError(422, "Invalid mobile number");

  const senderId = process.env.TWO_FACTOR_SENDER_ID;
  const encodedMessage = encodeURIComponent(text);
  const url = senderId
    ? `${TWO_FACTOR_BASE_URL}/${apiKey}/ADD_SMS/${formattedMobile}/${senderId}/${encodedMessage}`
    : `${TWO_FACTOR_BASE_URL}/${apiKey}/ADD_SMS/${formattedMobile}/${encodedMessage}`;

  try {
    const response = await axios.get(url, { maxBodyLength: Infinity });
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
    console.error(
      "Error sending transactional SMS:",
      error?.response?.data || error.message,
    );
    throwError(
      500,
      error?.response?.data?.Details || error.message || "Failed to send SMS",
    );
  }
};
