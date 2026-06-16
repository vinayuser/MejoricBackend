const activeSessions = new Map(); // conversationId -> { timeLeft, timer, participants }
const disconnectTimeouts = new Map(); // conversationId -> timeout

module.exports = {
  activeSessions,
  disconnectTimeouts,
};
