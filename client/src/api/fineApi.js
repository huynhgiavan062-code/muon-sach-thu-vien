import api from './client';

export const fineApi = {
  getFines(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/fines${qs ? `?${qs}` : ''}`);
  },

  getFineStats() {
    return api.get('/fines/stats');
  },

  getMyFines(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/fines/my${qs ? `?${qs}` : ''}`);
  },

  getFineDetail(id) {
    return api.get(`/fines/${id}`);
  },

  createFine(fineData) {
    return api.post('/fines', fineData);
  },

  payFine(id, paymentData = {}) {
    return api.post(`/fines/${id}/pay`, paymentData);
  }
};

export default fineApi;
