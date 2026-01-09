// services/s3.js
import AWS from "aws-sdk";

AWS.config.update({
  region: process.env.MY_AWS_REGION,
  accessKeyId: process.env.MY_AWS_ACCESS_KEY,
  secretAccessKey: process.env.MY_AWS_SECRET_KEY,
});

const s3 = new AWS.S3({
  signatureVersion: "v4",
});

export default s3;
