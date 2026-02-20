"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const MOCK_SERVER_URL = "https://aloxi-mock-server.azurewebsites.net";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  serverUrl: string;
  authHeaders: () => Record<string, string>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("mock_token");
    if (savedToken) {
      fetch(`${MOCK_SERVER_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((r) => {
          if (!r.ok) throw new Error("Invalid session");
          return r.json();
        })
        .then((u) => {
          setUser(u);
          setToken(savedToken);
        })
        .catch(() => {
          localStorage.removeItem("mock_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${MOCK_SERVER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("mock_token", data.token);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res = await fetch(`${MOCK_SERVER_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("mock_token", data.token);
  }, []);

  const logout = useCallback(() => {
    if (token) {
      fetch(`${MOCK_SERVER_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("mock_token");
  }, [token]);

  const authHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, serverUrl: MOCK_SERVER_URL, authHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}
