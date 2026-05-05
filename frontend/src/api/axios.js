import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  timeout: 90000,
  headers: { "Content-Type": "application/json" },
});

/* ✅ Attach JWT token to every request */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("palm_token");

    console.log("TOKEN SENT:", token);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* Global error handler */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data   = error?.response?.data;
    const status = error?.response?.status;
    const text   = error?.message;

    console.error("API ERROR:", {
      status,
      data,
      message: text,
      url: error?.config?.url,
    });

    if (status === 401) {
      console.warn("Unauthorized! Token may be invalid or expired.");
    }

    return Promise.reject(error);
  }
);

export default api;