import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get("/api/status", (req, res) => {
  res.json({ ok: true, message: "Backend funcionando" });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log("Backend en puerto", PORT);
});
