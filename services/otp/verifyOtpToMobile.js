require("dotenv").config();
const axios = require("axios");
const { throwError } = require("../../utils");

const TWO_FACTOR_BASE_URL = "https://2factor.in/API/V1";

exports.verifyOtpToMobile = async (sessionId, otp) => {
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  if (!apiKey) throwError(500, "TWO_FACTOR_API_KEY is not configured");
  if (!sessionId || !otp) throwError(422, "Session ID and OTP are required");

  try {
    const response = await axios.get(
      `${TWO_FACTOR_BASE_URL}/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`,
      { maxBodyLength: Infinity },
    );
    return response.data;
  } catch (error) {
    console.error("Error verifying OTP:", error?.response?.data || error.message);
    throwError(500, error?.response?.data?.Details || error.message || "Failed to verify OTP");
  }
};
