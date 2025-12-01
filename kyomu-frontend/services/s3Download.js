// services/s3Download.js
import s3 from "./s3.js";

export const generateDownloadURL = async (folder, filename) => {
  const params = {
    Bucket: process.env.AWS_BUCKET,
    Key: `${folder}/${filename}`,
    Expires: 60 * 5, // URL válida 5 minutos
  };

  return await s3.getSignedUrlPromise("getObject", params);
};
