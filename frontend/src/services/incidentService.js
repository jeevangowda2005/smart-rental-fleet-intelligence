import api from './api';

export const incidentService = {
  getIncidents: async (params = {}) => {
    const resp = await api.get('/api/incidents', { params });
    return resp.data;
  },
  getSummary: async () => {
    const resp = await api.get('/api/incidents/summary');
    return resp.data;
  },
  getIncident: async (id) => {
    const resp = await api.get(`/api/incidents/${id}`);
    return resp.data;
  },
  getAuditTrail: async (id) => {
    const resp = await api.get(`/api/incidents/${id}/audit`);
    return resp.data;
  },
  getNotifications: async () => {
    const resp = await api.get('/api/incidents/notifications');
    return resp.data;
  },
  acknowledge: async (id) => {
    const resp = await api.post(`/api/incidents/${id}/acknowledge`);
    return resp.data;
  },
  approveAction: async (incidentId, actionId) => {
    const resp = await api.post(`/api/incidents/${incidentId}/approve`, { action_id: actionId });
    return resp.data;
  },
  rejectAction: async (incidentId, actionId, reason) => {
    const resp = await api.post(`/api/incidents/${incidentId}/reject`, { action_id: actionId, reason });
    return resp.data;
  },
  startAction: async (id) => {
    const resp = await api.post(`/api/incidents/${id}/start-action`);
    return resp.data;
  },
  resolve: async (id, note = '') => {
    const resp = await api.post(`/api/incidents/${id}/resolve`, { resolution_note: note });
    return resp.data;
  },
  dismiss: async (id) => {
    const resp = await api.post(`/api/incidents/${id}/dismiss`);
    return resp.data;
  }
};

export default incidentService;
