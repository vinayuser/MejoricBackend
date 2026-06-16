const Message = require("./models/Message");
const ChatSession = require("./models/ChatSession");
const mongoose = require("mongoose");

const backfillChatSessions = async () => {
  try {
    const sessionCount = await ChatSession.countDocuments();
    if (sessionCount > 0) {
      console.log("[Backfill] Sessions already exist. Skipping backfill.");
      return;
    }

    console.log("[Backfill] Starting chat session backfill...");
    const conversations = await Message.aggregate([
      {
        $group: {
          _id: "$conversationId",
          senderId: { $first: "$senderId" },
          recipientId: { $first: "$recipientId" },
          startTime: { $min: "$timestamp" },
          endTime: { $max: "$timestamp" },
          messageCount: { $sum: 1 },
        },
      },
    ]);

    for (const conv of conversations) {
      await ChatSession.create({
        senderId: conv.senderId,
        recipientId: conv.recipientId,
        startTime: conv.startTime,
        endTime: conv.endTime,
        messageCount: conv.messageCount,
        status: "ENDED",
        conversationId: conv._id,
      });
    }

    console.log(
      `[Backfill] Successfully created ${conversations.length} chat sessions.`,
    );
  } catch (error) {
    console.error("[Backfill] Error during backfill:", error);
  }
};

module.exports = backfillChatSessions;
