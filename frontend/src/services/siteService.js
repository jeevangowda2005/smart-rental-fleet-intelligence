import api from './api';

export const siteService = {
  getSites: async () => {
    const response = await api.get('/api/sites');
    return response.data;
  },

  createSite: async (data) => {
    const response = await api.post('/api/sites', data);
    return response.data;
  }
};
