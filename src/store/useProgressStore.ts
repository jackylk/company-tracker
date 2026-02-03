import { create } from 'zustand';
import type { ProgressState } from '@/types';

interface ProgressStore extends ProgressState {
  show: (message: string, stage?: string) => void;
  update: (progress: number, message?: string) => void;
  addDetail: (detail: string) => void;
  setDetails: (details: string[]) => void;
  hide: () => void;
  toggle: () => void;
}

export const useProgressStore = create<ProgressStore>((set) => ({
  taskId: null,
  stage: '',
  message: '',
  progress: 0,
  details: [],
  isExpanded: false,
  isVisible: false,

  show: (message, stage = '') => {
    set({
      message,
      stage,
      progress: 0,
      details: [],
      isVisible: true,
    });
  },

  update: (progress, message) => {
    set((state) => ({
      progress,
      message: message ?? state.message,
    }));
  },

  addDetail: (detail) => {
    set((state) => ({
      details: [...state.details, detail],
    }));
  },

  setDetails: (details) => {
    set({ details });
  },

  hide: () => {
    set({
      isVisible: false,
      progress: 0,
      message: '',
      details: [],
    });
  },

  toggle: () => {
    set((state) => ({ isExpanded: !state.isExpanded }));
  },
}));
