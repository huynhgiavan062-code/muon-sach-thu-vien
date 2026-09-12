import api from './client';

export const borrowApi = {
  getBorrowRecords(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/borrow${qs ? `?${qs}` : ''}`);
  },

  getBorrowStats() {
    return api.get('/borrow/stats');
  },

  getBorrowRecordById(id) {
    return api.get(`/borrow/${id}`);
  },

  createBorrow(borrowData) {
    return api.post('/borrow', borrowData);
  },

  returnBorrow(id, returnData = {}) {
    return api.post(`/borrow/${id}/return`, returnData);
  },

  renewBorrow(id) {
    return api.post(`/borrow/${id}/renew`);
  },

  getMyActiveBorrows() {
    return api.get('/borrow/my-active');
  },

  getMyBorrowHistory(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/borrow/my-history${qs ? `?${qs}` : ''}`);
  }
};

export default borrowApi;
