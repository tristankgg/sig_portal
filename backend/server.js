require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Octokit } = require('octokit');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// GitHub Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'tristankgg';
const GITHUB_REPO = process.env.GITHUB_REPO || 'sig_portal';
const DATA_FILE = 'data/referrals.json';

// Initialize Octokit with authentication
const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

// Get referrals from GitHub
app.get('/api/referrals', async (req, res) => {
  try {
    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: DATA_FILE
    });

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    const data = JSON.parse(content);

    res.json({
      success: true,
      referrals: data.referrals || [],
      sha: response.data.sha
    });
  } catch (error) {
    console.error('Error fetching referrals:', error.message);
    
    // If file doesn't exist, return empty array
    if (error.status === 404) {
      return res.json({
        success: true,
        referrals: [],
        sha: null
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch referrals from GitHub'
    });
  }
});

// Save referrals to GitHub
app.post('/api/referrals', async (req, res) => {
  try {
    const { referrals } = req.body;

    if (!Array.isArray(referrals)) {
      return res.status(400).json({
        success: false,
        error: 'Referrals must be an array'
      });
    }

    // Get current file to obtain SHA
    let fileSha = null;
    try {
      const getResponse = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: DATA_FILE
      });
      fileSha = getResponse.data.sha;
    } catch (err) {
      // File doesn't exist yet, that's okay
      console.log('File does not exist yet, will create new one');
    }

    const content = JSON.stringify({ referrals }, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    const commitMessage = `Update referrals - ${new Date().toLocaleString()}`;

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: DATA_FILE,
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
      error: 'Failed to save referrals to GitHub'
    });
  }
});

// Delete a referral
app.delete('/api/referrals/:id', async (req, res) => {
  try {
    const referralId = parseInt(req.params.id);

    // Get current referrals
    const getResponse = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: DATA_FILE
    });

    const content = Buffer.from(getResponse.data.content, 'base64').toString('utf-8');
    let data = JSON.parse(content);

    // Filter out the deleted referral
    data.referrals = data.referrals.filter(ref => ref.id !== referralId);

    const encodedContent = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: DATA_FILE,
      message: `Delete referral ${referralId}`,
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
