const {
  S3Client,
} = require("@aws-sdk/client-s3");

const { getInputData } = require("../utils/helper");

let s3Client;


function initializeS3Client(s3Region) {
  s3Client = new S3Client({ region: s3Region });

  return s3Client;
}

async function getS3Client() {
  if (s3Client) {
    return s3Client;
  }

  const { s3Region } = await getInputData();

  return initializeS3Client(s3Region);
}

function clearClient() {
  s3Client = null;
}

module.exports = {
  getS3Client,
  clearClient
}
