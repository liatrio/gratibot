const schedule = require('node-schedule');
const winston = require('../winston');

// store active jobs so they can be referenced later
const activeJobs = {};

// schedule a job with a cron expression
function scheduleJob(name, cronExpression, jobFunction) {
  // cancel existing job with this name if it exists
  if (activeJobs[name]) {
    activeJobs[name].cancel();
    winston.info(`cancelled existing scheduled job: ${name}`, {
      func: 'service.scheduler.scheduleJob',
    });
  }

  // schedule new job
  const job = schedule.scheduleJob(name, cronExpression, jobFunction);
  activeJobs[name] = job;

  winston.info(`scheduled new job: ${name} with cron: ${cronExpression}`, {
    func: 'service.scheduler.scheduleJob',
  });

  return job;
}

// cancel a scheduled job by name
function cancelJob(name) {
  if (activeJobs[name]) {
    const result = activeJobs[name].cancel();
    delete activeJobs[name];

    winston.info(`cancelled scheduled job: ${name}`, {
      func: 'service.scheduler.cancelJob',
    });

    return result;
  }
  
  return false;
}

// get list of all active jobs
function getActiveJobs() {
  return Object.keys(activeJobs);
}

module.exports = {
  scheduleJob,
  cancelJob,
  getActiveJobs,
};
