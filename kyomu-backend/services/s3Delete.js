// services/s3Delete.js
import s3 from "./s3.js";

export const deleteObject = async (key) => {
  const params = {
    Bucket: process.env.AWS_BUCKET,
    Key: key,
  };

  console.log("🗑️ Eliminando objeto S3:", params.Bucket, key);

  await s3.deleteObject(params).promise();
};
