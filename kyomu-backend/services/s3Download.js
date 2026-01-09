// services/s3Download.js
import s3 from "./s3.js";

export const generateDownloadURL = async (folder, filename) => {
  // Aseguramos que folder termina en "/"
  const normalizedFolder = folder.endsWith("/") ? folder : folder + "/";
  const Key = normalizedFolder + filename;

  console.log("🔽 Presigned GET — bucket:", process.env.AWS_BUCKET, "key:", Key);

  const params = {
    Bucket: process.env.AWS_BUCKET,
    Key,
    Expires: 60, // segundos
  };

  // Si tu versión de aws-sdk no tiene getSignedUrlPromise, usamos una promesa manual
  return await new Promise((resolve, reject) => {
    s3.getSignedUrl("getObject", params, (err, url) => {
      if (err) return reject(err);
      resolve(url);
    });
  });
};
