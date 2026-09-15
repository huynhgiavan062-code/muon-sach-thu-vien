import api from './client';

export const bookApi = {
  getBooks(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/books${qs ? `?${qs}` : ''}`);
  },

  getBookById(id) {
    return api.get(`/books/${id}`);
  },

  createBook(bookData) {
    return api.post('/books', bookData);
  },

  updateBook(id, bookData) {
    return api.put(`/books/${id}`, bookData);
  },

  deleteBook(id) {
    return api.delete(`/books/${id}`);
  },

  uploadCover(file) {
    const formData = new FormData();
    formData.append('cover', file);
    return api.upload('/books/upload-cover', formData);
  },

  getMetadata() {
    return api.get('/books/meta/all');
  },

  getStats() {
    return api.get('/books/stats');
  }
};

export default bookApi;
