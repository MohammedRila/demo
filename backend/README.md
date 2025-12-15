# Secure AI Voice Game Backend

This backend securely handles all Perplexity API calls, keeping your API key safe on the server side.

## Features

- 🔐 **Secure API Key Storage**: Perplexity API key is stored only on the server
- 🛡️ **CORS Protection**: Controlled access to API endpoints
- 📊 **Game Session Management**: In-memory session storage
- 🚫 **Content Moderation**: Automatic detection and handling of inappropriate content
- ⚡ **Real-time Processing**: Fast API responses for smooth gameplay

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Edit the `.env` file and add your Perplexity API key:

```env
# Perplexity API Configuration
PERPLEXITY_API_KEY=your_actual_perplexity_api_key_here
PERPLEXITY_MODEL=sonar-pro

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /health
```

### Create Game Session
```
POST /api/game/session
Body:
  {
    "player1Name": "Alice",
    "player2Name": "Bob",
    "gameType": "fantasy"
  }
```

### Submit Player Turn
```
POST /api/game/:sessionId/turn
Body:
  {
    "player": 1,
    "content": "Player's spoken content"
  }
```

### Get Session Status
```
GET /api/game/:sessionId/status
```

### Moderator Analysis
```
POST /api/game/:sessionId/moderate
```

## Security Features

1. **Server-Side API Key**: Your Perplexity API key never leaves the server
2. **No Client Authentication Required**: For local development, no API keys needed
3. **Input Validation**: All inputs are validated and sanitized
4. **Rate Limiting**: Built-in protection against abuse
5. **CORS Restrictions**: Controlled cross-origin access

## Deployment

For production deployment, consider:

1. Using a proper database instead of in-memory storage
2. Implementing proper authentication and authorization
3. Adding rate limiting and DDoS protection
4. Using environment-specific configuration files
5. Setting up SSL/TLS for encrypted connections

## Frontend Integration

The secure frontend (`simple-secure-index.html`) in the parent directory connects to this backend. Make sure to:

1. Set the correct backend URL in the frontend
2. Ensure the backend is running before using the frontend

For local development, no API keys are required between frontend and backend.

## Troubleshooting

### Common Issues

1. **API Key Errors**: Verify your Perplexity API key in `.env`
2. **Connection Refused**: Ensure the backend server is running
3. **CORS Errors**: Check that the frontend URL is allowed in CORS configuration
4. **Session Not Found**: Make sure you're using the correct session ID

### Logs

Check the console output for detailed error messages and debugging information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.