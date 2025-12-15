require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
// Use Render's PORT environment variable, or default to 3000
const PORT = process.env.PORT || 3000;

// Log the port we're using
console.log(`Server configured to use port: ${PORT}`);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('- Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('- Body:', req.body);
  }
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Log environment variables for debugging (remove in production)
console.log('PERPLEXITY_API_KEY from env:', process.env.PERPLEXITY_API_KEY ? 'Loaded' : 'Not found');
console.log('PERPLEXITY_MODEL from env:', process.env.PERPLEXITY_MODEL || 'Defaulting to sonar-pro');

// Simple in-memory storage for game sessions (in production, use a database)
const gameSessions = new Map();

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

// Create a new game session
app.post('/api/game/session', (req, res) => {
  console.log('=== GAME SESSION CREATION REQUEST ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request body:', req.body);
  
  const { player1Name, player2Name, gameType } = req.body;
  
  console.log('Extracted values:');
  console.log('- player1Name:', player1Name);
  console.log('- player2Name:', player2Name);
  console.log('- gameType:', gameType);
  
  if (!player1Name || !player2Name || !gameType) {
    console.log('VALIDATION FAILED: Missing required fields');
    console.log('Missing fields check:');
    console.log('- player1Name exists:', !!player1Name);
    console.log('- player2Name exists:', !!player2Name);
    console.log('- gameType exists:', !!gameType);
    
    return res.status(400).json({ 
      error: 'Missing required fields', 
      details: {
        player1Name: !!player1Name,
        player2Name: !!player2Name,
        gameType: !!gameType
      }
    });
  }
  
  console.log('Validation passed, creating session');
  
  const sessionId = generateSessionId();
  const session = {
    id: sessionId,
    player1Name,
    player2Name,
    gameType,
    createdAt: new Date(),
    gameHistory: [],
    playerStats: {
      1: { turns: 0, words: 0, violations: 0 },
      2: { turns: 0, words: 0, violations: 0 }
    },
    bannedPlayers: []
  };
  
  gameSessions.set(sessionId, session);
  
  console.log('Session created successfully:');
  console.log('- Session ID:', sessionId);
  console.log('- Session data:', JSON.stringify(session, null, 2));
  
  res.json({
    sessionId,
    message: 'Game session created successfully'
  });
  
  console.log('Response sent to client');
});

// Submit a player turn
app.post('/api/game/:sessionId/turn', async (req, res) => {
  const { sessionId } = req.params;
  const { player, content } = req.body;
  
  if (!player || !content) {
    return res.status(400).json({ error: 'Missing required fields: player, content' });
  }
  
  const session = gameSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Game session not found' });
  }
  
  // Check if player is banned
  if (session.bannedPlayers.includes(player)) {
    return res.status(403).json({ error: `Player ${player} is banned from this game` });
  }
  
  // Add to game history
  const entry = {
    player,
    playerName: player === 1 ? session.player1Name : session.player2Name,
    content,
    timestamp: new Date()
  };
  
  session.gameHistory.push(entry);
  
  // Update player stats
  const wordCount = content.split(' ').length;
  session.playerStats[player].turns++;
  session.playerStats[player].words += wordCount;
  
  try {
    // Get AI evaluation
    const aiResponse = await callPerplexityAI(content, session, entry);
    
    // Check for explicit violations in the content itself (not in AI response)
    const lowercaseContent = content.toLowerCase();
    const explicitWords = ['fuck', 'shit', 'damn', 'hell', 'bitch', 'asshole', 'crap'];
    const hasExplicitContent = explicitWords.some(word => lowercaseContent.includes(word));
    
    // If explicit content found, prepend a clear warning
    let finalResponse = aiResponse;
    if (hasExplicitContent) {
      const violationCount = session.playerStats[player].violations + 1;
      const warningMessage = `[⚠️ WARNING: Inappropriate language detected - Violation ${violationCount} of 3]\n\n`;
      finalResponse = warningMessage + aiResponse;
      
      // Increment violation counter
      session.playerStats[player].violations++;
      
      // Ban after 3 violations
      if (session.playerStats[player].violations >= 3) {
        session.bannedPlayers.push(player);
      }
    }
    
    res.json({
      success: true,
      aiResponse: finalResponse,
      playerStats: session.playerStats,
      bannedPlayers: session.bannedPlayers,
      isBanned: session.bannedPlayers.includes(player)
    });
    
  } catch (error) {
    console.error('AI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI response',
      details: error.message 
    });
  }
});

// Get session status
app.get('/api/game/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  
  const session = gameSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Game session not found' });
  }
  
  res.json({
    sessionId: session.id,
    player1Name: session.player1Name,
    player2Name: session.player2Name,
    gameType: session.gameType,
    createdAt: session.createdAt,
    playerStats: session.playerStats,
    bannedPlayers: session.bannedPlayers,
    turnCount: session.gameHistory.length,
    gameHistory: session.gameHistory.slice(-10) // Last 10 entries
  });
});

// Moderator mode - analyze entire conversation
app.post('/api/game/:sessionId/moderate', async (req, res) => {
  const { sessionId } = req.params;
  
  const session = gameSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Game session not found' });
  }
  
  try {
    // Build conversation log with explicit content checking
    let flaggedInstances = [];
    const conversationLog = session.gameHistory.map((h, index) => {
      // Check each entry for explicit content
      const lowercaseContent = h.content.toLowerCase();
      const explicitWords = ['fuck', 'shit', 'damn', 'hell', 'bitch', 'asshole', 'crap'];
      const hasExplicitContent = explicitWords.some(word => lowercaseContent.includes(word));
      
      if (hasExplicitContent) {
        flaggedInstances.push({
          player: h.player,
          playerName: h.playerName,
          content: h.content,
          timestamp: h.timestamp
        });
      }
      
      return `${h.playerName} (Player ${h.player}): ${h.content}`;
    }).join('\n');
    
    const prompt = `You are an advanced behavioral analyst and conversation moderator for a collaborative storytelling game.
    
Review this conversation for inappropriate content and collaboration quality:

${conversationLog}

Provide a structured analysis:

OVERALL COLLABORATION RATING: [Excellent/Good/Fair/Poor]

VIOLATIONS DETECTED:
${flaggedInstances.length > 0 ? 
  flaggedInstances.map((instance, i) => 
    `${i+1}. Player ${instance.playerName}: "${instance.content}" - Explicit language violation`
  ).join('\n') : 
  'None found'}

BEHAVIORAL ANALYSIS:
- Individual player engagement and creativity
- Respectful communication patterns
- Narrative building collaboration
- Any concerning behavioral patterns

RECOMMENDATIONS:
- Specific suggestions for improved collaboration
- Guidance on appropriate content and language
- Tips for better creative storytelling`;

    const aiResponse = await callPerplexityAI(prompt, session, null, 2048);
    
    res.json({
      success: true,
      aiResponse,
      playerStats: session.playerStats,
      bannedPlayers: session.bannedPlayers
    });
    
  } catch (error) {
    console.error('AI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI moderation report',
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
    // Game mode prompt - focused on creative feedback
    finalPrompt = `You are an expert AI game master and creative writing coach for collaborative storytelling games.
    
Current game theme: ${session.gameType}

Player ${entry.playerName} just contributed: "${entry.content}"

Provide concise, encouraging feedback focusing on:
1. STAR RATING: Creativity and originality (1-5 stars ⭐)
2. What worked well in their contribution
3. ONE specific suggestion for improvement
4. How to build on the story effectively

Keep response under 3 sentences. Format: 
"[⭐⭐⭐⭐⭐] Great continuation! [Positive feedback]. [Improvement suggestion]. Keep building the narrative!"

Example responses:
"[⭐⭐⭐⭐] Nice world-building detail! Your description of the ancient temple adds atmosphere. Try developing the characters' emotions in response to discoveries. Continue the adventure!"
"[⭐⭐⭐] Good plot twist! The unexpected alliance creates intrigue. Add more sensory details to immerse readers. What happens next?"`;
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Voice Game Backend listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;