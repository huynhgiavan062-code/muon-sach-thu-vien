import api from './client';

export const reservationApi = {
  getReservations(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/reservations${qs ? `?${qs}` : ''}`);
  },

  getReservationStats() {
    return api.get('/reservations/stats');
  },

  getMyReservations(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/reservations/my${qs ? `?${qs}` : ''}`);
  },

  getReservationById(id) {
    return api.get(`/reservations/${id}`);
  },

  createReservation(data) {
    return api.post('/reservations', data);
  },

  cancelReservation(id) {
    return api.delete(`/reservations/${id}`);
  },

  fulfillReservation(id) {
    return api.post(`/reservations/${id}/fulfill`);
  }
};

export default reservationApi;
