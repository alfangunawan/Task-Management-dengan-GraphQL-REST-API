const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

let publicKey = null;

// Fetch public key from User Service on startup
async function fetchPublicKey() {
  try {
    const restApiUrl = process.env.REST_API_URL || 'http://rest-api:3001';
    const response = await axios.get(`${restApiUrl}/api/public-key`);
    publicKey = response.data.publicKey;
    console.log('✅ Public key fetched from User Service');
  } catch (error) {
    console.warn('⚠️  Failed to fetch public key:', error.message);
    console.warn('⚠️  JWT verification will not work until User Service is available');
  }
}

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    if (!publicKey) {
      return res.status(500).json({ error: 'JWT verification unavailable' });
    }

    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    req.user = decoded;
    
    // Forward user info to backend services
    req.headers['user'] = JSON.stringify(decoded);
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      message: error.message 
    });
  }
};

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3002', // Frontend
    'http://localhost:3000', // Gateway itself
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    publicKeyLoaded: !!publicKey,
    services: {
      'user-service': process.env.REST_API_URL || 'http://rest-api:3001',
      'task-service': process.env.GRAPHQL_API_URL || 'http://task-service:4000'
    }
  });
});

// Proxy configuration for REST API
const restApiProxy = createProxyMiddleware({
  target: process.env.REST_API_URL || 'http://rest-api:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api',
  },
  onError: (err, req, res) => {
    console.error('User Service Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'User Service unavailable',
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward user info if available
    if (req.headers['user']) {
      proxyReq.setHeader('user', req.headers['user']);
    }
    console.log(`[User Service] ${req.method} ${req.url}`);
  }
});

// Proxy configuration for GraphQL API
const graphqlApiProxy = createProxyMiddleware({
  target: process.env.GRAPHQL_API_URL || 'http://task-service:4000',
  changeOrigin: true,
  ws: true,
  onError: (err, req, res) => {
    console.error('Task Service Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'Task Service unavailable',
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward user info if available
    if (req.headers['user']) {
      proxyReq.setHeader('user', req.headers['user']);
    }
    console.log(`[Task Service] ${req.method} ${req.url}`);
  }
});

// Public routes (no authentication required)
app.use('/api/auth', restApiProxy);
app.use('/api/public-key', restApiProxy);

// Protected routes (authentication required)
app.use('/api', verifyToken, restApiProxy);
app.use('/graphql', verifyToken, graphqlApiProxy);

// Catch-all route
app.get('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: [
      '/health',
      '/api/* (proxied to REST API)',
      '/graphql (proxied to GraphQL API)'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

async function startServer() {
  // Fetch public key on startup
  await fetchPublicKey();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 API Gateway running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔄 Proxying /api/* to: ${process.env.REST_API_URL || 'http://rest-api:3001'}`);
    console.log(`🔄 Proxying /graphql to: ${process.env.GRAPHQL_API_URL || 'http://task-service:4000'}`);
    console.log(`🔐 JWT verification: ${publicKey ? 'ENABLED' : 'DISABLED'}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
}

startServer();

module.exports = app;