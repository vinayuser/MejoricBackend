require("dotenv").config();
const axios = require("axios");
const { throwError } = require("../../utils");
const { formatMobileNumber } = require("./formatMobileNumber");

const TWO_FACTOR_BASE_URL = "https://2factor.in/API/V1";

exports.sendOtpToMobile = async (mobile) => {
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  if (!apiKey) throwError(500, "TWO_FACTOR_API_KEY is not configured");

  const formattedMobile = formatMobileNumber(mobile);
  if (!formattedMobile) throwError(422, "Invalid mobile number");

  try {
    const response = await axios.get(
      `${TWO_FACTOR_BASE_URL}/${apiKey}/SMS/${formattedMobile}/AUTOGEN`,
      { maxBodyLength: Infinity },
    );
    const data = response?.data;
    if (data?.Status !== "Success") {
      throwError(502, data?.Details || "Failed to send OTP to mobile");
    }
    console.log(`OTP sent to ${formattedMobile}`);
    return data;
  } catch (error) {
    if (error.statusCode) throw error;
    console.error("Error sending OTP to mobile:", error?.response?.data || error.message);
    throwError(500, error?.response?.data?.Details || error.message || "Failed to send OTP to mobile");
  }
};
