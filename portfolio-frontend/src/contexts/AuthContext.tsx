import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/lib/api';

export interface AuthUser {
  email: string;
  role?: string;
  sector?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    session_id?: string,
    fingerprint_hash?: string
  ) => Promise<{ error?: string }>;
  register: (
    email: string,
    password: string,
    role?: string,
    sector?: string,
    session_id?: string,
    fingerprint_hash?: string
  ) => Promise<{ error?: string }>;
  checkUser: (fingerprint_hash: string) => Promise<{ exists: boolean; email?: string } | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
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
          const profileResponse = await apiService.getProfile();
          if (profileResponse.data) {
            setUser({
              email: profileResponse.data.email,
              role: profileResponse.data.role,
              sector: profileResponse.data.sector,
            });
          }
        }
      } catch {
        apiService.logout();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (
    email: string,
    password: string,
    session_id?: string,
    fingerprint_hash?: string
  ) => {
    try {
      const response = await apiService.login(email, password, session_id, fingerprint_hash);
      if (response.error) {
        return { error: response.error };
      }

      if (response.data) {
        const profileResponse = await apiService.getProfile();
        if (profileResponse.data) {
          setUser({
            email: profileResponse.data.email,
            role: profileResponse.data.role,
            sector: profileResponse.data.sector,
          });
        }
      }

      return {};
    } catch {
      return { error: 'Login failed. Please try again.' };
    }
  };

  const register = async (
    email: string,
    password: string,
    role?: string,
    sector?: string,
    session_id?: string,
    fingerprint_hash?: string
  ) => {
    try {
      const response = await apiService.register(
        email,
        password,
        role,
        sector,
        session_id,
        fingerprint_hash
      );
      if (response.error) {
        return { error: response.error };
      }

      // Don't auto-login — clear any token set by the API call
      // and let the user log in explicitly
      apiService.logout();

      return { success: true };
    } catch {
      return { error: 'Registration failed. Please try again.' };
    }
  };

  const checkUser = async (fingerprint_hash: string) => {
    try {
      const response = await apiService.checkUser(fingerprint_hash);
      if (response.data) {
        return { exists: response.data.exists, email: response.data.email };
      }
      return null;
    } catch {
      return null;
    }
  };

  const logout = () => {
    apiService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        checkUser,
        logout,
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
