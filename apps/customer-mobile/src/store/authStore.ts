/**
 * SafarGo Customer Mobile - Zustand Authentication Store
 * Scalable, production-ready global state management
 */

import { create } from 'zustand';
import { UserProfile, AuthTokens } from '@safargo/shared';

export interface SignupFlowState {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  emailMasked: string;
  verificationToken: string | null;
  avatarUri: string | null;
  avatarUrl: string | null;
  cooldownSeconds: number;
}

interface AuthStoreState {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signupFlow: SignupFlowState;

  // Actions
  setSignupStep1Data: (data: {
    fullName: string;
    email: string;
    phone: string;
    username: string;
    emailMasked: string;
    cooldownSeconds: number;
  }) => void;
  setVerificationToken: (token: string) => void;
  setAvatar: (avatarUri: string, avatarUrl?: string) => void;
  setAuthSuccess: (user: UserProfile, tokens: AuthTokens) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  updateUserAvatar: (avatarUrl: string) => void;
  resetSignupFlow: () => void;
  logout: () => void;
}

const initialSignupState: SignupFlowState = {
  fullName: '',
  email: '',
  phone: '',
  username: '',
  emailMasked: '',
  verificationToken: null,
  avatarUri: null,
  avatarUrl: null,
  cooldownSeconds: 60,
};

function getSavedUser(): UserProfile | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('safargo_user');
      return raw ? JSON.parse(raw) : null;
    }
  } catch {}
  return null;
}

function getSavedTokens(): AuthTokens | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('safargo_token');
      if (token) {
        return { accessToken: token, refreshToken: token, expiresIn: 86400 };
      }
    }
  } catch {}
  return null;
}

const savedUser = getSavedUser();
const savedTokens = getSavedTokens();

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: savedUser,
  tokens: savedTokens,
  isAuthenticated: Boolean(savedUser && savedTokens?.accessToken),
  isLoading: false,
  error: null,
  signupFlow: initialSignupState,

  setSignupStep1Data: (data) =>
    set((state) => ({
      signupFlow: {
        ...state.signupFlow,
        ...data,
      },
    })),

  setVerificationToken: (verificationToken) =>
    set((state) => ({
      signupFlow: {
        ...state.signupFlow,
        verificationToken,
      },
    })),

  setAvatar: (avatarUri, avatarUrl) =>
    set((state) => ({
      signupFlow: {
        ...state.signupFlow,
        avatarUri,
        avatarUrl: avatarUrl || state.signupFlow.avatarUrl,
      },
    })),

  setAuthSuccess: (user, tokens) => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('safargo_user', JSON.stringify(user));
        localStorage.setItem('safargo_token', tokens.accessToken);
      } catch {}
    }
    set({
      user,
      tokens,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      signupFlow: initialSignupState,
    });
  },

  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),

  updateUserAvatar: (avatarUrl) =>
    set((state) => {
      if (!state.user) return state;
      const updatedUser = { ...state.user, avatarUrl };
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('safargo_user', JSON.stringify(updatedUser));
        } catch {}
      }
      return { user: updatedUser };
    }),

  resetSignupFlow: () => set({ signupFlow: initialSignupState }),

  logout: () => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('safargo_user');
        localStorage.removeItem('safargo_token');
      } catch {}
    }
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      signupFlow: initialSignupState,
    });
  },
}));
