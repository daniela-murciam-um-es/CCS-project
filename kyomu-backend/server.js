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
import logbookRoutes from "./routes/logbookRoutes.js";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  // Evita que Safari/otros navegadoes cacheen el login/config
  if (
    req.path === "/" ||
    req.path.endsWith(".html") ||
    req.path.endsWith("aws-exports.js")
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
  next();
});


// ================================
//   SERVIDOR DE ARCHIVOS ESTÁTICOS
// ================================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.redirect("/login.html");
});


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

// ================================
//   RUTAS DE API
// ================================
// Rutas API de ficheros
app.use("/api/files", s3Routes);

// Calendario
app.use("/api/calendar", calendarRoutes);

// Padres (hijos, etc.)
app.use("/api/parents", parentsRoutes);

app.use("/api/logbook", logbookRoutes);


app.use("/api/comments", commentsRoutes)

// ================================
//   PUERTO DEL SERVIDOR
// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✔️ Backend funcionando en http://localhost:${PORT}`);
});
