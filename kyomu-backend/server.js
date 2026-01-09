import "dotenv/config";

// ================================
//   IMPORTS Y CONFIGURACIÓN
// ================================
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import s3Routes from "./routes/s3Routes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import parentsRoutes from "./routes/parentsRoutes.js";
import commentsRoutes from "./routes/commentsRoutes.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ================================
//   SERVIDOR DE ARCHIVOS ESTÁTICOS
// ================================
app.use(express.static(path.join(__dirname, "public")));

// ================================
//   RUTAS DEL FRONTEND
// ================================
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/padres", (req, res) => {
  res.sendFile(path.join(__dirname, "public/padres.html"));
});

app.get("/entrenadores", (req, res) => {
  res.sendFile(path.join(__dirname, "public/entrenadores.html"));
});

// Rutas API de ficheros
app.use("/api/files", s3Routes);

// Calendario
app.use("/api/calendar", calendarRoutes);

// Padres (hijos, etc.)
app.use("/api/parents", parentsRoutes);


// ================================
//   RUTAS DE API
// ================================

// S3: subida/listado/descarga/eliminación de documentos
app.use("/api/files", s3Routes);

// Calendario: eventos (crear, listar por mes)
app.use("/api/calendar", calendarRoutes);

app.use("/api/comments", commentsRoutes)

// ================================
//   PUERTO DEL SERVIDOR
// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✔️ Backend funcionando en http://localhost:${PORT}`);
});
