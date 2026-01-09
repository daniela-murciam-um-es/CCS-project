// services/s3List.js
import s3 from "./s3.js";

export const listFolder = async (prefix) => {
  // Nos aseguramos de que el prefijo termina con "/"
  const normalizedPrefix = prefix.endsWith("/") ? prefix : prefix + "/";

  const params = {
    Bucket: process.env.AWS_BUCKET,
    Prefix: normalizedPrefix,
  };

  const response = await s3.listObjectsV2(params).promise();
  const contents = response.Contents || [];

  // 🔴 Filtrar "carpetas" vacías:
  // - item.Key === normalizedPrefix  (el propio objeto carpeta)
  // - o urlPath vacío
  const filtered = contents.filter((item) => {
    const urlPath = item.Key.replace(normalizedPrefix, "");
    return item.Key !== normalizedPrefix && urlPath !== "";
  });

  return filtered.map((item) => ({
    key: item.Key,
    lastModified: item.LastModified,
    size: item.Size,
    urlPath: item.Key.replace(normalizedPrefix, ""),
  }));
};
