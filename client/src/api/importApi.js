import api from './client';

export const importApi = {
  getImports(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/imports${qs ? `?${qs}` : ''}`);
  },

  getImportDetail(id) {
    return api.get(`/imports/${id}`);
  },

  createImport(importData) {
    return api.post('/imports', importData);
  }
};

export default importApi;
