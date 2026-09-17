import { createContext } from 'react';

export interface User {
  id: string;
  email: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// Создаём и экспортируем контекст – это не компонент, а просто объект
export const AuthContext = createContext<AuthContextType | undefined>(undefined);