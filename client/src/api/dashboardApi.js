import api from './client';

export const dashboardApi = {
  getAdminDashboard() {
    return api.get('/dashboard/admin');
  },

  getUserDashboard() {
    return api.get('/dashboard/user');
  },

  getStatistics() {
    return api.get('/dashboard/statistics');
  },

  getReports(type = 'overdue') {
    return api.get(`/dashboard/reports?type=${encodeURIComponent(type)}`);
  }
};

export default dashboardApi;
