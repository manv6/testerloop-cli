const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const S3SyncClient = require("s3-sync-client");
const s3Client = new S3Client({ region: "eu-west-3" });

async function syncFilesToS3(localPath, s3Path) {
  const { sync } = new S3SyncClient({ client: s3Client });
  try {
    console.log(`Begin syncing local files from ${localPath}`);
    await sync(localPath, s3Path);
    console.log(`Finish syncing ${localPath} folder`);
  } catch (error) {
    console.log("Failed to sync files", error);
  }
}

async function listS3Folders(bucketName, folderPath) {
  const params = {
    Bucket: bucketName,
    Prefix: folderPath,
    Delimiter: "/",
  };

  try {
    const data = await s3Client.send(new ListObjectsV2Command(params));
    let folders;
    if (data.CommonPrefixes !== undefined) {
      folders = data.CommonPrefixes.map((obj) =>
        obj.Prefix.replace(folderPath, "")
      );
      return folders;
    } else return [];
  } catch (err) {
    console.log("Error", err);
    return [];
  }
}

async function syncFilesFromS3(s3Path, localPath) {
  const { sync } = new S3SyncClient({ client: s3Client });
  try {
    await sync(s3Path, localPath);
  } catch (error) {
    console.log(
      "Failed to grab failed test files from ",
      s3Path,
      "Error: ",
      error
    );
  }
}

async function uploadFileToS3(bucket, key, body) {
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

async function checkFileExistsInS3(bucketName, key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const response = await s3Client.send(command);
    if (response) {
      return true;
    }
  } catch (err) {
    console.log(`Waiting for file ${key} to be completed`);
  }
}

module.exports = {
  syncFilesToS3,
  syncFilesFromS3,
  uploadFileToS3,
  checkFileExistsInS3,
  listS3Folders,
};
