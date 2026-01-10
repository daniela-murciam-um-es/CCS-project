// services/logbook.js
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: process.env.MY_AWS_REGION || "eu-north-1",
});

const LOGBOOK_TABLE = process.env.LOGBOOK_TABLE || "KyomuLogBook";

function rand() {
  return Math.random().toString(36).slice(2, 8);
}

export async function logEvent({ user, action, target = null, meta = {} }, req = null) {
  try {
    const userSub = user?.sub || "anonymous";
    const groups = user?.groups || [];
    const role = groups.includes("entrenadores")
      ? "entrenadores"
      : groups.includes("padres")
      ? "padres"
      : "unknown";

    const ts = new Date().toISOString();

    const item = {
      pk: `USER#${userSub}`,
      sk: `${ts}#${rand()}`,
      ts,
      userSub,
      role,
      action,          // e.g. LOGIN, FILE_UPLOAD_URL, FILE_DELETE, FILE_DOWNLOAD_URL...
      target,          // e.g. S3 key, endpoint, etc.
      meta,            // cualquier extra útil (childId, filename, etc.)
      ip: req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req?.ip || null,
      userAgent: req?.headers?.["user-agent"] || null,
      path: req?.originalUrl || null,
      method: req?.method || null,
    };

    await dynamo
      .put({
        TableName: LOGBOOK_TABLE,
        Item: item,
      })
      .promise();
  } catch (e) {
    // Importante: NO romper la app si falla el log
    console.error("[LogBook] Error logging event:", e);
  }
}
