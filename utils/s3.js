const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const S3SyncClient = require("s3-sync-client");

async function syncFilesToS3(localPath, s3Path) {
  const s3Client = new S3Client({ region: "eu-west-3" });
  const { sync } = new S3SyncClient({ client: s3Client });
  try {
    console.log(`Begin syncing local files from ${localPath}`);
    await sync(localPath, s3Path);
    console.log(`Finish syncing ${localPath} folder`);
  } catch (error) {
    console.log("Failed to sync files", error);
  }
}

async function syncFilesFromS3(s3Path, localPath) {
  const s3Client = new S3Client({ region: "eu-west-3" });
  const { sync } = new S3SyncClient({ client: s3Client });
  try {
    console.log(`Begin syncing local files from ${localPath}`);
    await sync(s3Path, localPath);
    console.log(`Finish syncing ${s3Path} folder`);
  } catch (error) {
    console.log("Failed to sync files", error);
  }
}

async function uploadFileToS3(bucket, key, body) {
  const s3Client = new S3Client({ region: "eu-west-3" });
  const params = {
    Bucket: bucket,
    Key: key,
    Body: body,
  };
  try {
    console.log(`Begin uploading file '${key}'`);
    await s3Client.send(new PutObjectCommand(params));
    console.log(`Finish uploading file '${key}' to bucket '${bucket}'`);
  } catch (error) {
    console.log("Failed to upload files", error);
  }
}

module.exports = {
  syncFilesToS3,
  syncFilesFromS3,
  uploadFileToS3,
};
