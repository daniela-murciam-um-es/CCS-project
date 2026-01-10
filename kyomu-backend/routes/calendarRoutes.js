import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  createEvent,
  getEventsForMonth,
  updateEventAttendance,
  updateEvent} from "../controllers/calendar.js";

const router = express.Router();

router.get("/events", verifyToken(), getEventsForMonth);
router.post("/events", verifyToken(["entrenadores"]), createEvent);
router.post(
  "/events/:id/attendance",
  verifyToken(["padres"]),
  updateEventAttendance
);
router.put("/events/:id", verifyToken(["entrenadores"]), updateEvent);

export default router;
