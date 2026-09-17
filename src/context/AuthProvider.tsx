import React, { useState, ReactNode } from 'react';
import { AuthContext, User } from './AuthContext';
import { authApi } from '../services/api';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const token = localStorage.getItem('accessToken');
    const storedEmail = localStorage.getItem('userEmail');
    if (token && storedEmail) {
      return { id: 'fake-id', email: storedEmail };
    }
    return null;
  });

  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await authApi.signIn({ email, password });

      // Бэкенд возвращает токены в snake_case
      const accessToken = response.data.access_token;
      const refreshToken = response.data.refresh_token;
      console.log(accessToken);
      if (!accessToken) {
        throw new Error('Токен доступа не получен от сервера');
      }

      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      localStorage.setItem('userEmail', email);

      setUser({ id: 'temp', email });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userEmail');
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};