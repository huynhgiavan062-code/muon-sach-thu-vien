import api from './client';

export const notificationApi = {
  getNotifications(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/notifications${qs ? `?${qs}` : ''}`);
  },

  getUnreadCount() {
    return api.get('/notifications/unread-count');
  },

  markAsRead(id) {
    return api.patch(`/notifications/${id}/read`);
  },

  markAllAsRead() {
    return api.patch('/notifications/read-all');
  },

  deleteNotification(id) {
    return api.delete(`/notifications/${id}`);
  }
};

export default notificationApi;
