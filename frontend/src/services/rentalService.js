import api from './api';

export const rentalService = {
  getRentals: async (params = {}) => {
    const response = await api.get('/api/rentals', { params });
    return response.data;
  },

  getMyActiveRental: async () => {
    const response = await api.get('/api/rentals/my-active');
    return response.data;
  },

  checkout: async (data) => {
    const response = await api.post('/api/rentals/checkout', data);
    return response.data;
  },

  checkin: async (rentalId, notes = '') => {
    const response = await api.post(`/api/rentals/${rentalId}/checkin`, { rental_id: rentalId, notes });
    return response.data;
  }
};
