const { asyncWrapper, sendSuccess, throwError } = require("../../utils");
const User = require("../../models/User");
const { admin, isFirebaseInitialized } = require("../../configs/firebase");

/**
 * Update FCM token for the authenticated user.
 * Also subscribes the token to the 'mate_status' topic so all
 * clients receive real-time mate online/offline status updates.
 */
exports.updateFcmToken = asyncWrapper(async (req, res) => {
  const { fcmToken } = req.body;
  const userId = req.userId;

  if (!fcmToken) {
    throwError(422, "FCM token is required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { fcmToken },
    { returnDocument: 'after', runValidators: true }
  );

  if (!updatedUser) {
    throwError(404, "User not found");
  }

  // Subscribe this token to the mate_status topic for real-time availability updates
  if (isFirebaseInitialized && fcmToken) {
    try {
      await admin.messaging().subscribeToTopic([fcmToken], "mate_status");
      console.log(`✅ Subscribed token to mate_status topic for user ${userId}`);
    } catch (err) {
      // Non-critical — don't fail the request if topic subscription fails
      console.warn("⚠️ Failed to subscribe to mate_status topic:", err.message);
    }
  }

  return sendSuccess(res, 200, "FCM token updated successfully", {
    fcmToken: updatedUser.fcmToken,
  });
});
