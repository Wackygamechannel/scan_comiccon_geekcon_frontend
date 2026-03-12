// Tokens.jsx
"use client";
import { create } from "zustand";
import secureLocalStorage from "react-secure-storage";

// Создаем хранилище с использованием zustand
export const useGlobal = create((set, get) => ({
  user: {
    accessToken: secureLocalStorage.getItem("accessToken") || null,
    refreshToken: secureLocalStorage.getItem("refreshToken") || null,
  },

  // Функция для аутентификации и сохранения токенов
  auth: (tokens) => {
    secureLocalStorage.setItem("accessToken", tokens.accessToken);
    secureLocalStorage.setItem("refreshToken", tokens.refreshToken);
    set((state) => ({
      user: {
        ...state.user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    }));
  },

  // Функция для выхода (удаление токенов)
  logout: () => {
    secureLocalStorage.removeItem("accessToken");
    secureLocalStorage.removeItem("refreshToken");
    set((state) => ({
      user: {
        ...state.user,
        accessToken: null,
        refreshToken: null,
      },
    }));
  },
}));

// Функция для получения accessToken из глобального состояния
export const getAccessToken = () => {
  const { user } = useGlobal.getState(); // Получаем текущее состояние из zustand
  return user.accessToken; // Возвращаем accessToken
};