import api from './api';

export const predictiveMaintenanceService = {
  getFleetRisk: async () => {
    const resp = await api.get('/api/maintenance-intelligence/fleet-risk');
    return resp.data;
  },
  getHighRisk: async () => {
    const resp = await api.get('/api/maintenance-intelligence/high-risk');
    return resp.data;
  },
  getEarlyWarnings: async () => {
    const resp = await api.get('/api/maintenance-intelligence/early-warnings');
    return resp.data;
  },
  getPriorities: async () => {
    const resp = await api.get('/api/maintenance-intelligence/priorities');
    return resp.data;
  },
  getPredictiveAlerts: async () => {
    const resp = await api.get('/api/maintenance-intelligence/alerts');
    return resp.data;
  },
  getAssetRiskDetail: async (idOrCode) => {
    const resp = await api.get(`/api/maintenance-intelligence/${idOrCode}`);
    return resp.data;
  },
  runMaintenanceWhatIf: async (equipmentId) => {
    const resp = await api.post('/api/maintenance-intelligence/what-if', {
      equipment_id: equipmentId
    });
    return resp.data;
  }
};

export default predictiveMaintenanceService;
