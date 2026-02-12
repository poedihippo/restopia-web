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

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
}

function forceLogout() {
  cookies.remove("token", { path: "/" });
  cookies.remove("refresh_token", { path: "/" });
  cookies.remove("session_start", { path: "/" });

  const here = window.location.pathname + window.location.search;
  const onLogin = window.location.pathname === "/";

  const url = new URL("/", window.location.origin);
  if (!onLogin) url.searchParams.set("redirect", here);

  window.location.replace(url.toString());
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const isBrowser = typeof window !== "undefined";

    if (status === 401 && isBrowser && !originalRequest._retry) {
      const sessionStart = cookies.get("session_start");
      const SESSION_MAX_MS = 60 * 60 * 1000; // 1 hour
      if (sessionStart && Date.now() - Number(sessionStart) >= SESSION_MAX_MS) {
        forceLogout();
        return Promise.reject(error);
      }

      const refreshToken = cookies.get("refresh_token");
      if (!refreshToken) {
        forceLogout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await authApi.post("auth/token/refresh", {
          refresh_token: refreshToken,
        });

        const newToken = res.data.data?.access_token ?? res.data.access_token;
        cookies.set("token", newToken, {
          expires: 1,
          path: "/",
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });

        const newRefresh =
          res.data.data?.refresh_token ?? res.data.refresh_token;
        if (newRefresh) {
          cookies.set("refresh_token", newRefresh, {
            expires: 7,
            path: "/",
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          });
        }

        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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
