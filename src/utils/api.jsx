import axios from "axios";
import { useEffect, useMemo, useRef } from "react";
import { useGlobal } from "./global";

let isRefreshing = false;
let failedQueue = [];
const API_HOST = "https://api.geekcon.uz";
const CRM_PREFIX = "/api/v1/crm";

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

const useApi = () => {
  const { user, auth, logout } = useGlobal();

  const tokensRef = useRef({
    accessToken: user.accessToken || null,
    refreshToken: user.refreshToken || null,
  });
  const authRef = useRef(auth);
  const logoutRef = useRef(logout);

  useEffect(() => {
    tokensRef.current = {
      accessToken: user.accessToken || null,
      refreshToken: user.refreshToken || null,
    };
  }, [user.accessToken, user.refreshToken]);

  useEffect(() => {
    authRef.current = auth;
    logoutRef.current = logout;
  }, [auth, logout]);

  const axiosInstance = useMemo(
    () =>
      axios.create({
        baseURL: API_HOST,
      }),
    []
  );

  useEffect(() => {
    const requestInterceptorId = axiosInstance.interceptors.request.use((config) => {
      const token = tokensRef.current.accessToken;
      if (!config.headers) {
        config.headers = {};
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }

      return config;
    });

    const responseInterceptorId = axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config || {};
        const isUnauthorized = error.response?.status === 401;
        const refreshToken = tokensRef.current.refreshToken;
        const hasRefreshToken = Boolean(refreshToken);

        if (isUnauthorized && hasRefreshToken) {
          if (!isRefreshing) {
            isRefreshing = true;
            try {
              const response = await axios.post(`${API_HOST}${CRM_PREFIX}/refresh/`, {
                refresh_token: refreshToken,
                refresh: refreshToken,
              });
              const nextAccessToken =
                response.data?.access_token ||
                response.data?.access ||
                response.data?.token;
              const nextRefreshToken =
                response.data?.refresh_token ||
                response.data?.refresh ||
                refreshToken;

              if (!nextAccessToken) {
                throw new Error("Access token missing in refresh response");
              }

              authRef.current({
                accessToken: nextAccessToken,
                refreshToken: nextRefreshToken,
              });

              processQueue(null, nextAccessToken);

              if (!originalRequest.headers) {
                originalRequest.headers = {};
              }
              originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
              originalRequest.baseURL = API_HOST;
              return axios(originalRequest);
            } catch (e) {
              processQueue(e, null);
              logoutRef.current();
              return Promise.reject(e);
            } finally {
              isRefreshing = false;
            }
          }

          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (!originalRequest.headers) {
                originalRequest.headers = {};
              }
              originalRequest.headers.Authorization = `Bearer ${token}`;
              originalRequest.baseURL = API_HOST;
              return axios(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        if (isUnauthorized && !hasRefreshToken) {
          logoutRef.current();
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptorId);
      axiosInstance.interceptors.response.eject(responseInterceptorId);
    };
  }, [axiosInstance]);

  return axiosInstance;
};

export default useApi;
