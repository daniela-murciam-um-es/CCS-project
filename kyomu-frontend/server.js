import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Carpeta pública
app.use(express.static(path.join(__dirname, "public")));

// Ruta para login
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

// Ruta para padres
app.get("/padres", (req, res) => {
  res.sendFile(path.join(__dirname, "public/padres.html"));
});

// Ruta para entrenadores
app.get("/entrenadores", (req, res) => {
  res.sendFile(path.join(__dirname, "public/entrenadores.html"));
});

app.listen(3000, () => console.log("Frontend en puerto 3000"));
