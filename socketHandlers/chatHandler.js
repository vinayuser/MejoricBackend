const Message = require('../models/Message');

// Map to store online users
const onlineUsers = new Map();

const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('🔗 New user connected:', socket.id);

    // User comes online
    socket.on('user_online', (data) => {
      onlineUsers.set(data.userId, {
        socketId: socket.id,
        userName: data.userName,
      });

      console.log(`✅ User online: ${data.userName} (${data.userId})`);
      io.emit('user_online', {
        userId: data.userId,
        userName: data.userName,
      });
    });

    // Handle incoming messages
    socket.on('send_message', async (messageData) => {
      try {
        console.log('📨 Message from', messageData.senderId, 'to', messageData.recipientId);

        // Save message to database
        const message = new Message({
          senderId: messageData.senderId,
          senderName: messageData.senderName,
          recipientId: messageData.recipientId,
          text: messageData.text,
          conversationId: messageData.conversationId,
          timestamp: messageData.timestamp || Date.now(),
        });

        await message.save();

        // Send message to recipient
        const recipient = onlineUsers.get(messageData.recipientId.toString());
        if (recipient) {
          io.to(recipient.socketId).emit('receive_message', {
            senderId: messageData.senderId,
            senderName: messageData.senderName,
            recipientId: messageData.recipientId,
            text: messageData.text,
            timestamp: messageData.timestamp,
            conversationId: messageData.conversationId,
          });
          console.log('✅ Message delivered to', messageData.recipientId);
        } else {
          console.log('⚠️ Recipient offline:', messageData.recipientId);
        }
      } catch (error) {
        console.error('❌ Error handling message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const recipient = onlineUsers.get(data.recipientId.toString());
      if (recipient) {
        io.to(recipient.socketId).emit('user_typing', {
          userId: data.userId,
        });
      }
    });

    // Handle stop typing
    socket.on('stop_typing', (data) => {
      const recipient = onlineUsers.get(data.recipientId.toString());
      if (recipient) {
        io.to(recipient.socketId).emit('user_stop_typing', {
          userId: data.userId,
        });
      }
    });

    // Handle conversation start
    socket.on('start_conversation', (data) => {
      console.log(`🚀 Conversation started between ${data.userId} and ${data.participantId}`);
      // Additional logic can be added here if needed
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      let disconnectedUser = null;
      for (const [userId, userData] of onlineUsers.entries()) {
        if (userData.socketId === socket.id) {
          disconnectedUser = { userId, userData };
          onlineUsers.delete(userId);
          break;
        }
      }

      if (disconnectedUser) {
        console.log(`❌ User offline: ${disconnectedUser.userData.userName} (${disconnectedUser.userId})`);
        io.emit('user_offline', {
          userId: disconnectedUser.userId,
          userName: disconnectedUser.userData.userName,
        });
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
};

module.exports = { initializeSocket, onlineUsers };
