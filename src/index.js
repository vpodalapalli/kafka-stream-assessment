const Producer = require('./producer');
const Consumer = require('./consumer');
const Processor = require('./processor');
const config = require('./config');
const logger = require('pino')();
(async () => {
  const producer = new Producer();
  const proc = new Processor(producer);
  const consumer = new Consumer(async (msg) => {
    try {
      await proc.onMessage({ key: msg.key, value: msg.value, timestamp: msg.timestamp });
    } catch (err) {
      logger.error(err, 'Processing error');
    }
  });
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down');
    await consumer.stop();
    proc.stop();
    await producer.stop();
    process.exit(0);
  });
  try {
    await producer.start();
    await proc.start();
    await consumer.start();
    logger.info('Kafka stream processor started', { inputTopic: config.inputTopic, outputTopic: config.outputTopic });
  } catch (err) {
    logger.error(err, 'Startup failed');
    process.exit(1);
  }
})();