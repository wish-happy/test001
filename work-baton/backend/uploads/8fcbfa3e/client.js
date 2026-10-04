import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://congenial-space-engine-jjxv5gxx75vr3g95-8000.app.github.dev';
const api = axios.create({ baseURL: API_BASE });

export async function uploadFiles(files) {
  const formData = new FormData();
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    formData.append('files', file, path);
  }
  return (await api.post('/api/baton/upload', formData)).data;
}

export async function parseFiles(sessionId) {
  return (await api.post(`/api/baton/parse/${sessionId}`)).data;
}

export async function classifyFiles(sessionId, preset = 'groq', apiKey = '') {
  const fd = new FormData();
  fd.append('model_preset', preset);
  if (apiKey) fd.append('custom_api_key', apiKey);
  return (await api.post(`/api/baton/classify/${sessionId}`, fd)).data;
}

export async function generateInterview(sessionId) {
  return (await api.post(`/api/baton/interview/${sessionId}`)).data;
}

export async function submitAnswers(sessionId, answers) {
  return (await api.post(`/api/baton/interview/${sessionId}/answer`, answers)).data;
}

export async function extractCalendar(sessionId) {
  return (await api.post(`/api/baton/calendar/${sessionId}`)).data;
}

export async function generateHandover(sessionId) {
  return (await api.post(`/api/baton/handover/${sessionId}`)).data;
}

export async function chat(sessionId, question) {
  return (await api.post(`/api/baton/chat/${sessionId}`, { question })).data;
}
