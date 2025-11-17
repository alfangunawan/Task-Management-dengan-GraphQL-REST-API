import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }
};

if (typeof window !== 'undefined') {
  const token = localStorage.getItem('token');
  if (token) {
    setAuthToken(token);
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),
  register: (payload: { name: string; email: string; password: string; role?: string; teamId?: string }) =>
    apiClient.post('/api/auth/register', payload),
  getMe: () => apiClient.get('/api/auth/me'),
};

export const userApi = {
  getUsers: () => apiClient.get('/api/users'),
  getUser: (id: string) => apiClient.get(`/api/users/${id}`),
  createUser: (payload: { name: string; email: string; age: number; role?: string }) =>
    apiClient.post('/api/users', payload),
  updateUser: (id: string, payload: { name?: string; email?: string; age?: number; role?: string }) =>
    apiClient.put(`/api/users/${id}`, payload),
  deleteUser: (id: string) => apiClient.delete(`/api/users/${id}`),
};

export const teamApi = {
  getTeams: () => apiClient.get('/api/teams'),
  getTeam: (id: string) => apiClient.get(`/api/teams/${id}`),
  createTeam: (payload: { name: string; description?: string }) =>
    apiClient.post('/api/teams', payload),
  updateTeam: (id: string, payload: { name?: string; description?: string }) =>
    apiClient.put(`/api/teams/${id}`, payload),
  deleteTeam: (id: string) => apiClient.delete(`/api/teams/${id}`),
  addMember: (teamId: string, userId: string) =>
    apiClient.post(`/api/teams/${teamId}/members`, { userId }),
  removeMember: (teamId: string, userId: string) =>
    apiClient.delete(`/api/teams/${teamId}/members/${userId}`),
};