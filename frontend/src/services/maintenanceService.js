import api from './api';

export const maintenanceService = {
  getMaintenance: async () => {
    const response = await api.get('/api/maintenance');
    return response.data;
  },

  scheduleMaintenance: async (data) => {
    const response = await api.post('/api/maintenance', data);
    return response.data;
  },

  updateMaintenanceStatus: async (maintId, data) => {
    const response = await api.patch(`/api/maintenance/${maintId}`, data);
    return response.data;
  }
};
