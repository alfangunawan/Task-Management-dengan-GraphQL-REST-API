const teams = [
  {
    id: '1',
    name: 'Development Team',
    description: 'Main development team',
    members: ['1', '2'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Marketing Team',
    description: 'Marketing and promotion team',
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const getTeams = () => teams;

const findTeamById = (id) => teams.find((team) => team.id === id);

const addTeam = (team) => {
  const entry = {
    ...team,
    members: Array.isArray(team.members) ? team.members : [],
    createdAt: team.createdAt || new Date().toISOString(),
    updatedAt: team.updatedAt || new Date().toISOString(),
  };
  teams.push(entry);
  return entry;
};

const updateTeam = (id, updates) => {
  const index = teams.findIndex((team) => team.id === id);
  if (index === -1) {
    return null;
  }

  teams[index] = { ...teams[index], ...updates, updatedAt: new Date().toISOString() };
  return teams[index];
};

const removeTeam = (id) => {
  const index = teams.findIndex((team) => team.id === id);
  if (index === -1) {
    return null;
  }

  const [removed] = teams.splice(index, 1);
  return removed;
};

const addMemberToTeam = (teamId, userId) => {
  const team = findTeamById(teamId);
  if (!team) {
    return null;
  }
  if (!team.members.includes(userId)) {
    team.members.push(userId);
    team.updatedAt = new Date().toISOString();
  }
  return team;
};

const removeMemberFromTeam = (teamId, userId) => {
  const team = findTeamById(teamId);
  if (!team) {
    return null;
  }
  team.members = team.members.filter((member) => member !== userId);
  team.updatedAt = new Date().toISOString();
  return team;
};

module.exports = {
  getTeams,
  findTeamById,
  addTeam,
  updateTeam,
  removeTeam,
  addMemberToTeam,
  removeMemberFromTeam,
};
