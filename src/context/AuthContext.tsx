import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "../types/seo";
import { api } from "../services/api";
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: () => void;
  loginManually: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<User>("/session")
      .then(setUser)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const logout = async () => {
    try {
      await api("/auth/logout", "POST");
      setUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed.");
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        isAdmin: user?.role === "Super Admin",
        login: () => window.location.assign("/api/auth/login"),
        loginManually: async (username, password) => {
          await api("/auth/manual", "POST", { username, password });
          setUser(await api<User>("/session"));
          setError(null);
        },
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing.");
  return value;
}
