const debug = require('debug');

const TAGS = {
  s3: 's3',
  throttling: 'THROTTLING',
  tags: 'TAGS',
};

module.exports = {
  debugS3: debug(TAGS.s3),
  debugThrottling: debug(TAGS.throttling),
  debugTags: debug(TAGS.tags),
};
