// controllers/parents.js
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || "eu-north-1",
});

const CHILDREN_TABLE = process.env.CHILDREN_TABLE || "KyomuChildren";

export const getMyChildren = async (req, res) => {
  try {
    const user = req.user;

    if (!user.groups.includes("padres")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parentSub = user.sub;

    const result = await dynamo
      .get({
        TableName: CHILDREN_TABLE,
        Key: { parentSub },
      })
      .promise();

    const children = result.Item?.children || [];

    res.json({ children });
  } catch (e) {
    console.error("Error en getMyChildren:", e);
    res.status(500).json({ error: "Error obteniendo hijos" });
  }
};

// 🔹 NUEVO / REVISADO: obtener hijos de un padre concreto (para entrenadores)
export const getChildrenByParentId = async (req, res) => {
  try {
    const user = req.user || { groups: [] };
    const groups = user.groups || [];

    if (!groups.includes("entrenadores")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parentSub = req.params.parentSub;
    if (!parentSub) {
      return res.status(400).json({ error: "Missing parentSub" });
    }

    const result = await dynamo
      .query({
        TableName: CHILDREN_TABLE,
        KeyConditionExpression: "parentSub = :p",
        ExpressionAttributeValues: {
          ":p": parentSub,
        },
      })
      .promise();

    res.json({ children: result.Items || [] });
  } catch (e) {
    console.error("Error en getChildrenByParentId:", e);
    res.status(500).json({ error: "Error obteniendo hijos del padre" });
  }
};
