"use client";
import { create } from "zustand";
import secureLocalStorage from "react-secure-storage";


export const useGlobal = create((set, get) => ({
    user: {
        accessToken: secureLocalStorage.getItem("accessToken") || null,
        refreshToken: secureLocalStorage.getItem("refreshToken") || null,
    },

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
