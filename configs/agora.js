const agoraConfig = {
  APP_ID: process.env.AGORA_APP_ID || "",
  APP_CERTIFICATE: process.env.AGORA_APP_CERTIFICATE || "",
  TOKEN_TTL_SECONDS: parseInt(process.env.AGORA_TOKEN_TTL_SECONDS, 10) || 3600,
};

module.exports = { agoraConfig };
