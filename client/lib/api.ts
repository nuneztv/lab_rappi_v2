const API = (process.env.NEXT_PUBLIC_API_URL || "") + "/api";

export function getToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("token");
}

export async function api(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
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
