import express from "express";
import { getUploadURL, getDownloadURL } from "../controllers/upload.js";

const router = express.Router();

router.get("/upload-url", getUploadURL);
router.get("/download-url", getDownloadURL);

export default router;
