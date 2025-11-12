const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const router = express.Router();

// In-memory user storage (simple for demo)
let users = [
  {
    id: '1',
    email: 'admin@taskmanager.com',
    password: '$2a$10$XYZ...', // Will be hashed
    name: 'Admin User',
    role: 'admin',
    teamId: '1'
  },
  {
    id: '2',
    email: 'user@taskmanager.com',
    password: '$2a$10$ABC...',
    name: 'Regular User',
    role: 'user',
    teamId: '1'
  }
];

// Initialize with hashed passwords
(async () => {
  users[0].password = await bcrypt.hash('admin123', 10);
  users[1].password = await bcrypt.hash('user123', 10);
})();

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, teamId } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'Email, password, and name are required' 
      });
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ 
        error: 'User with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
      role: 'user',
      teamId: teamId || '1',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Load private key
    let privateKey;
    try {
      privateKey = fs.readFileSync('/app/keys/jwt-private.key', 'utf8');
    } catch (error) {
      // Fallback for local development
      try {
        privateKey = fs.readFileSync('./keys/jwt-private.key', 'utf8');
      } catch (err) {
        return res.status(500).json({ 
          error: 'JWT key not configured' 
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: user.teamId
      },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '24h'
      }
    );

    // Return token and user info
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user info from token
 */
router.get('/me', (req, res) => {
  // This will be populated by API Gateway after JWT verification
  const userInfo = req.headers.user ? JSON.parse(req.headers.user) : null;
  
  if (!userInfo) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = users.find(u => u.id === userInfo.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// Export users for use in other routes
router.getUsers = () => users;

module.exports = router;
