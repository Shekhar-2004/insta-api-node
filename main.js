const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 10000; // Render uses port 10000 by default

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);

// URL validation function
const isValidInstagramUrl = (url) => {
    const instagramRegex = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|tv)\/[A-Za-z0-9_-]+/;
    return instagramRegex.test(url);
};

// Health check endpoint with uptime info
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Keep-alive endpoint to prevent cold starts (optional)
app.get('/ping', (req, res) => {
    res.json({ pong: Date.now() });
});

// Main download endpoint - matches your Flutter app's expectation
app.get('/info', async (req, res) => {
    const url = req.query.url;
    
    // Input validation
    if (!url) {
        return res.status(400).json({ 
            error: 'No URL provided',
            code: 'MISSING_URL' 
        });
    }

    if (!isValidInstagramUrl(url)) {
        return res.status(400).json({ 
            error: 'Invalid Instagram URL format',
            code: 'INVALID_URL' 
        });
    }

    try {
        console.log(`Processing request for URL: ${url}`);
        
        // Call the ReelSaver API
        const response = await axios.get(`https://api.reelsaver.app/api/download?url=${encodeURIComponent(url)}`, {
            timeout: 30000, // 30 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        // Transform the response to match your Flutter app's expected format
        const transformedResponse = transformReelSaverResponse(response.data);
        
        res.json(transformedResponse);
        
    } catch (error) {
        console.error('Error fetching Instagram data:', error.message);
        
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ 
                error: 'Request timeout - please try again',
                code: 'TIMEOUT' 
            });
        }
        
        if (error.response) {
            // API returned an error
            return res.status(error.response.status).json({ 
                error: error.response.data?.message || 'Failed to fetch Instagram data',
                code: 'API_ERROR'
            });
        }
        
        // Network or other error
        res.status(500).json({ 
            error: 'Internal server error - please try again',
            code: 'SERVER_ERROR' 
        });
    }
});

// Keep your original /download endpoint for backward compatibility
app.get('/download', async (req, res) => {
    // Redirect to /info endpoint
    req.url = '/info';
    return app._router.handle(req, res);
});

// Transform ReelSaver response to match your Flutter app's expected format
function transformReelSaverResponse(data) {
    try {
        // This function should transform the ReelSaver API response
        // to match what your Flutter app expects
        
        if (!data || !data.data) {
            throw new Error('Invalid response format from ReelSaver API');
        }

        // Example transformation - adjust based on actual ReelSaver response format
        return {
            success: true,
            data: {
                title: data.data.title || 'Instagram Media',
                thumbnail: data.data.thumbnail,
                downloads: data.data.downloads || [],
                duration: data.data.duration,
                author: data.data.author
            }
        };
    } catch (error) {
        console.error('Error transforming response:', error);
        return {
            success: false,
            error: 'Failed to process media information'
        };
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        code: 'UNHANDLED_ERROR' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        code: 'NOT_FOUND' 
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Instagram API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check available at: /health`);
});
