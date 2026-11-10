import bcrypt from "bcryptjs";
import pool from "../db/connection";
import { getAdmin, getAuth } from "../db/supabase";

const roles = ["consumer", "store", "delivery"];

async function signIn(email: string, password: string) {
  const { data, error } = await getAuth().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("Correo o contraseña incorrectos");

  const result = await pool.query("SELECT id, name, email, role FROM users WHERE auth_id = $1", [
    data.user.id,
  ]);
  if (result.rows.length === 0) throw new Error("Usuario no encontrado");

  return {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: result.rows[0],
  };
}

export async function register(body: any) {
  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password;
  const role = body.role;
  const storeName = (body.storeName || "").trim();

  if (!name || !email || !password) throw new Error("Nombre, correo y contraseña son obligatorios");
  if (!roles.includes(role)) throw new Error("Rol invalido");
  if (role === "store" && !storeName) throw new Error("El nombre de la tienda es obligatorio");

  const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (exists.rows.length > 0) throw new Error("Ya existe un usuario con ese correo");

  const { data, error } = await getAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role },
  });
  if (error) throw error;

  try {
    const saved = await pool.query(
      "INSERT INTO users (auth_id, name, email, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [data.user.id, name, email, role],
    );
    if (role === "store") {
      await pool.query("INSERT INTO stores (name, is_open, user_owner_id) VALUES ($1, false, $2)", [
        storeName,
        saved.rows[0].id,
      ]);
    }
  } catch (err) {
    await pool.query("DELETE FROM users WHERE auth_id = $1", [data.user.id]);
    await getAdmin().auth.admin.deleteUser(data.user.id);
    throw err;
  }

  return signIn(email, password);
}

export async function login(email: string, password: string) {
  const mail = (email || "").trim().toLowerCase();
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [mail]);
  const user = result.rows[0];
  if (!user) throw new Error("Correo o contraseña incorrectos");

  if (!user.auth_id) {
    const ok = user.password ? await bcrypt.compare(password, user.password) : false;
    if (!ok) throw new Error("Correo o contraseña incorrectos");

    const { data, error } = await getAdmin().auth.admin.createUser({
      email: mail,
      password,
      email_confirm: true,
      user_metadata: { name: user.name },
      app_metadata: { role: user.role },
    });
    if (error) throw error;
    await pool.query("UPDATE users SET auth_id = $1 WHERE id = $2", [data.user.id, user.id]);
  }

  return signIn(mail, password);
}
