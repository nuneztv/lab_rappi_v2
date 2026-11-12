import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db/connection";
import { verifyToken } from "./middleware/auth";
import authRoutes from "./routes/auth.routes";
import storeRoutes from "./routes/store.routes";
import clientRoutes from "./routes/client.routes";
import deliveryRoutes from "./routes/delivery.routes";
dotenv.config();
const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "https://labrappiv2.vercel.app", "https://labrappiv2-nine.vercel.app"],
  }),
);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use(verifyToken);
app.get("/", (_req, res) => res.json({ message: "Rappi API funcionando" }));
app.get("/test-db", async (_req, res) => {
  try {
    const r = await pool.query("SELECT NOW()");
    res.json({ ok: true, now: r.rows[0].now });
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, message: "No se pudo conectar a la base de datos" });
  }
});
app.use("/api/store", storeRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/delivery", deliveryRoutes);
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

export default app;
