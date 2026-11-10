"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { rolePath, useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("consumer");
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const u = await register({
        name,
        email,
        password,
        role,
        storeName: role === "store" ? storeName : undefined,
      });
      router.replace(rolePath(u.role));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card wide">
        <div className="brand">Rappi Local</div>
        <h1>Crear cuenta</h1>
        <div className="role-tabs">
          <button
            type="button"
            className={role === "consumer" ? "active" : ""}
            onClick={() => setRole("consumer")}
          >
            Cliente
          </button>
          <button
            type="button"
            className={role === "store" ? "active" : ""}
            onClick={() => setRole("store")}
          >
            Tienda
          </button>
          <button
            type="button"
            className={role === "delivery" ? "active" : ""}
            onClick={() => setRole("delivery")}
          >
            Domiciliario
          </button>
        </div>
        <form onSubmit={submit} className="form">
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {role === "store" ? (
            <label>
              Nombre de la tienda
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
            </label>
          ) : null}
          {error ? <p className="err">{error}</p> : null}
          <button type="submit">Registrarme</button>
        </form>
        <p className="switch">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </div>
    </main>
  );
}
