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

  try {
    const token = header.split(" ")[1];
    const { data, error } = await getAuth().auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: "Token invalido o vencido" });
    }

    const result = await pool.query("SELECT id, role FROM users WHERE auth_id = $1", [data.user.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalido o vencido" });
  }
}

export function onlyRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "No tienes permiso para esta accion" });
    }
    next();
  };
}
