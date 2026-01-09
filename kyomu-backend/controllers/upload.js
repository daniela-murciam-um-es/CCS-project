import { generateUploadURL } from "../services/s3Upload.js";
import { generateDownloadURL } from "../services/s3Download.js";
import { listFolder } from "../services/s3List.js";
import { deleteObject } from "../services/s3Delete.js";
import { getParentsNameMap } from "../services/cognitoUsers.js";
import AWS from "aws-sdk";

const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB.DocumentClient();

const S3_BUCKET = process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET;
const PARENT_DOCS_TABLE = process.env.PARENT_DOCS_TABLE || "KyomuParentDocuments";
const CHILDREN_TABLE = process.env.CHILDREN_TABLE || "KyomuChildren";
// ========================================================
// 1️⃣ GENERAR URL DE SUBIDA (Y GUARDAR METADATOS)
// ========================================================
export const getUploadUrl = async (req, res) => {
  try {
      const user = req.user;
      const groups = user?.groups || [];
      const isParent = groups.includes("padres");
      const isTrainer = groups.includes("entrenadores");
      
      // RECIBIMOS EL NOMBRE DESDE EL FRONTEND
      const { filename, type, childId, childFullName } = req.query;

      if (!filename) return res.status(400).json({ error: "filename es obligatorio" });

      let key;
      if (type === "plantilla") {
          if (!isTrainer) return res.status(403).json({ error: "Solo entrenadores" });
          key = `publico/${filename}`;
      } else {
          if (!isParent) return res.status(403).json({ error: "Solo padres" });
          if (!childId) return res.status(400).json({ error: "childId obligatorio" });
          key = `padres/${user.sub}/${filename}`;
      }

      const params = {
          Bucket: S3_BUCKET,
          Key: key,
          Expires: 300,
          ContentType: "application/octet-stream"
      };

      const url = await s3.getSignedUrlPromise("putObject", params);

      // GUARDAMOS EN DYNAMO CON EL NOMBRE DESNORMALIZADO
      if (isParent && type !== "plantilla") {
          const nowIso = new Date().toISOString();
          await dynamo.put({
              TableName: PARENT_DOCS_TABLE,
              Item: {
                  parentSub: user.sub,
                  documentKey: key,
                  childId: childId,
                  childNombre: childFullName, // <--- Guardamos el nombre directamente
                  filename: filename,
                  uploadedAt: nowIso
              }
          }).promise();
      }

      return res.json({ url, key });
  } catch (e) {
      console.error("Error en getUploadUrl:", e);
      res.status(500).json({ error: "Error obteniendo URL de subida" });
  }
};

// ========================================================
// 4️⃣ VISTA PARA ENTRENADORES (SÚPER OPTIMIZADA)
// ========================================================
export const listTrainerFiles = async (req, res) => {
try {
  const scanResult = await dynamo.scan({ 
    TableName: PARENT_DOCS_TABLE 
  }).promise();
  const items = scanResult.Items || [];
  const parentsMapNames = await getParentsNameMap();
  const hierarchy = {};

  for (const it of items) {
    const pSub = it.parentSub;
    const cId = it.childId || "sin-hijo";

    if (!hierarchy[pSub]) {
      hierarchy[pSub] = {
        parentSub: pSub,
        parentName: parentsMapNames[pSub] || pSub,
        children: {}
      };
    }

    if (!hierarchy[pSub].children[cId]) {
      hierarchy[pSub].children[cId] = {
        childId: cId,
        // YA NO HACEMOS QUERY A KYOMUCHILDREN
        // Usamos el nombre que guardamos en la subida
        nombre: it.childNombre || "Hijo no identificado", 
        documents: []
      };
    }

    hierarchy[pSub].children[cId].documents.push({
      documentKey: it.documentKey,
      filename: it.filename || it.documentKey.split('/').pop(),
      uploadedAt: it.uploadedAt
    });
  }

  const finalResponse = Object.values(hierarchy).map(p => ({
    ...p,
    children: Object.values(p.children)
  }));

  res.json({ parents: finalResponse });
} catch (e) {
  console.error("Error en listTrainerFiles:", e);
  res.status(500).json({ error: "Error al listar archivos" });
}
};

// ... (El resto de funciones listParentFiles, listTemplates, etc., se mantienen igual)

// ========================================
// 2️⃣ URL PREFIRMADA PARA DESCARGAR
// ========================================
export const getDownloadURL = async (req, res) => {
  try {
    const { filename, folder } = req.query;
    const user = req.user;

    if (!filename || !folder) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const groups = user.groups || [];
    const isTrainer = groups.includes("entrenadores");
    const isOwnFolder = folder === `padres/${user.sub}`;

    // Permitimos:
    //  - padres: su propia carpeta padres/<sub>/ y cualquier ruta bajo "publico/"
    //  - entrenadores: cualquier carpeta
    const isPublicFolder =
      folder === "publico" || folder.startsWith("publico/");

    if (!isTrainer && !isOwnFolder && !isPublicFolder) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const url = await generateDownloadURL(folder, filename);
    res.json({ url });
  } catch (e) {
    console.error("Error en getDownloadURL:", e);
    res.status(500).json({ error: e.message });
  }
};

// ========================================
// 3️⃣ (LEGADO) LISTAR DOCUMENTOS S3 DE UN PADRE
//      - Ya NO lo usamos desde el front nuevo,
//        pero lo dejo por si lo necesitas para debug.
// ========================================
export const listDocuments = async (req, res) => {
  try {
    const user = req.user;

    if (!user.groups.includes("padres")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const prefix = `padres/${user.sub}/`;
    const documents = await listFolder(prefix);

    res.json({ documents });
  } catch (e) {
    console.error("Error en listDocuments:", e);
    res.status(500).json({ error: e.message });
  }
};

// GET /api/files/entrenadores
// KYOMU-BACKEND/controllers/upload.js

// KYOMU-BACKEND/controllers/upload.js


// ========================================
// 5️⃣ LISTAR DOCUMENTOS DEL PADRE (VISTA PADRES)
// ========================================
// GET /api/files/padres   (solo padres)
export const listParentFiles = async (req, res) => {
  const user = req.user;
  const parentSub = user.sub;

  try {
    let documentsByChild = [];

    // 1) Intentamos leer metadatos desde Dynamo (si existen y tenemos permisos)
    try {
      const result = await dynamo
        .query({
          TableName: PARENT_DOCS_TABLE,
          KeyConditionExpression: "parentSub = :p",
          ExpressionAttributeValues: {
            ":p": parentSub,
          },
        })
        .promise();

      const items = result.Items || [];

      if (items.length > 0) {
        // Agrupamos por childId
        const byChild = {};
        items.forEach((it) => {
          const childId = it.childId || "sin-hijo";
          if (!byChild[childId]) byChild[childId] = [];
          byChild[childId].push(it);
        });

        documentsByChild = Object.keys(byChild).map((childId) => ({
          childId,
          documents: byChild[childId].map((it) => ({
            documentKey: it.documentKey,
            filename: it.filename,
            uploadedAt: it.uploadedAt,
          })),
        }));

        return res.json({ documentsByChild });
      }

      console.warn(
        "[listParentFiles] KyomuParentDocuments vacío para parentSub",
        parentSub,
        "→ fallback a S3"
      );
    } catch (errDynamo) {
      console.error(
        "[listParentFiles] Error consultando Dynamo (usamos fallback S3):",
        errDynamo
      );
      // seguimos al fallback S3
    }

    // 2) Fallback: listamos directamente en S3 la carpeta padres/<sub>/
    const prefix = `padres/${parentSub}/`;
    const s3Docs = await listFolder(prefix); // devuelve objetos { key, lastModified, size, urlPath }

    if (!s3Docs || !s3Docs.length) {
      return res.json({ documentsByChild: [] });
    }

    const docsMapped = s3Docs.map((obj) => {
      const key = obj.key;
      const parts = key.split("/");
      const filename = parts[parts.length - 1];
      return {
        documentKey: key,
        filename,
        uploadedAt: obj.lastModified,
      };
    });

    // Como S3 no sabe qué hijo es, los ponemos todos bajo "sin-hijo"
    documentsByChild = [
      {
        childId: "sin-hijo",
        documents: docsMapped,
      },
    ];

    return res.json({ documentsByChild });
  } catch (e) {
    console.error("Error en listParentFiles:", e);
    res.status(500).json({ error: "Error listando documentos del padre" });
  }
};



// ========================================
// 6️⃣ LISTAR PLANTILLAS (documentos públicos)
//     → /api/files/plantillas (padres y entrenadores)
// ========================================
export const listTemplates = async (req, res) => {
  try {
    // Todos los autenticados pueden ver plantillas
    const prefix = "publico/";
    const documents = await listFolder(prefix);

    // devolvemos la misma forma de siempre: { documents: [...] }
    res.json({ documents });
  } catch (e) {
    console.error("Error en listTemplates:", e);
    res.status(500).json({ error: e.message });
  }
};

// ========================================
// 7️⃣ ELIMINAR DOCUMENTO (S3 + metadatos si es padre dueño)
// ========================================
export const deleteDocument = async (req, res) => {
  try {
    const { key } = req.body;
    const user = req.user;

    if (!key) {
      return res.status(400).json({ error: "Missing key" });
    }

    const groups = user.groups || [];
    const isTrainer = groups.includes("entrenadores");
    const ownPrefix = `padres/${user.sub}/`;
    const isOwnParentFile = key.startsWith(ownPrefix);

    // Reglas:
    // - Padres: solo pueden borrar sus propios archivos en padres/<sub>/
    // - Entrenadores: pueden borrar cualquier cosa (si quieres, aquí puedes restringir)
    if (!isOwnParentFile && !isTrainer) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // 1) Borramos en S3
    await deleteObject(key);

    // 2) Si es el propio padre, intentamos borrar metadatos en Dynamo
    if (isOwnParentFile) {
      try {
        await dynamo
          .delete({
            TableName: PARENT_DOCS_TABLE,
            Key: {
              parentId: user.sub,
              documentKey: key,
            },
          })
          .promise();
      } catch (e) {
        console.error("Error borrando metadatos en Dynamo:", e);
        // No rompemos la respuesta por esto
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error("Error en deleteDocument:", e);
    res.status(500).json({ error: e.message });
  }
};
