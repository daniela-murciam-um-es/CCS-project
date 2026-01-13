import express from "express";
import { verifyToken } from "../middleware/auth.js";
import AWS from "aws-sdk";
import { logEvent } from "../services/logbook.js";
import { getParentsNameMap } from "../services/cognitoUsers.js";


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

// Ver MIS logs (padres y entrenadores)
router.get("/me", verifyToken(["padres", "entrenadores"]), async (req, res) => {
  try {
    const sub = req.user.sub;
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
    console.error("Error leyendo logbook/me:", e);
    res.status(500).json({ error: "Error leyendo logbook" });
  }
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

// Últimos logins de PADRES (para entrenadores)
router.get("/logins/padres", verifyToken(["entrenadores"]), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "100", 10), 200);

    const result = await dynamo.query({
      TableName: LOGBOOK_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "LOGINS#padres" },
      ScanIndexForward: false, // más recientes primero
      Limit: limit,
    }).promise();

    res.json({ items: result.Items || [] });
  } catch (e) {
    console.error("Error leyendo logins padres:", e);
    res.status(500).json({ error: "Error leyendo logins padres" });
  }
});


router.get("/feed/padres", verifyToken(["entrenadores"]), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "200", 10), 500);

    const result = await dynamo.query({
      TableName: LOGBOOK_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "FEED#padres" },
      ScanIndexForward: false,
      Limit: limit,
    }).promise();

    res.json({ items: result.Items || [] });
  } catch (e) {
    console.error("Error leyendo feed padres:", e);
    res.status(500).json({ error: "Error leyendo feed padres" });
  }
});

router.get("/feed/padres", verifyToken(["entrenadores"]), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "200", 10), 500);

    const result = await dynamo
      .query({
        TableName: LOGBOOK_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "FEED#padres" },
        ScanIndexForward: false,
        Limit: limit,
      })
      .promise();

    const items = result.Items || [];

    // 🔥 Map sub -> nombre (desde Cognito)
    const nameMap = await getParentsNameMap();

    const enriched = items.map((it) => ({
      ...it,
      parentName: nameMap[it.userSub] || it.userSub,
    }));

    res.json({ items: enriched });
  } catch (e) {
    console.error("Error leyendo feed padres:", e);
    res.status(500).json({ error: "Error leyendo feed padres" });
  }
});



export default router;
