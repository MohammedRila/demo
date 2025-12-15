# Deploying AI Voice Game to Render

## Prerequisites
1. A Render account (https://render.com)
2. A Perplexity API key

## Deployment Steps

### 1. Prepare Your Code
1. Ensure all files are in the `deploy-package` directory
2. The `public` folder contains your frontend (`index.html`)
3. The backend code is in `server.js`
4. Environment variables are configured in `render.yaml`

### 2. Deploy to Render
1. Go to https://dashboard.render.com
2. Click "New+" and select "Web Service"
3. Connect your GitHub repository (or upload your code manually)
4. Set the following:
   - Name: `ai-voice-game`
   - Region: Choose the closest region to you
   - Branch: `main` (or your default branch)
   - Root Directory: Leave empty
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

### 3. Configure Environment Variables
In your Render dashboard:
1. Go to your web service
2. Click "Environment" in the sidebar
3. Add the following variables:
   ```
   PERPLEXITY_API_KEY=your_actual_perplexity_api_key_here
   PERPLEXITY_MODEL=sonar-pro
   NODE_ENV=production
   ```

### 4. Deploy
1. Click "Create Web Service"
2. Wait for the build and deployment to complete
3. Your app will be available at `https://your-app-name.onrender.com`

## Updating Your Application
To update your application:
1. Make changes to your code
2. Commit and push to your repository
3. Render will automatically redeploy

## Troubleshooting
- If you see "Application Error", check the logs in Render dashboard
- Ensure your Perplexity API key is correctly set
- Make sure you're using the `sonar-pro` model