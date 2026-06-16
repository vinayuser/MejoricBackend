# Server Socket.io & Chat API Documentation

## Overview

The MNM Chat Server provides real-time messaging capabilities using Socket.io and a RESTful API for chat operations.

## Server Configuration

**Base URL**: `http://localhost:5000`
**Socket.io Connection**: `http://localhost:5000`

### CORS Configuration

The server accepts connections from:
- `http://localhost:3000` (Main app)
- `http://localhost:3001` (Chat app)
- `http://localhost:5173` (Vite dev server)

## REST API Endpoints

All endpoints are prefixed with `/mateandmentors/chat`

### 1. Get User Conversations

**Endpoint**: `GET /conversations/:userId`

**Description**: Fetch all conversations for a specific user with message history.

**Parameters**:
- `userId` (path): The user's MongoDB ObjectId

**Response**:
```json
{
  "success": true,
  "conversations": [
    {
      "userId": "user_1_id",
      "participantId": "user_2_id",
      "participantName": "John Doe",
      "messages": [
        {
          "_id": "message_id",
          "senderId": "user_1_id",
          "senderName": "Jane Smith",
          "recipientId": "user_2_id",
          "text": "Hello!",
          "timestamp": "2024-01-15T10:30:00Z",
          "isRead": false
        }
      ],
      "lastMessage": "Hello!",
      "lastMessageTime": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:5000/mateandmentors/chat/conversations/507f1f77bcf86cd799439011
```

---

### 2. Get All Users

**Endpoint**: `GET /users`

**Description**: Fetch list of all users (up to 50) to start new conversations.

**Response**:
```json
{
  "success": true,
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:5000/mateandmentors/chat/users
```

---

### 3. Get Conversation Between Two Users

**Endpoint**: `GET /:userId/:participantId`

**Description**: Fetch all messages between two specific users.

**Parameters**:
- `userId` (path): The first user's MongoDB ObjectId
- `participantId` (path): The second user's MongoDB ObjectId

**Response**:
```json
{
  "success": true,
  "messages": [
    {
      "_id": "message_id",
      "senderId": "user_1_id",
      "senderName": "Jane Smith",
      "recipientId": "user_2_id",
      "text": "Hello!",
      "conversationId": "user_1_id_user_2_id",
      "timestamp": "2024-01-15T10:30:00Z",
      "isRead": false
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:5000/mateandmentors/chat/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012
```

---

### 4. Save Message

**Endpoint**: `POST /message`

**Description**: Save a new message to the database.

**Request Body**:
```json
{
  "senderId": "507f1f77bcf86cd799439011",
  "senderName": "Jane Smith",
  "recipientId": "507f1f77bcf86cd799439012",
  "text": "Hello there!",
  "conversationId": "507f1f77bcf86cd799439011_507f1f77bcf86cd799439012",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Message saved",
  "data": {
    "_id": "message_id",
    "senderId": "507f1f77bcf86cd799439011",
    "senderName": "Jane Smith",
    "recipientId": "507f1f77bcf86cd799439012",
    "text": "Hello there!",
    "conversationId": "507f1f77bcf86cd799439011_507f1f77bcf86cd799439012",
    "timestamp": "2024-01-15T10:30:00Z",
    "isRead": false
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:5000/mateandmentors/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "507f1f77bcf86cd799439011",
    "senderName": "Jane Smith",
    "recipientId": "507f1f77bcf86cd799439012",
    "text": "Hello there!",
    "conversationId": "507f1f77bcf86cd799439011_507f1f77bcf86cd799439012"
  }'
```

---

## Socket.io Events

Real-time events for bi-directional communication.

### Client → Server Events

#### 1. `user_online`
**Purpose**: Notify server that user is online

**Data**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "userName": "Jane Smith"
}
```

**Example**:
```javascript
socket.emit('user_online', {
  userId: currentUser._id,
  userName: currentUser.name
});
```

---

#### 2. `send_message`
**Purpose**: Send a message to another user

**Data**:
```json
{
  "senderId": "507f1f77bcf86cd799439011",
  "senderName": "Jane Smith",
  "recipientId": "507f1f77bcf86cd799439012",
  "text": "Hello!",
  "timestamp": "2024-01-15T10:30:00Z",
  "conversationId": "507f1f77bcf86cd799439011_507f1f77bcf86cd799439012"
}
```

**Example**:
```javascript
socket.emit('send_message', {
  senderId: user._id,
  senderName: user.name,
  recipientId: recipient._id,
  text: messageText,
  timestamp: new Date(),
  conversationId: `${user._id}_${recipient._id}`
});
```

---

#### 3. `typing`
**Purpose**: Notify that user is typing

**Data**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "recipientId": "507f1f77bcf86cd799439012"
}
```

**Example**:
```javascript
socket.emit('typing', {
  userId: currentUser._id,
  recipientId: recipient._id
});
```

---

#### 4. `stop_typing`
**Purpose**: Notify that user stopped typing

**Data**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "recipientId": "507f1f77bcf86cd799439012"
}
```

**Example**:
```javascript
socket.emit('stop_typing', {
  userId: currentUser._id,
  recipientId: recipient._id
});
```

---

#### 5. `start_conversation`
**Purpose**: Initiate a new conversation

**Data**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "participantId": "507f1f77bcf86cd799439012"
}
```

**Example**:
```javascript
socket.emit('start_conversation', {
  userId: currentUser._id,
  participantId: newParticipant._id
});
```

---

### Server → Client Events

#### 1. `receive_message`
**Purpose**: Receive a message from another user

**Data**:
```json
{
  "senderId": "507f1f77bcf86cd799439011",
  "senderName": "Jane Smith",
  "recipientId": "507f1f77bcf86cd799439012",
  "text": "Hello!",
  "timestamp": "2024-01-15T10:30:00Z",
  "conversationId": "507f1f77bcf86cd799439011_507f1f77bcf86cd799439012"
}
```

**Example Listener**:
```javascript
socket.on('receive_message', (messageData) => {
  console.log('New message:', messageData);
  // Update UI with new message
});
```

---

#### 2. `user_typing`
**Purpose**: Notify that other user is typing

**Data**:
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

**Example Listener**:
```javascript
socket.on('user_typing', (data) => {
  console.log(`User ${data.userId} is typing...`);
});
```

---

#### 3. `user_stop_typing`
**Purpose**: Notify that other user stopped typing

**Data**:
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

**Example Listener**:
```javascript
socket.on('user_stop_typing', (data) => {
  console.log(`User ${data.userId} stopped typing`);
});
```

---

#### 4. `user_online`
**Purpose**: Notify that a user came online

**Data**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "userName": "Jane Smith"
}
```

**Example Listener**:
```javascript
socket.on('user_online', (data) => {
  console.log(`${data.userName} is now online`);
});
```

---

#### 5. `user_offline`
**Purpose**: Notify that a user went offline

**Data**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "userName": "Jane Smith"
}
```

**Example Listener**:
```javascript
socket.on('user_offline', (data) => {
  console.log(`${data.userName} is now offline`);
});
```

---

#### 6. `message_error`
**Purpose**: Error response for message sending

**Data**:
```json
{
  "error": "Failed to send message"
}
```

**Example Listener**:
```javascript
socket.on('message_error', (data) => {
  console.error('Message error:', data.error);
});
```

---

## Error Handling

### API Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**HTTP Status Codes**:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Server Error

---

## Authentication

**Current Implementation**: User data is passed from the frontend (localStorage).

**Recommended for Production**:
1. Implement JWT token verification
2. Validate user ownership of conversations
3. Add rate limiting to prevent spam

---

## Best Practices

1. **Always validate user IDs** before processing messages
2. **Store messages in database** immediately to prevent data loss
3. **Implement reconnection logic** on the client side
4. **Use proper error handling** in Socket.io event listeners
5. **Clear typing indicator** after sending message or after timeout
6. **Implement message queuing** for offline users (in production)

---

## Database Schema

### Message Model

```javascript
{
  senderId: ObjectId (references User),
  senderName: String,
  recipientId: ObjectId (references User),
  text: String,
  conversationId: String,
  timestamp: Date,
  isRead: Boolean
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Socket.io connection fails | Check CORS settings and ensure server is running |
| Messages not persisting | Verify MongoDB connection |
| Typing indicator stuck | Ensure stop_typing event is emitted |
| Messages not delivering | Check if recipient is online and socket is connected |

---

## Rate Limiting (Future Implementation)

Recommend adding rate limiting:
- Max 100 messages per user per minute
- Max 1000 characters per message
- Max 50 connections per user session

---

## Version

API Version: 1.0.0
Last Updated: April 2024
