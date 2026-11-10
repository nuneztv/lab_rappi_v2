import { Router } from "express";
import { login, register } from "../services/auth.service";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    res.status(201).json(await register(req.body));
  } catch (err: any) {
    console.error("register", err);
    res.status(400).json({ message: err.message || "Error al registrarse" });
  }
});

router.post("/login", async (req, res) => {
  try {
    res.json(await login(req.body.email, req.body.password));
  } catch (err: any) {
    console.error("login", err);
    res.status(401).json({ message: err.message || "Error al iniciar sesion" });
  }
});

export default router;
