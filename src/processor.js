const logger = require('pino')();
const config = require('./config');
class Processor {
  constructor(producer) {
    this.producer = producer;
    this.windowMs = config.windowMs;
    this.flushIntervalMs = config.flushIntervalMs;
    this.currentWindowStart = this._floorWindow(Date.now());
    this.counts = new Map();
    this.flushHandle = null;
  }
  _floorWindow(ts) {
    return Math.floor(ts / this.windowMs) * this.windowMs;
  }
  async start() {
    this.flushHandle = setInterval(() => this._maybeFlush(), this.flushIntervalMs);
  }
  stop() {
    if (this.flushHandle) clearInterval(this.flushHandle);
  }
  async onMessage({ key, value, timestamp }) {
    const k = key || 'NO_KEY';
    const msgTs = timestamp || Date.now();
    const windowStart = this._floorWindow(msgTs);
    if (windowStart > this.currentWindowStart) {
      await this._flushWindow(this.currentWindowStart);
      this.counts = new Map();
      this.currentWindowStart = windowStart;
    }
    const prev = this.counts.get(k) || 0;
    this.counts.set(k, prev + 1);
  }
  async _maybeFlush() {
    const nowWindow = this._floorWindow(Date.now());
    if (nowWindow > this.currentWindowStart) {
      await this._flushWindow(this.currentWindowStart);
      this.counts = new Map();
      this.currentWindowStart = nowWindow;
    }
  }
  async _flushWindow(windowStart) {
    if (!this.counts || this.counts.size === 0) return;
    const records = [];
    for (const [key, count] of this.counts.entries()) {
      const payload = { windowStart, windowEnd: windowStart + this.windowMs, key, count };
      records.push({ key: String(key), value: JSON.stringify(payload) });
    }
    if (records.length > 0) {
      try {
        await this.producer.send(config.outputTopic, records);
        logger.info({ windowStart, recordsCount: records.length }, 'Flushed window');
      } catch (err) {
        logger.error(err, 'Failed to flush window');
      }
    }
  }
}
module.exports = Processor;
