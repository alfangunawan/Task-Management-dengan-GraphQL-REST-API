const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  getTeams,
  findTeamById,
  addTeam,
  updateTeam,
  addMemberToTeam,
  removeMemberFromTeam,
} = require('../data/teamsStore');

const router = express.Router();

/**
 * GET /api/teams
 * Get all teams
 */
router.get('/', (req, res) => {
  res.json(getTeams());
});

/**
 * GET /api/teams/:id
 * Get team by ID
 */
router.get('/:id', (req, res) => {
  const team = findTeamById(req.params.id);

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
      createdAt: new Date().toISOString(),
    };

    const created = addTeam(newTeam);
    res.status(201).json(created);
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
    const team = findTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const updated = updateTeam(req.params.id, {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
    });

    res.json(updated);
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
    const team = findTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (team.members.includes(userId)) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    const updated = addMemberToTeam(req.params.id, userId);
    res.json(updated);
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
    const team = findTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const updated = removeMemberFromTeam(req.params.id, req.params.userId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
