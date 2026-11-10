"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  function exit() {
    logout();
    router.replace("/login");
  }

  return (
    <div>
      <div className="nav">
        <b>{title}</b>
        <span>{user ? user.name : ""}</span>
        <button className="ghost" onClick={exit}>
          Cerrar sesión
        </button>
      </div>
      <main>{children}</main>
    </div>
  );
}
