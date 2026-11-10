"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { rolePath, useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (user) {
      router.replace(rolePath(user.role));
    } else {
      router.replace("/login");
    }
  }, [ready, user, router]);

  return (
    <main>
      <div className="card">
        <h1>Rappi Local</h1>
        <p>Cargando...</p>
      </div>
    </main>
  );
}
