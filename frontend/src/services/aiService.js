import api from './api';

export const aiService = {
  getDemandForecasts: async () => {
    const resp = await api.get('/api/ai/demand');
    return resp.data;
  },

  getAnomalies: async () => {
    const resp = await api.get('/api/ai/anomalies');
    return resp.data;
  },

  getUnderutilized: async () => {
    const resp = await api.get('/api/ai/underutilized');
    return resp.data;
  },

  getRecommendations: async () => {
    const resp = await api.get('/api/ai/recommendations');
    return resp.data;
  },

  runWhatIf: async (equipmentId, destinationSiteId) => {
    const resp = await api.post('/api/ai/what-if', {
      equipment_id: equipmentId,
      destination_site_id: destinationSiteId,
    });
    return resp.data;
  },

  queryAssistant: async (query) => {
    const resp = await api.post('/api/ai/assistant', { query });
    return resp.data;
  },
};
