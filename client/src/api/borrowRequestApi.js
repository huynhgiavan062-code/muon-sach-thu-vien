import api from './client';

export const borrowRequestApi = {
  getBorrowRequests(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/borrow-requests${qs ? `?${qs}` : ''}`);
  },

  getBorrowRequestStats() {
    return api.get('/borrow-requests/stats');
  },

  getBorrowRequestById(id) {
    return api.get(`/borrow-requests/${id}`);
  },

  createBorrowRequest(data) {
    return api.post('/borrow-requests', data);
  },

  approveBorrowRequest(id) {
    return api.post(`/borrow-requests/${id}/approve`);
  },

  rejectBorrowRequest(id, rejection_reason) {
    return api.post(`/borrow-requests/${id}/reject`, { rejection_reason });
  },

  cancelBorrowRequest(id) {
    return api.post(`/borrow-requests/${id}/cancel`);
  }
};

export default borrowRequestApi;
