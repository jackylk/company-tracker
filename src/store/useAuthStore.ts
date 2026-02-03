import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,

      setAuth: (user, token) => {
        set({ user, token, isLoading: false });
        // 设置Cookie以便服务端组件使用
        document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}`;
      },

      clearAuth: () => {
        set({ user: null, token: null, isLoading: false });
        // 清除Cookie
        document.cookie = 'token=; path=/; max-age=0';
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
