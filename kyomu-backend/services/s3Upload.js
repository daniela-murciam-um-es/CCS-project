// services/s3Upload.js
import s3 from "./s3.js";

export const generateUploadURL = async (folder, filename) => {
  // Aseguramos que folder termina en "/"
  const normalizedFolder = folder.endsWith("/") ? folder : folder + "/";
  const Key = normalizedFolder + filename;

  console.log("🔼 Presigned PUT — bucket:", process.env.MY_AWS_BUCKET, "key:", Key);

  const params = {
    Bucket: process.env.MY_AWS_BUCKET,
    Key,
    Expires: 60, // segundos
    // Puedes fijar un ContentType si quieres, pero no es obligatorio aquí
  };

  return await new Promise((resolve, reject) => {
    s3.getSignedUrl("putObject", params, (err, url) => {
      if (err) return reject(err);
      resolve(url);
    });
  });
};
