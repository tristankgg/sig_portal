# Backend Setup Guide

This backend service handles secure GitHub authentication for the Signature Appliances Portal.

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- GitHub Personal Access Token

## Installation Steps

### 1. Create GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" (classic)
3. Name it: `sig_portal_token`
4. Select scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (optional, for advanced features)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again)

### 2. Clone and Setup Backend

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Create .env file from template
cp .env.example .env

# Edit .env and add your GitHub token
# Replace: GITHUB_TOKEN=your_github_personal_access_token_here
# With your actual token
nano .env  # or use your preferred editor
```

### 3. Test the Backend

```bash
# Start the development server
npm start

# You should see:
# Backend server running on port 3001
# GitHub Owner: tristankgg
# GitHub Repo: sig_portal
```

### 4. Verify it's working

Open your browser and visit:
```
http://localhost:3001/health
```

You should see: `{"status":"Backend is running"}`

## API Endpoints

### GET /api/referrals
Fetch all referrals from GitHub repository

**Response:**
```json
{
  "success": true,
  "referrals": [...],
  "sha": "file_sha_hash"
}
```

### POST /api/referrals
Save referrals to GitHub repository

**Request Body:**
```json
{
  "referrals": [...]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Referrals saved successfully",
  "sha": "new_file_sha_hash"
}
```

### DELETE /api/referrals/:id
Delete a specific referral by ID

**Response:**
```json
{
  "success": true,
  "message": "Referral deleted successfully"
}
```

## Deployment Options

### Option 1: Heroku (Recommended for beginners)

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create new Heroku app
heroku create sig-portal-backend

# Set environment variables
heroku config:set GITHUB_TOKEN=your_token_here
heroku config:set GITHUB_OWNER=tristankgg
heroku config:set GITHUB_REPO=sig_portal

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Option 2: Railway.app

1. Go to https://railway.app
2. Create new project
3. Connect your GitHub repository
4. Set environment variables in dashboard
5. Deploy automatically

### Option 3: Render.com

1. Go to https://render.com
2. Create new Web Service
3. Connect GitHub repository
4. Add environment variables
5. Deploy

### Option 4: AWS, Google Cloud, Azure
Similar process with their respective dashboards.

## Connecting Frontend to Backend

Update the frontend to use your backend URL instead of direct GitHub API:

In `index.html`, replace the API calls:

```javascript
// Old (direct GitHub API)
const apiUrl = `https://api.github.com/repos/...`;

// New (use backend)
const apiUrl = `https://your-backend-url.com/api/referrals`;
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | Personal Access Token from GitHub | `ghp_xxxxxxxxxxxx` |
| `GITHUB_OWNER` | GitHub username | `tristankgg` |
| `GITHUB_REPO` | Repository name | `sig_portal` |
| `PORT` | Server port (default: 3001) | `3001` |
| `NODE_ENV` | Environment | `development` or `production` |

## Troubleshooting

**Error: "Failed to fetch referrals from GitHub"**
- Check if `GITHUB_TOKEN` is valid
- Verify token has `repo` scope
- Check if repository exists and is accessible

**Error: "GITHUB_TOKEN is not defined"**
- Create `.env` file in backend directory
- Add your GitHub token to `.env`
- Restart the server

**Port already in use**
- Change `PORT` in `.env`
- Or kill the process using port 3001: `lsof -i :3001` (Mac/Linux) or `netstat -ano | findstr :3001` (Windows)

## Security Notes

- Never commit `.env` file to repository
- Keep your GitHub token secret
- Use environment variables in production
- Add `.env` to `.gitignore` (already done)

## Support

For issues or questions, check:
- GitHub API documentation: https://docs.github.com/en/rest
- Express.js documentation: https://expressjs.com
- Octokit documentation: https://octokit.github.io
