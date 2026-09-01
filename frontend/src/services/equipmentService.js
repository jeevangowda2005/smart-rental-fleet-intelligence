import api from './api';

export const equipmentService = {
  getEquipment: async (params = {}) => {
    const response = await api.get('/api/equipment', { params });
    return response.data;
  },

  getEquipmentById: async (idOrCode) => {
    const response = await api.get(`/api/equipment/${idOrCode}`);
    return response.data;
  },

  getEquipmentDetails: async (idOrCode) => {
    const response = await api.get(`/api/equipment/${idOrCode}/details`);
    return response.data;
  },

  createEquipment: async (data) => {
    const response = await api.post('/api/equipment', data);
    return response.data;
  },

  updateEquipment: async (id, data) => {
    const response = await api.patch(`/api/equipment/${id}`, data);
    return response.data;
  },

  getUsageLogs: async (equipmentId) => {
    const response = await api.get(`/api/logs/equipment/${equipmentId}`);
    return response.data;
  },

  submitUsageLog: async (data) => {
    const response = await api.post('/api/logs', data);
    return response.data;
  }
};
