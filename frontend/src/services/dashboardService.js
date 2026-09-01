import api from './api';

export const dashboardService = {
  getStats: async () => {
    const response = await api.get('/api/dashboard/stats');
    return response.data;
  },

  getCharts: async () => {
    const response = await api.get('/api/dashboard/charts');
    return response.data;
  }
};
