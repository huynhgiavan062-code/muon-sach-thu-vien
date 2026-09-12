import api from './client';

export const userApi = {
  getUsers(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/users${qs ? `?${qs}` : ''}`);
  },

  getUserStats() {
    return api.get('/users/stats');
  },

  getNextReaderCode() {
    return api.get('/users/next-reader-code');
  },

  getUserById(id) {
    return api.get(`/users/${id}`);
  },

  getReaderProfile(id) {
    return api.get(`/users/${id}/reader-profile`);
  },

  createUser(userData) {
    return api.post('/users', userData);
  },

  updateUser(id, userData) {
    return api.put(`/users/${id}`, userData);
  },

  updateUserStatus(id, status) {
    return api.request(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  resetUserPassword(id, newPassword) {
    return api.request(`/users/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword })
    });
  },

  deleteUser(id) {
    return api.delete(`/users/${id}`);
  },

  updateMyProfile(profileData) {
    return api.put('/auth/profile', profileData);
  },

  changeMyPassword(passwordData) {
    return api.put('/auth/change-password', passwordData);
  }
};

export default userApi;
