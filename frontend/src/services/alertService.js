import api from './api';

export const alertService = {
  getAlerts: async (params = {}) => {
    const response = await api.get('/api/alerts', { params });
    return response.data;
  },

  reportIssue: async (data) => {
    const response = await api.post('/api/alerts/report-issue', data);
    return response.data;
  },

  resolveAlert: async (alertId) => {
    const response = await api.patch(`/api/alerts/${alertId}/resolve`);
    return response.data;
  }
};
