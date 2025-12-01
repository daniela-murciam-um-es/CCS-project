import { generateUploadURL } from "../services/s3Upload.js";
import { generateDownloadURL } from "../services/s3Download.js";

export const getUploadURL = async (req, res) => {
  try {
    const { folder, filename } = req.query;

    if (!folder || !filename) {
      return res.status(400).json({ error: "Faltan folder o filename" });
    }

    const url = await generateUploadURL(folder, filename);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDownloadURL = async (req, res) => {
  try {
    const { folder, filename } = req.query;

    if (!folder || !filename) {
      return res.status(400).json({ error: "Faltan folder o filename" });
    }

    const url = await generateDownloadURL(folder, filename);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
