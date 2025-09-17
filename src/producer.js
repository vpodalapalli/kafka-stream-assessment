const { Kafka } = require('kafkajs');
const logger = require('pino')();
const config = require('./config');
class Producer {
  constructor() {
    this.kafka = new Kafka({ brokers: config.kafkaBrokers });
    this.producer = this.kafka.producer();
    this.started = false;
  }
  async start() {
    if (!this.started) {
      await this.producer.connect();
      this.started = true;
      logger.info('Producer connected');
    }
  }
  async send(topic, messages) {
    if (!this.started) await this.start();
    try {
      await this.producer.send({ topic, messages });
      logger.debug({ topic, messages }, 'Produced messages');
    } catch (err) {
      logger.error(err, 'Producer send failed');
      throw err;
    }
  }
  async stop() {
    if (this.started) {
      await this.producer.disconnect();
      this.started = false;
    }
  }
}
module.exports = Producer;
