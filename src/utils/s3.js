const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const S3SyncClient = require("s3-sync-client");
let s3Client;

function initializeS3Client(s3Region) {
  s3Client = new S3Client({ region: s3Region });
}

async function syncFilesToS3(localPath, s3Path) {
  const { sync } = new S3SyncClient({
    client: s3CLient,
  });
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

async function syncFilesFromS3(s3Path, localPath, retryCount = 0) {
  const { sync } = new S3SyncClient({ client: s3Client });

  const retryDelay = 1000; // Retry delay in milliseconds
  const maxRetries = 3; // Maximum number of retries

  return new Promise(async (resolve, reject) => {
    const syncFiles = async () => {
      try {
        console.log(
          `Begin syncing log files from s3 to local path '${localPath}'`
        );
        await sync(s3Path, localPath);
        console.log(`Finish syncing s3 folder to local path`);
        resolve();
      } catch (error) {
        console.log(
          `Failed to sync files from s3 to local path '${localPath}'`
        );

        if (retryCount < maxRetries) {
          console.log(`Retrying (${retryCount + 1}/${maxRetries})...`);
          setTimeout(syncFiles, retryDelay);
          retryCount++;
        } else {
          console.log(`Maximum retries reached. Aborting sync.`);
          reject(new Error("Maximum retries reached")); // Reject the promise when maximum retries are reached
        }
      }
    };
    await syncFiles();
  });
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
    console.log(`+ Finished uploading file '${key}' to bucket '${bucket}'`);
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
    // console.log(`Waiting for file ${key} to be uploaded`);
  }
}

module.exports = {
  syncFilesToS3,
  syncFilesFromS3,
  uploadFileToS3,
  checkFileExistsInS3,
  listS3Folders,
  initializeS3Client,
};
