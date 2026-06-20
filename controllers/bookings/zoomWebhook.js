const {
  verifyZoomWebhookSignature,
  handleZoomUrlValidation,
} = require("../../helpers/zoom");
const { handleZoomWebhookEvent } = require("../../services/bookings");

exports.zoomWebhook = async (req, res) => {
  try {
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ success: false, message: "Invalid webhook body" });
    }

    if (!verifyZoomWebhookSignature(req, rawBody)) {
      return res.status(401).json({ success: false, message: "Invalid webhook signature" });
    }

    const payload = JSON.parse(rawBody.toString());

    if (payload.event === "endpoint.url_validation") {
      const validation = handleZoomUrlValidation(payload.payload);
      return res.status(200).json(validation);
    }

    await handleZoomWebhookEvent(payload.event, payload.payload);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Zoom webhook error:", error);
    return res.status(200).json({ success: true });
  }
};
