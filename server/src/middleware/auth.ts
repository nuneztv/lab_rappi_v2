import { Request, Response, NextFunction } from "express";
import pool from "../db/connection";
import { getAuth } from "../db/supabase";
import { AuthUser } from "../types/auth";

export type AuthRequest = Request & { user?: AuthUser };

export async function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No hay token" });
  }

  const token = header.split(" ")[1];

  let authId: string;
  try {
    const { data, error } = await getAuth().auth.getUser(token);
    if (error || !data.user) {
      console.error("verifyToken: Supabase rechazó el token:", error?.message);
      return res.status(401).json({ message: "Token invalido o vencido" });
    }
    authId = data.user.id;
  } catch (err) {
    console.error("verifyToken: error al contactar Supabase Auth:", err);
    return res.status(503).json({ message: "No se pudo verificar la sesion, intenta de nuevo" });
  }

  try {
    const result = await pool.query("SELECT id, role FROM users WHERE auth_id = $1", [authId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }
    req.user = result.rows[0];
  } catch (err) {
    console.error("verifyToken: error de base de datos:", err);
    return res.status(500).json({ message: "Error de base de datos al verificar la sesion" });
  }

  next();
}

export function onlyRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "No tienes permiso para esta accion" });
    }
    next();
  };
}
