const { getLogger } = require('../logger/logger');
const { sendCommandToEcs } = require('./taskProcessor');
const { wait } = require('../utils/helper');

class ECSThrottler {
  constructor(maxConcurrentTasks) {
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.currentTasks = 0;
    this.logger = getLogger();
  }

  hasCapacity() {
    return this.currentTasks < this.maxConcurrentTasks;
  }

  incrementTaskCount() {
    if (this.currentTasks < this.maxConcurrentTasks) {
      this.currentTasks++;
    } else {
      throw new Error('Attempting to exceed maximum concurrent ECS tasks');
    }
  }

  decrementTaskCount() {
    if (this.currentTasks > 0) {
      this.currentTasks--;
    } else {
      this.logger.warning('Attempting to decrement task count below zero');
    }
  }

  async waitForCapacity() {
    while (!this.hasCapacity()) {
      await wait(5000); // Wait for 5 seconds before checking again
      this.logger.info('Waiting for available capacity to run more ECS tasks');
    }
  }

  async monitorTasks(taskPromises) {
    const results = await Promise.allSettled(taskPromises);
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        this.logger.info('Task completed successfully');
      } else {
        this.logger.error('Task failed or was rejected');
      }
      this.decrementTaskCount();
    });
  }
}

module.exports = ECSThrottler;
