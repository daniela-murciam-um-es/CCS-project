import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  createEvent,
  getEventsForMonth,
  updateEventAttendance,
} from "../controllers/calendar.js";

const router = express.Router();

router.get("/events", verifyToken(), getEventsForMonth);
router.post("/events", verifyToken(["entrenadores"]), createEvent);
router.post(
  "/events/:id/attendance",
  verifyToken(["padres"]),
  updateEventAttendance
);

export default router;
