const {
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const S3SyncClient = require("s3-sync-client");
const { getS3Client } = require("./client");

async function syncFilesFromS3(s3Path, localPath, retryCount = 0) {
  const { sync } = new S3SyncClient({ client: await getS3Client() });

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
    await (await getS3Client()).send(new PutObjectCommand(params));
    console.log(`+ Finished uploading file '${key}' to bucket '${bucket}'`);
  } catch (error) {
    console.log("Failed to upload files", error);
  }
}

async function checkFileExistsInS3(bucketName, key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key.replace(bucketName + "/", ""),

    });
    const response = await (await getS3Client()).send(command);
    if (response) {
      return true;
    }
  } catch (err) {
    // console.log(`Waiting for file ${key} to be uploaded`);
  }
}

async function syncS3TestResultsToLocal(s3RunPath, localPath = "logs/testResults") {
  return syncFilesFromS3(`s3://${s3RunPath}/results`, localPath);
}

async function uploadJSONToS3(bucket, s3RunPath, jsonObject) {
  return uploadFileToS3(
    bucket,
    `${s3RunPath.replace(bucket + "/", "")}/logs/cicd.json`,
    JSON.stringify(jsonObject)
  );
}

module.exports = {
  syncS3TestResultsToLocal,
  uploadJSONToS3,
  checkFileExistsInS3
};
