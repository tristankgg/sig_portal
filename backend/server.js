require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Octokit } = require('octokit');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// GitHub Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'tristankgg';
const GITHUB_REPO = process.env.GITHUB_REPO || 'sig_portal';
const USERS_FILE = 'data/users.json';
const REFERRALS_FILE = 'data/referrals.json';

// Initialize Octokit with authentication
const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

// Encryption helper functions
const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.padEnd(32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey.padEnd(32)), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

// ==================== USER AUTHENTICATION ====================

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Fetch users from GitHub
    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: USERS_FILE
    });

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    const data = JSON.parse(content);

    // Find user by email
    const user = data.users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password (simple comparison for now)
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Return user session token (simplified - just base64 of user ID)
    const sessionToken = Buffer.from(user.id).toString('base64');

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile
      },
      sessionToken: sessionToken
    });
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Get user profile
app.get('/api/auth/profile/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: USERS_FILE
    });

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    const data = JSON.parse(content);

    const user = data.users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      profile: user.profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// Update user profile
app.post('/api/auth/profile/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const profileData = req.body;

    // Get current users file
    const getResponse = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: USERS_FILE
    });

    const content = Buffer.from(getResponse.data.content, 'base64').toString('utf-8');
    const data = JSON.parse(content);

    // Find and update user
    const userIndex = data.users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    data.users[userIndex].profile = profileData;

    // Save updated users file
    const encodedContent = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: USERS_FILE,
      message: `Update profile for user ${userId}`,
      content: encodedContent,
      sha: getResponse.data.sha
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: data.users[userIndex].profile
    });
  } catch (error) {
    console.error('Error updating profile:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// ==================== REFERRALS MANAGEMENT ====================

// Get referrals for a user
app.get('/api/referrals/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: REFERRALS_FILE
    });

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    const data = JSON.parse(content);

    // Filter referrals by user ID
    const userReferrals = (data.referrals || []).filter(ref => ref.userId === userId);

    res.json({
      success: true,
      referrals: userReferrals,
      sha: response.data.sha
    });
  } catch (error) {
    console.error('Error fetching referrals:', error.message);

    if (error.status === 404) {
      return res.json({
        success: true,
        referrals: [],
        sha: null
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch referrals'
    });
  }
});

// Save referrals for a user
app.post('/api/referrals/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { referrals } = req.body;

    if (!Array.isArray(referrals)) {
      return res.status(400).json({
        success: false,
        error: 'Referrals must be an array'
      });
    }

    // Add userId to all referrals
    const referralsWithUserId = referrals.map(ref => ({
      ...ref,
      userId: userId
    }));

    // Get current referrals file
    let fileSha = null;
    let allReferrals = [];

    try {
      const getResponse = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: REFERRALS_FILE
      });
      fileSha = getResponse.data.sha;
      const content = Buffer.from(getResponse.data.content, 'base64').toString('utf-8');
      const data = JSON.parse(content);
      
      // Keep referrals from other users
      allReferrals = (data.referrals || []).filter(ref => ref.userId !== userId);
    } catch (err) {
      // File doesn't exist yet
      console.log('Referrals file does not exist yet');
    }

    // Combine with new referrals
    allReferrals = [...allReferrals, ...referralsWithUserId];

    const fileContent = JSON.stringify({ referrals: allReferrals }, null, 2);
    const encodedContent = Buffer.from(fileContent).toString('base64');

    const commitMessage = `Update referrals for user ${userId} - ${new Date().toLocaleString()}`;

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: REFERRALS_FILE,
      message: commitMessage,
      content: encodedContent,
      ...(fileSha && { sha: fileSha })
    });

    res.json({
      success: true,
      message: 'Referrals saved successfully',
      sha: response.data.content.sha
    });
  } catch (error) {
    console.error('Error saving referrals:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to save referrals'
    });
  }
});

// Delete a referral
app.delete('/api/referrals/:userId/:referralId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const referralId = parseInt(req.params.referralId);

    // Get current referrals
    const getResponse = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: REFERRALS_FILE
    });

    const content = Buffer.from(getResponse.data.content, 'base64').toString('utf-8');
    let data = JSON.parse(content);

    // Filter out the deleted referral for this user only
    data.referrals = data.referrals.filter(ref => 
      !(ref.id === referralId && ref.userId === userId)
    );

    const encodedContent = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: REFERRALS_FILE,
      message: `Delete referral ${referralId} for user ${userId}`,
      content: encodedContent,
      sha: getResponse.data.sha
    });

    res.json({
      success: true,
      message: 'Referral deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting referral:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete referral'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`GitHub Owner: ${GITHUB_OWNER}`);
  console.log(`GitHub Repo: ${GITHUB_REPO}`);
});
