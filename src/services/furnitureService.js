import axios from 'axios';

const API_URL = '/api/furniture';

export const createFurniture = async (formData, progressCallback) => {
  const response = await axios.post(API_URL, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressCallback) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        progressCallback(percentCompleted);
      }
    }
  });
  return response.data;
};

export const getAllFurniture = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const getFurnitureById = async (id) => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};
