import express from "express";
import { verifyToken } from "../middleware/auth.js";
import AWS from "aws-sdk";
import { logEvent } from "../services/logbook.js";

const router = express.Router();

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: process.env.MY_AWS_REGION || "eu-north-1",
});

const LOGBOOK_TABLE = process.env.LOGBOOK_TABLE || "KyomuLogBook";

// Registrar login
router.post("/login", verifyToken(["padres", "entrenadores"]), async (req, res) => {
  await logEvent({ user: req.user, action: "LOGIN" }, req);
  res.json({ ok: true });
});

// Consultar logs de un usuario (solo entrenadores)
router.get("/user/:sub", verifyToken(["entrenadores"]), async (req, res) => {
  try {
    const sub = req.params.sub;
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

    const result = await dynamo
      .query({
        TableName: LOGBOOK_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `USER#${sub}` },
        ScanIndexForward: false,
        Limit: limit,
      })
      .promise();

    res.json({ items: result.Items || [] });
  } catch (e) {
    console.error("Error leyendo logbook:", e);
    res.status(500).json({ error: "Error leyendo logbook" });
  }
});

export default router;
