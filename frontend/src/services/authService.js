import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    if (response.data.access_token) {
      localStorage.setItem('cat_fleet_token', response.data.access_token);
      localStorage.setItem('cat_fleet_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    localStorage.setItem('cat_fleet_user', JSON.stringify(response.data));
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('cat_fleet_token');
    localStorage.removeItem('cat_fleet_user');
  },

  getStoredUser: () => {
    const userStr = localStorage.getItem('cat_fleet_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
};
