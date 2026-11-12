import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // En Vercel cada instancia de la función tiene su propio pool:
  // pocas conexiones por instancia para no agotar el límite de Supabase.
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

// Sin esto, un error en una conexión inactiva tumba todo el proceso.
pool.on("error", (err) => {
  console.error("pg pool error:", err.message);
});

export default pool;
