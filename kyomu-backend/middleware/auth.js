// middleware/auth.js
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({
  jwksUri:
    "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_ENtj8vBCc/.well-known/jwks.json",
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * verifyToken(allowedGroups?)
 *
 * - allowedGroups: array opcional con grupos permitidos, ej. ["padres"], ["entrenadores"]
 * - Si no se pasa nada → solo verifica el token, sin filtrar por grupos.
 */
export const verifyToken = (allowedGroups = null) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Token missing" });
    }

    jwt.verify(token, getKey, {}, (err, decoded) => {
      if (err) {
        console.error("Error verificando token:", err);
        return res.status(401).json({ error: "Invalid token" });
      }

      const groups = decoded["cognito:groups"] || [];

      const name =
        decoded.name ||
        decoded["custom:name"] ||
        decoded["cognito:username"] ||
        null;

      const email = decoded.email || null;

      req.user = {
        sub: decoded.sub,
        groups,
        name,
        email,
      };

      if (Array.isArray(allowedGroups) && allowedGroups.length > 0) {
        const allowed = allowedGroups.some((g) => groups.includes(g));
        if (!allowed) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      next();
    });
  };
};
