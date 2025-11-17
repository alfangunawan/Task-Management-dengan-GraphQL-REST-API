const bcrypt = require('bcryptjs');

const users = [
  {
    id: '1',
    email: 'admin@taskmanager.com',
    password: bcrypt.hashSync('admin123', 10),
    name: 'Admin User',
    role: 'admin',
    teamId: '1',
    age: 32,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'user@taskmanager.com',
    password: bcrypt.hashSync('user123', 10),
    name: 'Regular User',
    role: 'user',
    teamId: '1',
    age: 26,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const getUsers = () => users;

const findUserByEmail = (email) => users.find((user) => user.email === email);

const findUserById = (id) => users.find((user) => user.id === id);

const addUser = (user) => {
  users.push({ ...user, createdAt: user.createdAt || new Date().toISOString(), updatedAt: user.updatedAt || new Date().toISOString() });
  return user;
};

const updateUser = (id, updates) => {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) {
    return null;
  }

  users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
  return users[index];
};

const removeUser = (id) => {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) {
    return null;
  }

  const [removed] = users.splice(index, 1);
  return removed;
};

module.exports = {
  getUsers,
  findUserByEmail,
  findUserById,
  addUser,
  updateUser,
  removeUser,
};
