import api from './client';

export const settingApi = {
  getSettings() {
    return api.get('/settings');
  },

  updateSettings(settingsData) {
    return api.put('/settings', settingsData);
  }
};

export default settingApi;
