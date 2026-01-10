// controllers/calendar.js
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: process.env.MY_AWS_REGION || "eu-north-1",
});

// Tabla donde guardamos los eventos del calendario
const TABLE_NAME = process.env.CALENDAR_TABLE || "KyomuCalendarEvents";

/**
 * Crear un nuevo evento (solo entrenadores)
 */
export const createEvent = async (req, res) => {
  try {
    const user = req.user;
    const groups = user.groups || [];

    if (!groups.includes("entrenadores")) {
      return res
        .status(403)
        .json({ error: "Solo los entrenadores pueden crear eventos" });
    }

    const {
      date,
      title,
      description,
      price,
      place,
      time,
      requiresAuthorization,
      audience,
      paymentInfo,
    } = req.body;

    if (!date || !title) {
      return res
        .status(400)
        .json({ error: "Faltan campos obligatorios (fecha y título)" });
    }

    const id =
      Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    const event = {
      id,
      date, // "YYYY-MM-DD"
      title: title.trim(),
      description: (description || "").trim(),
      price: price ?? "",
      place: (place || "").trim(),
      time: time ?? "",
      requiresAuthorization: !!requiresAuthorization,
      audience: (audience || "").trim(),
      paymentInfo: (paymentInfo || "").trim(),
      createdBy: user.sub,
      createdAt: new Date().toISOString(),
      // lista de asistencias (una entrada por padre)
      attendances: [],
    };

    await dynamo
      .put({
        TableName: TABLE_NAME,
        Item: event,
      })
      .promise();

    res.status(201).json({ event });
  } catch (e) {
    console.error("Error en createEvent:", e);
    res.status(500).json({ error: "Error creando el evento" });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const user = req.user;
    const groups = user.groups || [];

    if (!groups.includes("entrenadores")) {
      return res.status(403).json({ error: "Solo entrenadores" });
    }

    const eventId = req.params.id;
    if (!eventId) return res.status(400).json({ error: "Missing event id" });

    const {
      title,
      description,
      price,
      place,
      time,
      requiresAuthorization,
      audience,
      paymentInfo,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "El título es obligatorio" });
    }

    // Traer evento actual para conservar date y attendances (y lo que ya exista)
    const current = await dynamo
      .get({ TableName: TABLE_NAME, Key: { id: eventId } })
      .promise();

    if (!current.Item) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    // (Opcional) si quieres impedir editar eventos de otros entrenadores:
    // if (current.Item.createdBy !== user.sub) return res.status(403).json({ error: "Forbidden" });

    const updatedAt = new Date().toISOString();

    await dynamo
      .update({
        TableName: TABLE_NAME,
        Key: { id: eventId },
        UpdateExpression:
          "SET #t=:t, #d=:d, #p=:p, #pl=:pl, #ti=:ti, #ra=:ra, #au=:au, #pi=:pi, updatedAt=:ua",
        ExpressionAttributeNames: {
          "#t": "title",
          "#d": "description",
          "#p": "price",
          "#pl": "place",
          "#ti": "time",
          "#ra": "requiresAuthorization",
          "#au": "audience",
          "#pi": "paymentInfo",
        },
        ExpressionAttributeValues: {
          ":t": title.trim(),
          ":d": (description || "").trim(),
          ":p": price ?? "",
          ":pl": (place || "").trim(),
          ":ti": time ?? "",
          ":ra": !!requiresAuthorization,
          ":au": (audience || "").trim(),
          ":pi": (paymentInfo || "").trim(),
          ":ua": updatedAt,
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();

    // Si quieres devolver el evento actualizado, mejor pedir ReturnValues y devolver Attributes:
    // const result = await dynamo.update(...).promise();
    // res.json({ event: result.Attributes });

    res.json({ success: true });
  } catch (e) {
    console.error("Error en updateEvent:", e);
    res.status(500).json({ error: "Error actualizando el evento" });
  }
};


/**
 * Obtener eventos de un mes concreto
 * GET /api/calendar/events?year=2025&month=12
 */
export const getEventsForMonth = async (req, res) => {
  try {
    const user = req.user;
    const groups = user.groups || [];

    const allowed =
      groups.includes("padres") || groups.includes("entrenadores");
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10); // 1-12

    if (isNaN(year) || isNaN(month)) {
      return res
        .status(400)
        .json({ error: "Parámetros year y month son obligatorios" });
    }

    const monthStr = String(month).padStart(2, "0");
    const prefix = `${year}-${monthStr}-`;

    const result = await dynamo
      .scan({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(#d, :prefix)",
        ExpressionAttributeNames: { "#d": "date" },
        ExpressionAttributeValues: { ":prefix": prefix },
      })
      .promise();

    const events = result.Items || [];

    res.json({ events });
  } catch (e) {
    console.error("Error en getEventsForMonth:", e);
    res.status(500).json({ error: "Error obteniendo eventos" });
  }
};

/**
 * Padres marcan asistencia a un evento
 * POST /api/calendar/events/:id/attendance
 * Body:
 * {
 *   children: [ { childName, status }, ... ]
 * }
 */
export const updateEventAttendance = async (req, res) => {
  try {
    const user = req.user;
    const groups = user.groups || [];

    // Sólo padres
    if (!groups.includes("padres")) {
      return res
        .status(403)
        .json({ error: "Solo los padres pueden marcar asistencia" });
    }

    const eventId = req.params.id;
    const { children } = req.body;

    if (!eventId) {
      return res.status(400).json({ error: "Missing event id" });
    }

    if (!Array.isArray(children) || children.length === 0) {
      return res
        .status(400)
        .json({ error: "Debes indicar al menos un hijo" });
    }

    const parentSub = user.sub;

    // Obtenemos el evento actual
    const current = await dynamo
      .get({
        TableName: TABLE_NAME,
        Key: { id: eventId },
      })
      .promise();

    if (!current.Item) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    const existing = current.Item.attendances || [];

    const attendanceEntry = {
      parentSub,
      children: children.map((c) => ({
        childNombre: c.childNombre,
        childSede: c.childSede || "",  // 🔴 NUEVO
        status: c.status || "going",
      })),      
      updatedAt: new Date().toISOString(),
    };

    // Quitamos las asistencias antiguas de ESTE padre
    const filtered = existing.filter((a) => a.parentSub !== parentSub);
    filtered.push(attendanceEntry);

    await dynamo
      .update({
        TableName: TABLE_NAME,
        Key: { id: eventId },
        UpdateExpression: "SET attendances = :att",
        ExpressionAttributeValues: {
          ":att": filtered,
        },
      })
      .promise();

    res.json({ success: true, attendances: filtered });
  } catch (e) {
    console.error("Error en updateEventAttendance:", e);
    res.status(500).json({ error: "Error actualizando asistencia" });
  }
};
