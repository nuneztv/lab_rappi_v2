// Entrypoint detectado automáticamente por Vercel (preset Express).
// Vercel exige que este archivo importe "express" directamente.
import express from "express";
import api from "./api";

const app = express();
app.use(api);

export default app;
