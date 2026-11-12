import { realtime } from "./realtime";

const API = (process.env.NEXT_PUBLIC_API_URL || "") + "/api";

function saveSession(session: { access_token: string; refresh_token: string }) {
  sessionStorage.setItem("token", session.access_token);
  sessionStorage.setItem("refresh", session.refresh_token);
}

// Devuelve un token vigente: Supabase lo renueva solo si ya venció (dura 1 hora).
export async function getToken() {
  if (typeof window === "undefined") return null;
  try {
    const { data } = await realtime().auth.getSession();
    if (data.session) {
      saveSession(data.session);
      return data.session.access_token;
    }
  } catch {}
  return sessionStorage.getItem("token");
}

// Fuerza una renovación del token (cuando el servidor dice 401).
async function refreshToken() {
  try {
    const refresh = sessionStorage.getItem("refresh");
    const { data } = await realtime().auth.refreshSession(
      refresh ? { refresh_token: refresh } : undefined,
    );
    if (data.session) {
      saveSession(data.session);
      return data.session.access_token;
    }
  } catch {}
  return null;
}

function request(path: string, options: RequestInit, token: string | null) {
  return fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
}

export async function api(path: string, options: RequestInit = {}) {
  const token = await getToken();
  let res = await request(path, options, token);

  // Si el token venció, se renueva y se reintenta una vez.
  if (res.status === 401 && token && !path.startsWith("/auth/")) {
    const fresh = await refreshToken();
    if (fresh) res = await request(path, options, fresh);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "error");
  return data;
}

export function statusLabel(status: string) {
  if (status === "waiting_for_deliver") return "Creado";
  if (status === "in_progress") return "En entrega";
  if (status === "delivered") return "Entregado";
  return status;
}
