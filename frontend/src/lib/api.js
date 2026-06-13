import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("imora_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const LOGO_URL = "https://customer-assets.emergentagent.com/job_0d3a448a-6931-4cac-bbb2-34a1ea7d48ef/artifacts/48f72vfn_1781186527624%20%281%29.jpg";
