// services/s3Upload.js
import s3 from "./s3.js";

export const generateUploadURL = async (folder, filename) => {
  let contentType = "application/octet-stream";

  if (filename.endsWith(".pdf")) {
    contentType = "application/pdf";
  } else if (filename.endsWith(".docx")) {
    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (filename.endsWith(".doc")) {
    contentType = "application/msword";
  }

  const params = {
    Bucket: process.env.AWS_BUCKET,
    Key: `${folder}/${filename}`,
    Expires: 60 * 5,
    ContentType: contentType,
  };

  return await s3.getSignedUrlPromise("putObject", params);
};
