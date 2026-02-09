import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  username: string;
  email?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, password: string, email?: string) => Promise<{ error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const checkAuth = async () => {
    try {
      const token = apiService.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await apiService.verifyToken();
      if (response.error || !response.data?.valid) {
        apiService.logout();
        setUser(null);
      } else {
        // Get user profile
        const profileResponse = await apiService.getProfile();
        if (profileResponse.data) {
          setUser(profileResponse.data);
        }
      }
    } catch {
      // Silently handle auth check failure
      apiService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await apiService.login(username, password);
      if (response.error) {
        return { error: response.error };
      }

      if (response.data) {
        const profileResponse = await apiService.getProfile();
        if (profileResponse.data) {
          setUser(profileResponse.data);
        }
      }

      return {};
    } catch (error) {
      return { error: 'Login failed. Please try again.' };
    }
  };

  const register = async (username: string, password: string, email?: string) => {
    try {
      const response = await apiService.register(username, password, email);
      if (response.error) {
        return { error: response.error };
      }

      // Auto-login after registration
      const loginResponse = await apiService.login(username, password);
      if (loginResponse.data) {
        const profileResponse = await apiService.getProfile();
        if (profileResponse.data) {
          setUser(profileResponse.data);
        }
      }

      return {};
    } catch (error) {
      return { error: 'Registration failed. Please try again.' };
    }
  };

  const logout = () => {
    apiService.logout();
    setUser(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

