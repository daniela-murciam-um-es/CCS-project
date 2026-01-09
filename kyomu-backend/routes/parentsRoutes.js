// routes/parentsRoutes.js
import express from "express";
import { 
	getMyChildren,
	getChildrenByParentId
 } from "../controllers/parents.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Devuelve los hijos del padre logueado
router.get("/me/children", verifyToken(["padres"]), getMyChildren);

// Para que los entrenadores vean los hijos de cada padre
router.get("/:parentSub/children", verifyToken(["entrenadores"]), getChildrenByParentId);

export default router;
