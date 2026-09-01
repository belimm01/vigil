import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearToken, getToken, setToken } from "../api.js";

interface AuthContextValue {
  authed: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState(() => Boolean(getToken()));

  useEffect(() => {
    const onUnauthorized = () => {
      setAuthed(false);
      queryClient.clear();
    };
    window.addEventListener("vigil:unauthorized", onUnauthorized);
    return () => window.removeEventListener("vigil:unauthorized", onUnauthorized);
  }, [queryClient]);

  const login = (token: string) => {
    setToken(token);
    setAuthed(true);
  };

  const logout = () => {
    clearToken();
    queryClient.clear();
    setAuthed(false);
  };

  return <AuthContext.Provider value={{ authed, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
