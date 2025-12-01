// services/s3.js
import AWS from "aws-sdk";

// Cargar credenciales desde variables de entorno
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});

// Crear una instancia S3
const s3 = new AWS.S3({
  signatureVersion: "v4", // necesario para URLs prefirmadas
});

export default s3;

AWS.config.setPromisesDependency(null);
