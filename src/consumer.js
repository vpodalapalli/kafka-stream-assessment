const { Kafka } = require('kafkajs');
const Pino = require('pino');
const logger = Pino();
const config = require('./config');
class Consumer {
  constructor(onMessage) {
    this.kafka = new Kafka({ brokers: config.kafkaBrokers });
    this.consumer = this.kafka.consumer({ groupId: config.groupId });
    this.onMessage = onMessage;
  }
  async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: config.inputTopic, fromBeginning: false });
    logger.info({ topic: config.inputTopic }, 'Consumer subscribed');
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const key = message.key ? message.key.toString() : null;
          const value = message.value ? message.value.toString() : null;
          const timestamp = message.timestamp ? Number(message.timestamp) : Date.now();
          await this.onMessage({ key, value, timestamp, raw: message });
        } catch (err) {
          logger.error(err, 'Error processing message');
        }
      },
    });
  }
  async stop() {
    await this.consumer.disconnect();
  }
}
module.exports = Consumer;
