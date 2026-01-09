// routes/commentsRoutes.js
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  createComment,
  listComments,
  updateComment,
  deleteComment,
} from "../controllers/comments.js";

const router = express.Router();

// Crear comentario → entrenadores Y padres (para poder responder)
router.post("/", verifyToken(["entrenadores", "padres"]), createComment);

// Listar comentarios → entrenadores Y padres
router.get("/", verifyToken(["entrenadores", "padres"]), listComments);

// Actualizar comentario → de momento solo entrenadores
router.put("/:id", verifyToken(["entrenadores"]), updateComment);

// Eliminar comentario → de momento solo entrenadores
router.delete("/:id", verifyToken(["entrenadores"]), deleteComment);

export default router;
