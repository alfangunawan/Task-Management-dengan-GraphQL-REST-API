const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory team storage
let teams = [
  {
    id: '1',
    name: 'Development Team',
    description: 'Main development team',
    members: ['1', '2'],
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Marketing Team',
    description: 'Marketing and promotion team',
    members: [],
    createdAt: new Date().toISOString()
  }
];

/**
 * GET /api/teams
 * Get all teams
 */
router.get('/', (req, res) => {
  res.json(teams);
});

/**
 * GET /api/teams/:id
 * Get team by ID
 */
router.get('/:id', (req, res) => {
  const team = teams.find(t => t.id === req.params.id);
  
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  res.json(team);
});

/**
 * POST /api/teams
 * Create new team
 */
router.post('/', (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const newTeam = {
      id: uuidv4(),
      name,
      description: description || '',
      members: [],
      createdAt: new Date().toISOString()
    };

    teams.push(newTeam);
    res.status(201).json(newTeam);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/teams/:id
 * Update team
 */
router.put('/:id', (req, res, next) => {
  try {
    const { name, description } = req.body;
    const teamIndex = teams.findIndex(t => t.id === req.params.id);

    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found' });
    }

    teams[teamIndex] = {
      ...teams[teamIndex],
      name: name || teams[teamIndex].name,
      description: description !== undefined ? description : teams[teamIndex].description,
      updatedAt: new Date().toISOString()
    };

    res.json(teams[teamIndex]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teams/:id/members
 * Add member to team
 */
router.post('/:id/members', (req, res, next) => {
  try {
    const { userId } = req.body;
    const team = teams.find(t => t.id === req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (team.members.includes(userId)) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    team.members.push(userId);
    res.json(team);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/teams/:id/members/:userId
 * Remove member from team
 */
router.delete('/:id/members/:userId', (req, res, next) => {
  try {
    const team = teams.find(t => t.id === req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    team.members = team.members.filter(m => m !== req.params.userId);
    res.json(team);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
