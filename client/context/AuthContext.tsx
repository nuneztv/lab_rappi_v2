"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { realtime } from "../lib/realtime";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: any) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function clear() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("refresh");
  sessionStorage.removeItem("user");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supa = realtime();
    const { data } = supa.auth.onAuthStateChange((event, session) => {
      if (session) {
        sessionStorage.setItem("token", session.access_token);
        sessionStorage.setItem("refresh", session.refresh_token);
      }
    });

    const token = sessionStorage.getItem("token");
    const refresh = sessionStorage.getItem("refresh");
    const saved = sessionStorage.getItem("user");
    if (!token || !refresh || !saved) {
      setReady(true);
    } else {
      supa.auth
        .setSession({ access_token: token, refresh_token: refresh })
        .then((res) => {
          if (res.error) clear();
          else setUser(JSON.parse(saved));
        })
        .finally(() => setReady(true));
    }

    return () => data.subscription.unsubscribe();
  }, []);

  async function start(data: any) {
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("refresh", data.refreshToken);
    sessionStorage.setItem("user", JSON.stringify(data.user));
    await realtime().auth.setSession({
      access_token: data.token,
      refresh_token: data.refreshToken,
    });
    setUser(data.user);
    return data.user as User;
  }

  async function login(email: string, password: string) {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return start(data);
  }

  async function register(body: any) {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return start(data);
  }

  function logout() {
    realtime().auth.signOut({ scope: "local" });
    clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("auth");
  return ctx;
}

export function rolePath(role: string) {
  if (role === "consumer") return "/client";
  if (role === "store") return "/store-admin";
  if (role === "delivery") return "/delivery";
  return "/";
}
