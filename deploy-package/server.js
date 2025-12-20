require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
// Use Render's PORT environment variable, or default to 3001
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Log the port we're using
console.log(`Server configured to use port: ${PORT}`);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Log environment variables for debugging (remove in production)
console.log('PERPLEXITY_API_KEY from env:', process.env.PERPLEXITY_API_KEY ? 'Loaded' : 'Not found');
console.log('PERPLEXITY_MODEL from env:', process.env.PERPLEXITY_MODEL || 'Defaulting to sonar-pro');

// Simple in-memory storage for game sessions
const gameSessions = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  // Assign a unique ID to each connection
  const connectionId = generateSessionId();
  ws.connectionId = connectionId;
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connection-established',
    connectionId: connectionId
  }));
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('WebSocket message received:', data.type);
      
      // Handle specific message types
      switch (data.type) {
        case 'offer':
          console.log('Received WebRTC offer');
          // Broadcast offer to other clients in the same room
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN && client.roomId === ws.roomId) {
              client.send(JSON.stringify({
                type: 'offer',
                offer: data.offer,
                roomId: data.roomId
              }));
            }
          });
          break;
        case 'answer':
          console.log('Received WebRTC answer');
          // Broadcast answer to other clients in the same room
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN && client.roomId === ws.roomId) {
              client.send(JSON.stringify({
                type: 'answer',
                answer: data.answer,
                roomId: data.roomId
              }));
            }
          });
          break;
        case 'ice-candidate':
          console.log('Received ICE candidate');
          // Broadcast ICE candidate to other clients in the same room
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN && client.roomId === ws.roomId) {
              client.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: data.candidate,
                roomId: data.roomId
              }));
            }
          });
          break;
        case 'join-room':
          console.log('Client joining room:', data.roomId);
          ws.roomId = data.roomId;
          break;
        default:
          // For other message types, broadcast to all other clients in the same room
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN && client.roomId === ws.roomId) {
              client.send(message);
            }
          });
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  // Handle connection close
  ws.on('close', () => {
    console.log('WebSocket connection closed:', connectionId);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error for connection', connectionId, ':', error);
  });
});

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('- Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('- Body:', req.body);
  }
  next();
});

// Validate API key middleware (optional for local development)
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  // For local development, we don't require API key
  req.apiKey = apiKey || 'local-dev-key';
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== WEBRTC ROOM ENDPOINTS ====================

// Create a new WebRTC room
app.post('/api/webrtc/room', (req, res) => {
  console.log('=== CREATE ROOM REQUEST ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request body:', req.body);
  
  const { participant1Name, participant2Name } = req.body;
  
  console.log('Extracted values:');
  console.log('- participant1Name:', participant1Name);
  console.log('- participant2Name:', participant2Name);
  
  if (!participant1Name || !participant2Name) {
    console.log('VALIDATION FAILED: Missing required fields');
    return res.status(400).json({ 
      error: 'Missing required fields: participant1Name, participant2Name'
    });
  }
  
  // Handle same usernames
  let displayName1 = participant1Name;
  let displayName2 = participant2Name;
  
  if (participant1Name.toLowerCase() === participant2Name.toLowerCase()) {
    displayName1 = `${participant1Name} (Host)`;
    displayName2 = `${participant2Name} (Guest)`;
    console.log('Same names detected, using display names:', displayName1, displayName2);
  }
  
  console.log('Validation passed, creating room');
  
  const roomId = generateSessionId();
  const room = {
    id: roomId,
    participant1Name: displayName1,
    participant2Name: displayName2,
    createdAt: new Date(),
    conversationHistory: [],
    bannedParticipants: [],
    hostJoined: false,
    guestJoined: false
  };
  
  gameSessions.set(roomId, room);
  
  console.log('Room created successfully:');
  console.log('- Room ID:', roomId);
  
  res.json({
    roomId,
    message: 'WebRTC room created successfully',
    participantLabels: {
      host: `${displayName1} (Host)`,
      guest: `${displayName2} (Guest)`
    }
  });
  
  console.log('Response sent to client');
});

// Add endpoint to create a room and get a shareable link
app.post('/api/webrtc/room/create-link', (req, res) => {
  console.log('=== CREATE ROOM LINK REQUEST ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request body:', req.body);
  
  const { participant1Name } = req.body;
  // Remove participant2Name requirement - guest will provide when joining
  
  console.log('Extracted values:');
  console.log('- participant1Name:', participant1Name);
  // No participant2Name logging since it's not required
  
  if (!participant1Name) {
    console.log('VALIDATION FAILED: Missing required field');
    return res.status(400).json({ 
      error: 'Missing required field: participant1Name'
    });
  }
  
  // No need to handle same usernames here since guest name is provided later
  
  console.log('Validation passed, creating room');
  
  const roomId = generateSessionId(); // Reuse existing function
  const room = {
    id: roomId,
    participant1Name: participant1Name, // Host name
    participant2Name: null, // Will be set when guest joins
    createdAt: new Date(),
    conversationHistory: [],
    bannedParticipants: [],
    hostJoined: false,
    guestJoined: false
  };
  
  gameSessions.set(roomId, room); // Reuse existing storage
  
  console.log('Room created successfully:');
  console.log('- Room ID:', roomId);
  
  // Generate shareable link
  const roomLink = `${req.protocol}://${req.get('host')}/webrtc-room/${roomId}`;
  
  res.json({
    roomId,
    roomLink,
    message: 'WebRTC room created successfully'
  });
  
  console.log('Response sent to client');
});

// Add endpoint to get room info by ID
app.get('/api/webrtc/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  const room = gameSessions.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    roomId: room.id,
    participant1Name: room.participant1Name,
    participant2Name: room.participant2Name,
    createdAt: room.createdAt,
    hostJoined: room.hostJoined,
    guestJoined: room.guestJoined
  });
});

// Modified existing room endpoint to handle joining
app.post('/api/webrtc/room/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { participantRole, participantName } = req.body; // 'host' or 'guest'
  
  const room = gameSessions.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Handle participant name assignment
  if (participantRole === 'host') {
    // Host should match the name used when creating the room
    if (participantName !== room.participant1Name) {
      console.log('Host name mismatch:', participantName, '!=', room.participant1Name);
      // We'll allow it but log the difference
    }
    room.hostJoined = true;
  } else if (participantRole === 'guest') {
    // Assign guest name and handle same name scenario
    let displayName = participantName;
    
    // Check if guest name matches host name
    if (participantName.toLowerCase() === room.participant1Name.toLowerCase()) {
      room.participant1Name = `${room.participant1Name} (Host)`;
      displayName = `${participantName} (Guest)`;
      console.log('Same names detected, using display names:', room.participant1Name, displayName);
    }
    
    room.participant2Name = displayName;
    room.guestJoined = true;
  }
  
  res.json({
    success: true,
    message: `${participantRole} joined successfully`,
    roomId: room.id,
    participantLabels: {
      host: room.participant1Name,
      guest: room.participant2Name
    }
  });
});

app.post('/api/webrtc/:roomId/moderate', async (req, res) => {
  const { roomId } = req.params;
  const { speaker, content } = req.body;
  
  if (!speaker || !content) {
    return res.status(400).json({ error: 'Missing required fields: speaker, content' });
  }
  
  const room = gameSessions.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Add to conversation history
  const entry = {
    speaker,
    content,
    timestamp: new Date()
  };
  
  room.conversationHistory.push(entry);
  
  try {
    // Create a prompt for the AI moderator
    const conversationLog = room.conversationHistory.map(h => 
      `${h.speaker}: ${h.content}`
    ).join('\n');
    
    const prompt = `You are an AI conversation moderator monitoring a real-time voice chat between two participants.
    
Current conversation:
${conversationLog}

Speaker: ${speaker}
Just said: "${content}"

Your role is to:
1. Monitor for inappropriate content (profanity, harassment, etc.)
2. Provide brief, helpful feedback to keep conversation positive
3. Alert participants to any issues without being disruptive
4. Keep responses concise and conversational

Respond with a brief, natural-sounding moderation message or encouragement. 
If everything is fine, you can acknowledge the contribution positively.
If there's an issue, address it politely but firmly.`;

    // Get AI response
    const aiResponse = await callPerplexityAI(prompt, room, entry, 512);
    
    // Check for explicit content
    const lowercaseContent = content.toLowerCase();
    const explicitWords = ['fuck', 'shit', 'damn', 'hell', 'bitch', 'asshole', 'crap'];
    const hasExplicitContent = explicitWords.some(word => lowercaseContent.includes(word));
    
    let finalResponse = aiResponse;
    if (hasExplicitContent) {
      finalResponse = `[⚠️ Reminder: Please keep conversation respectful] ${aiResponse}`;
    }
    
    res.json({
      success: true,
      aiResponse: finalResponse
    });
    
  } catch (error) {
    console.error('AI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI moderation',
      details: error.message 
    });
  }
});

// Helper function to call Perplexity API
async function callPerplexityAI(prompt, session, entry = null, maxTokens = 1024) {
  const apiUrl = 'https://api.perplexity.ai/chat/completions';
  
  // Determine if this is game mode or moderator mode
  const isGameMode = entry !== null;
  
  // Customize prompt based on mode
  let finalPrompt = prompt;
  if (isGameMode) {
    // Game mode prompt - focused on creative feedback and participation
    finalPrompt = `You are an engaging AI conversation partner and creative storytelling facilitator. 
    You're participating in a collaborative storytelling session between two human players.
    
Current game theme: ${session.gameType}

Player ${entry.playerName} just contributed: "${entry.content}"

Your role is to:
1. Actively participate in the conversation as a third participant
2. Provide brief, encouraging feedback on their contribution (1-2 sentences)
3. Ask a follow-up question or suggest a direction to keep the story moving
4. Keep responses conversational and engaging (under 3 sentences)

Example responses:
"That's an interesting twist with the mysterious portal! What do you think lies beyond it?"
"I love how you developed the character's motivation. How will they overcome this challenge?"
"Great scene-setting with the stormy weather! How does that affect the characters' plans?"

Remember: You're a participant in the conversation, not just an observer. Engage naturally!`;
  } else {
    // Moderator mode prompt - focused on behavioral analysis
    finalPrompt = `You are an advanced behavioral analyst and conversation moderator for a collaborative storytelling game.
    
Review this conversation for:
1. Profanity or offensive language
2. Personal attacks or harassment  
3. Threats or aggressive behavior
4. Hate speech or discriminatory content
5. Spam or repetitive meaningless content
6. Disruptive behavior or trolling
7. Inappropriate sexual content
8. Violent or graphic descriptions

For violations found:
- Quote exact problematic content
- Explain why it's inappropriate
- Assign severity (LOW/MEDIUM/HIGH)
- Suggest appropriate alternatives

Format response as:
OVERALL RATING: [Excellent/Good/Fair/Poor]
VIOLATIONS FOUND: [List with severity ratings]
RECOMMENDATIONS: [Constructive guidance for better collaboration]

Be direct but constructive. Focus on behavior correction, not punishment.`;
  }
  
  const requestBody = {
    model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
    messages: [
      { role: 'user', content: finalPrompt }
    ],
    max_tokens: maxTokens
  };
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response from AI';
    
  } catch (error) {
    console.error('Perplexity API call failed:', error);
    throw error;
  }
}

// Generate a simple session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler - serve frontend for any unmatched routes
app.use((req, res) => {
  // Serve the WebRTC room as the main application
  if (req.path === '/' || req.path === '/index.html') {
    res.sendFile(path.join(__dirname, 'public', 'webrtc-room.html'));
  } else if (req.path === '/webrtc-room') {
    res.sendFile(path.join(__dirname, 'public', 'webrtc-room.html'));
  } else if (req.path === '/webrtc-room-link') {
    // Serve the room link page
    res.sendFile(path.join(__dirname, 'public', 'webrtc-room-link.html'));
  } else if (req.path.startsWith('/webrtc-room/') && req.path.length > 12) {
    // Serve the room link page for room links
    res.sendFile(path.join(__dirname, 'public', 'webrtc-room-link.html'));
  } else {
    // Serve the WebRTC room for other routes as default
    res.sendFile(path.join(__dirname, 'public', 'webrtc-room.html'));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Voice Game Backend with WebSocket listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket server ready`);
});

module.exports = app;