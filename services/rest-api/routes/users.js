const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { validateUser, validateUserUpdate } = require('../middleware/validation');
const {
  getUsers,
  findUserById,
  findUserByEmail,
  addUser,
  updateUser,
  removeUser,
} = require('../data/usersStore');
const {
  addMemberToTeam,
  removeMemberFromTeam,
} = require('../data/teamsStore');

const router = express.Router();

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }
  const { password, ...rest } = user;
  return rest;
};

// GET /api/users - Get all users
router.get('/', (req, res) => {
  const { page, limit, role, search } = req.query;
  
  let filteredUsers = [...getUsers()];
  
  // Filter by role
  if (role) {
    filteredUsers = filteredUsers.filter(user => user.role === role);
  }
  
  // Search by name or email
  if (search) {
    filteredUsers = filteredUsers.filter(user => 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // If pagination params provided, return paginated response
  if (page && limit) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    return res.json({
      users: paginatedUsers.map(sanitizeUser),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredUsers.length / limit),
        totalUsers: filteredUsers.length,
        hasNext: endIndex < filteredUsers.length,
        hasPrev: startIndex > 0
      }
    });
  }
  
  // Otherwise return all users as simple array
  res.json(filteredUsers.map(sanitizeUser));
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = findUserById(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  res.json(sanitizeUser(user));
});

// POST /api/users - Create new user
router.post('/', validateUser, async (req, res) => {
  const { name, email, age, role = 'user' } = req.body;

  // Check if email already exists
  const existingUser = findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      error: 'Email already exists',
      message: 'A user with this email already exists'
    });
  }
 
  const teamId = req.body.teamId || null;
  const rawPassword = req.body.password || 'password123';
  const password = await bcrypt.hash(rawPassword, 10);

  const newUser = {
    id: uuidv4(),
    name,
    email,
    age,
    role,
    teamId,
    password,
  };

  addUser(newUser);
  if (teamId) {
    addMemberToTeam(teamId, newUser.id);
  }

  const savedUser = findUserById(newUser.id);

  res.status(201).json({
    message: 'User created successfully',
    user: sanitizeUser(savedUser)
  });
});

// PUT /api/users/:id - Update user
router.put('/:id', validateUserUpdate, (req, res) => {
  const { name, email, age, role, teamId } = req.body;

  const user = findUserById(req.params.id);

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }

  // Check if email already exists (excluding current user)
  if (email) {
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      if (existingUser.id !== req.params.id) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email already exists'
      });
      }
    }
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (age !== undefined) updates.age = age;
  if (role !== undefined) updates.role = role;
  if (teamId !== undefined) updates.teamId = teamId;

  const updatedUser = updateUser(req.params.id, updates);

  if (teamId !== undefined) {
    if (user.teamId) {
      removeMemberFromTeam(user.teamId, user.id);
    }
    if (teamId) {
      addMemberToTeam(teamId, user.id);
    }
  }

  res.json({
    message: 'User updated successfully',
    user: sanitizeUser(updatedUser)
  });
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', (req, res) => {
  const user = findUserById(req.params.id);

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }

  if (user.teamId) {
    removeMemberFromTeam(user.teamId, user.id);
  }
  const deletedUser = removeUser(user.id);

  res.json({
    message: 'User deleted successfully',
    user: sanitizeUser(deletedUser)
  });
});

module.exports = router;