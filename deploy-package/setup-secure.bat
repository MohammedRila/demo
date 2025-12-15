@echo off
echo Setting up Secure AI Voice Game Backend...
echo.

REM Create backend directory if it doesn't exist
if not exist "backend" (
    echo Creating backend directory...
    mkdir backend
)

REM Navigate to backend directory
cd backend

REM Copy package.json if it doesn't exist
if not exist "package.json" (
    echo Creating package.json...
    echo { > package.json
    echo   "name": "ai-voice-game-backend", >> package.json
    echo   "version": "1.0.0", >> package.json
    echo   "description": "Backend for AI Voice Game with secure Perplexity API integration", >> package.json
    echo   "main": "server.js", >> package.json
    echo   "scripts": { >> package.json
    echo     "start": "node server.js", >> package.json
    echo     "dev": "nodemon server.js" >> package.json
    echo   }, >> package.json
    echo   "dependencies": { >> package.json
    echo     "express": "^4.18.2", >> package.json
    echo     "cors": "^2.8.5", >> package.json
    echo     "dotenv": "^16.3.1", >> package.json
    echo     "helmet": "^7.0.0" >> package.json
    echo   }, >> package.json
    echo   "devDependencies": { >> package.json
    echo     "nodemon": "^3.0.1" >> package.json
    echo   }, >> package.json
    echo   "keywords": ["ai", "voice", "game", "perplexity"], >> package.json
    echo   "author": "AI Voice Game Developer", >> package.json
    echo   "license": "MIT" >> package.json
    echo } >> package.json
)

REM Install dependencies
echo Installing dependencies...
npm install express cors dotenv helmet nodemon
echo.

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    echo # Perplexity API Configuration > .env
    echo PERPLEXITY_API_KEY=your_perplexity_api_key_here >> .env
    echo PERPLEXITY_MODEL=sonar-pro >> .env
    echo. >> .env
    echo # Server Configuration >> .env
    echo PORT=3000 >> .env
    echo NODE_ENV=development >> .env
    echo.
    echo Please edit the .env file and add your actual Perplexity API key.
    echo.
)

REM Create .env.example if it doesn't exist
if not exist ".env.example" (
    echo Creating .env.example file...
    echo # Perplexity API Configuration > .env.example
    echo PERPLEXITY_API_KEY=your_perplexity_api_key_here >> .env.example
    echo PERPLEXITY_MODEL=sonar-pro >> .env.example
    echo. >> .env.example
    echo # Server Configuration >> .env.example
    echo PORT=3000 >> .env.example
    echo NODE_ENV=development >> .env.example
)

echo Setup complete!
echo.
echo To start the server:
echo   1. Edit backend/.env and add your Perplexity API key
echo   2. Run: cd backend ^&^& npm start
echo.
echo To start the frontend:
echo   1. Open secure-index.html in your browser
echo   2. Enter your application API key (any string will work for local testing)
echo   3. Set backend URL to http://localhost:3000
echo.
pause