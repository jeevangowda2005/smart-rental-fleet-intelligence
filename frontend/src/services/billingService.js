import api from './api';

export const billingService = {
  getBillings: async () => {
    const response = await api.get('/api/billing');
    return response.data;
  },

  getBillingById: async (billingId) => {
    const response = await api.get(`/api/billing/${billingId}`);
    return response.data;
  },

  getBillingByRental: async (rentalId) => {
    const response = await api.get(`/api/billing/rental/${rentalId}`);
    return response.data;
  },

  generateBilling: async (rentalId) => {
    const response = await api.post(`/api/billing/generate/${rentalId}`);
    return response.data;
  }
};
