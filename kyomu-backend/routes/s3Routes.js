import express from "express";
import { verifyToken } from "../middleware/auth.js"; // [cite: 3634]
import {
  getUploadUrl,      // Asegúrate de que en upload.js sea 'getUploadUrl' 
  getDownloadURL,    // [cite: 3637]
  listDocuments,     // Ruta legado [cite: 3638]
  listTrainerFiles,  // [cite: 3639]
  listParentFiles,   // [cite: 3640]
  listTemplates,     // [cite: 3641]
  deleteDocument,    // [cite: 3642]
} from "../controllers/upload.js";

const router = express.Router(); // [cite: 3644]

// 1) Subida de archivos (padres y entrenadores)
// Importante: verifyToken() sin argumentos permite a ambos grupos [cite: 3646]
router.get("/upload-url", verifyToken(["padres", "entrenadores"]), getUploadUrl);

// 2) Descarga de archivos
router.get("/download-url", verifyToken(["padres", "entrenadores"]), getDownloadURL); // [cite: 3648]

// 3) Documentos del padre agrupados por hijo
// Lo usa scripts.js: listarArchivosPadre() [cite: 3651-3652]
router.get("/padres", verifyToken(["padres"]), listParentFiles);

// 4) Vista para entrenadores (Padre -> Hijo -> Documentos)
// Lo usa scripts.js: listarArchivosPadresParaEntrenador() [cite: 3655-3656]
router.get("/entrenadores", verifyToken(["entrenadores"]), listTrainerFiles);

// 5) Plantillas públicas (club -> padres)
// Lo usa scripts.js: listarPlantillasEntrenador() [cite: 3659-3660]
router.get("/plantillas", verifyToken(["padres", "entrenadores"]), listTemplates);

// 6) Borrado de documentos [cite: 3665]
router.delete("/delete", verifyToken(["padres", "entrenadores"]), deleteDocument);

// 7) (Opcional) Ruta legado para debug
router.get("/padres-legacy", verifyToken(["padres"]), listDocuments); // [cite: 3663]

export default router; // [cite: 3666]