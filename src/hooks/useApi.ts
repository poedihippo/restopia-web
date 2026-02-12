import environment from "@/config/environment";
import { cookies } from "@/lib/cookies";
import axios from "axios";
import qs from "qs";

const api = axios.create({
  baseURL: environment.API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  paramsSerializer: (params) => qs.stringify(params, { encode: false }),
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = cookies.get("token");
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // If the data is FormData, remove Content-Type header
    // so axios can set it automatically with the boundary
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      const isBrowser = typeof window !== "undefined";
      if (isBrowser) {
        cookies.remove("token");

        const here = window.location.pathname + window.location.search;
        const onLogin = window.location.pathname === "/";

        const url = new URL("/", window.location.origin);
        if (!onLogin) url.searchParams.set("redirect", here);

        window.location.replace(url.toString());
      }
    }

    return Promise.reject(error);
  },
);
export const authApi = axios.create({
  baseURL: environment.API_URL,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});
export const useAxios = () => api;
export default api;
