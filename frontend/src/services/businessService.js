import api from './api';

export const businessService = {
  getExecutiveSummary: async () => {
    const resp = await api.get('/api/business/executive-summary');
    return resp.data;
  },
  getAssetCosts: async () => {
    const resp = await api.get('/api/business/costs');
    return resp.data;
  },
  getIdleImpact: async () => {
    const resp = await api.get('/api/business/idle-impact');
    return resp.data;
  },
  getFuelEfficiency: async () => {
    const resp = await api.get('/api/business/fuel-efficiency');
    return resp.data;
  },
  getMaintenanceRisk: async () => {
    const resp = await api.get('/api/business/maintenance-risk');
    return resp.data;
  },
  getOptimizationOpportunities: async () => {
    const resp = await api.get('/api/business/optimization-opportunities');
    return resp.data;
  },
  runBusinessWhatIf: async (equipmentId, destinationSiteId) => {
    const resp = await api.post('/api/business/what-if-impact', {
      equipment_id: equipmentId,
      destination_site_id: destinationSiteId
    });
    return resp.data;
  },
  getConfigAssumptions: async () => {
    const resp = await api.get('/api/business/config-assumptions');
    return resp.data;
  }
};

export default businessService;
