"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { rolePath, useAuth } from "../context/AuthContext";

export default function Guard({ role, children }: { role: string; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role !== role) {
      router.replace(rolePath(user.role));
    }
  }, [ready, user, role, router]);

  if (!ready || !user || user.role !== role) return null;
  return <>{children}</>;
}
