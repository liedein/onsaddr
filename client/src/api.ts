import axios from 'axios';

// 개발/프로덕션 환경에 따른 API URL
const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:8888/.netlify/functions'  // Netlify Dev 사용 시
  : '/api';  // 프로덕션에서는 리다이렉트 활용

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 환경변수 사용 예시 (공개 키)
export const getPublicApiKey = () => {
  return import.meta.env.VITE_API_KEY;
};

export default api;