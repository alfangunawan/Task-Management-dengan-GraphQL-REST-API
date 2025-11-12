const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Load JWT public key for sharing
let publicKey;
try {
  publicKey = fs.readFileSync('/app/keys/jwt-public.key', 'utf8');
  console.log('✅ JWT public key loaded');
} catch (error) {
  try {
    publicKey = fs.readFileSync('./keys/jwt-public.key', 'utf8');
    console.log('✅ JWT public key loaded (local)');
  } catch (err) {
    console.warn('⚠️  JWT public key not found');
  }
}

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'User Service (REST API)',
    timestamp: new Date().toISOString()
  });
});

// Public key endpoint for API Gateway
app.get('/api/public-key', (req, res) => {
  if (!publicKey) {
    return res.status(500).json({ error: 'Public key not available' });
  }
  res.json({ publicKey });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 User Service (REST API) running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Public key: http://localhost:${PORT}/api/public-key`);
});

module.exports = app;