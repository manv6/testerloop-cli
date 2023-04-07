const { Client } = require("pg");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const S3SyncClient = require("s3-sync-client");

const postgresClient = new Client({
  user: "qa",
  host: "testerloop-dev.cks2q8yzz7b4.eu-west-3.rds.amazonaws.com",
  database: "testloop-dev",
  password: "pioeiufrevddcda",
  port: 5432,
});

async function insertRunToDB(runId, startDate) {
  return new Promise(async (resolve) => {
    const runQuery = {
      text: "INSERT INTO run(id, date_started) VALUES($1, $2)",
      values: [runId, startDate],
    };
    resolve(await executeQueries([runQuery]));
  });
}

async function insertScenariosToDB(requestIDs, runId) {
  return new Promise(async (resolve) => {
    const queries = [];
    requestIDs.forEach((obj) => {
      const scenarioQuery = {
        text: "INSERT INTO scenario(id, date_started, result, run_id) VALUES($1, $2, $3, $4)",
        values: [obj.requestId, obj.startDate, obj.result, runId],
      };
      queries.push(scenarioQuery);
    });
    resolve(await executeQueries(queries));
  });
}

async function executeQueries(queries) {
  for (const query of queries) {
    try {
      await postgresClient.query(query);
    } catch (error) {
      console.error(error);
    }
  }
}

async function updateRunResult(finalStatus, runId) {
  return new Promise(async (resolve) => {
    const updateQuery =
      "UPDATE run SET result = $1, date_finished = $2 WHERE id = $3";
    const values = [finalStatus, Date.now(), runId];
    resolve(await executeUpdateQuery(updateQuery, values));
  });
}

async function executeUpdateQuery(query, values) {
  return new Promise(async (resolve) => {
    try {
      const res = await postgresClient.query(query, values);
      resolve(res);
    } catch (err) {
      console.log("error was: ", err);
      console.log("-> Retrying query... ");
      executeUpdateQuery(query, values);
    }
  });
}

const queryDB = async (runId) => {
  return new Promise(async (resolve) => {
    const getPerRunId =
      "SELECT * FROM scenario WHERE run_id=$1 AND result != $2";
    const values = [runId, "running"];

    resolve(executeQuery(getPerRunId, values));
    async function executeQuery(query, values) {
      return new Promise(async (resolve) => {
        try {
          const res = await postgresClient.query(query, values);
          resolve(res);
        } catch (err) {
          console.log("error was: ", err);
        }
      });
    }
  });
};

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
  insertRunToDB,
  insertScenariosToDB,
  executeQueries,
  syncFilesToS3,
  uploadFileToS3,
  queryDB,
  updateRunResult,
  postgresClient,
};
