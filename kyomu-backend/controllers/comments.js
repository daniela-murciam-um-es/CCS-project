// controllers/comments.js
import AWS from "aws-sdk";
const dynamo = new AWS.DynamoDB.DocumentClient({ region: "eu-north-1" });
const COMMENTS_TABLE = process.env.COMMENTS_TABLE || "KyomuTrainerComments";

export const createComment = async (req, res) => {
  try {
    const user = req.user;
    const { documentKey, parentId, text } = req.body; // Mantenemos parentId

    const commentId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const now = new Date().toISOString();
    const groups = user.groups || [];
    let authorRole = groups.includes("entrenadores") ? "trainer" : "parent";

    const item = {
      commentId,
      parentId, // PK o atributo de filtrado según tu tabla
      documentKey,
      text,
      authorRole,
      authorName: user.name || user.email || "Usuario",
      authorSub: user.sub,
      createdAt: now,
      updatedAt: now,
    };

    await dynamo.put({ TableName: COMMENTS_TABLE, Item: item }).promise();
    res.status(201).json({ comment: item });
  } catch (e) {
    console.error("Error en createComment:", e);
    res.status(500).json({ error: "Error creando comentario" });
  }
};

export const listComments = async (req, res) => {
  try {
    const { parentId, documentKey } = req.query; // Mantenemos parentId

    const result = await dynamo.scan({
      TableName: COMMENTS_TABLE,
      FilterExpression: "#p = :p AND #d = :d",
      ExpressionAttributeNames: { "#p": "parentId", "#d": "documentKey" },
      ExpressionAttributeValues: { ":p": parentId, ":d": documentKey },
    }).promise();

    res.json({ comments: result.Items || [] });
  } catch (e) {
    res.status(500).json({ error: "Error obteniendo comentarios" });
  }
};


/**
* PUT /api/comments/:id
* Body:
* {
* text: string
* }
*/
export const updateComment = async (req, res) => {
  try {
  const { id } = req.params; // id = commentId
  const { text } = req.body;
  
  if (!id) {
  return res.status(400).json({ error: "Falta comment id" });
  }
  if (!text || !text.trim()) {
  return res.status(400).json({ error: "El texto no puede estar vacío" });
  }
  
  const now = new Date().toISOString();
  
  const result = await dynamo
  .update({
  TableName: COMMENTS_TABLE,
  Key: {
  commentId: id,
  },
  UpdateExpression: "SET #t = :t, updatedAt = :u",
  ExpressionAttributeNames: {
  "#t": "text",
  },
  ExpressionAttributeValues: {
  ":t": text,
  ":u": now,
  },
  ReturnValues: "ALL_NEW",
  })
  .promise();
  
  res.json({ comment: result.Attributes });
  } catch (e) {
  console.error("Error en updateComment:", e);
  res.status(500).json({ error: "Error actualizando comentario" });
  }
  };
  
  /**
  * DELETE /api/comments/:id
  */
  export const deleteComment = async (req, res) => {
  try {
  const { id } = req.params;
  
  if (!id) {
  return res.status(400).json({ error: "Falta comment id" });
  }
  
  await dynamo
  .delete({
  TableName: COMMENTS_TABLE,
  Key: {
  commentId: id,
  },
  })
  .promise();
  
  res.json({ success: true });
  } catch (e) {
  console.error("Error en deleteComment:", e);
  res.status(500).json({ error: "Error eliminando comentario" });
  }
  };