const app = require('./app');
const config = require('./config');
const logger = require('./shared/loggers/logger');

const { startEmailWorker } = require('./shared/email/service');

app.listen(config.port, () => logger.info(`Server listening on http://localhost:${config.port}`));

// Seeds default email templates, then sends queued emails and check-in reminders.
startEmailWorker();
