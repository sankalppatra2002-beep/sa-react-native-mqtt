import { NativeEventEmitter, NativeModules } from 'react-native';

const { Mqtt: NativeMqtt } = NativeModules;
const emitter = new NativeEventEmitter(NativeMqtt);

// ─── Connection states ────────────────────────────────────────────────────────
export const ConnectionState = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTING: 'disconnecting',
  ERROR: 'error',
});

// ─── Internal logger ──────────────────────────────────────────────────────────
function createLogger(debug) {
  const prefix = '[sa-react-native-mqtt]';
  return {
    log: (...args) => debug && console.log(prefix, ...args),
    warn: (...args) => debug && console.warn(prefix, ...args),
    error: (...args) => debug && console.error(prefix, ...args),
  };
}

// ─── MqttClient ───────────────────────────────────────────────────────────────
class MqttClient {
  /**
   * @param {import('./index.d.ts').MqttClientOptions} options
   * @param {string} clientRef
   */
  constructor(options, clientRef) {
    this.options = options;
    this.clientRef = clientRef;
    this._handlers = {};
    this._state = ConnectionState.DISCONNECTED;
    this._logger = createLogger(options.debug === true);
    this._logger.log('Client created', clientRef);
  }

  // ── Event registration ───────────────────────────────────────────────────

  /**
   * Register a callback for an MQTT event.
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (typeof callback !== 'function') return;

    const current = this._handlers[event];
    if (!current) {
      this._handlers[event] = [callback];
      return;
    }

    if (Array.isArray(current)) {
      if (!current.includes(callback)) current.push(callback);
      return;
    }

    if (current !== callback) {
      this._handlers[event] = [current, callback];
    }
  }

  /**
   * Remove the callback for an MQTT event.
   * @param {string} event
   * @param {Function} [callback]
   */
  off(event, callback) {

    if (!event) return;

    const current = this._handlers[event];

    if (!current) return;

    if (callback) {
      if (Array.isArray(current)) {
        const next = current.filter((handler) => handler !== callback);
        if (next.length > 0) {
          this._handlers[event] = next;
        } else {
          delete this._handlers[event];
        }
      } else if (current === callback) {
        delete this._handlers[event];
      }
      return;
    }

    delete this._handlers[event];
  }

  // ── Internal dispatcher ──────────────────────────────────────────────────

  _dispatch(data) {
    if (!data || data.clientRef !== this.clientRef || !data.event) return;

    // Track state
    switch (data.event) {
      case 'connecting': this._state = ConnectionState.CONNECTING; break;
      case 'connect': this._state = ConnectionState.CONNECTED; break;
      case 'reconnecting': this._state = ConnectionState.RECONNECTING; break;
      case 'closing': this._state = ConnectionState.DISCONNECTING; break;
      case 'closed': this._state = ConnectionState.DISCONNECTED; break;
      case 'error': this._state = ConnectionState.ERROR; break;
      default: break;
    }

    this._logger.log('Event:', data.event, data.message);

    const handlers = this._handlers[data.event];


    if (!handlers) return;

    const invokeHandler = (handler) => {
      // Auto-deserialize JSON for "message" events when json option is enabled
      if (data.event === 'message' && this.options.json) {
        const normalized = _normalizeMessage(data.message, data);
        const payload = normalized.data;

        if (typeof payload === 'string') {
          normalized.data = _tryParseJson(payload);
        }

        handler(normalized);
      } else {
        handler(data.message);
      }
    };

    if (Array.isArray(handlers)) {
      handlers.slice().forEach(invokeHandler);
    } else {
      invokeHandler(handlers);
    }
  }

  // ── Connection state ─────────────────────────────────────────────────────

  /**
   * Returns the current connection state string.
   * @returns {string}
   */
  getState() {
    return this._state;
  }

  /**
   * Returns true when the native client reports it is connected.
   * @returns {Promise<boolean>}
   */
  isConnected() {
    return NativeMqtt.isConnected(this.clientRef);
  }

  /**
   * Returns true when the client is subscribed to the given topic.
   * @param {string} topic
   * @returns {Promise<boolean>}
   */
  isSubbed(topic) {
    if (!topic || typeof topic !== 'string') {
      return Promise.reject(new Error('isSubbed: topic must be a non-empty string'));
    }
    return NativeMqtt.isSubbed(this.clientRef, topic);
  }

  /**
   * Returns all currently subscribed topics.
   * @returns {Promise<Array<{topic: string, qos: number}>>}
   */
  getTopics() {
    return NativeMqtt.getTopics(this.clientRef);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  connect() {
    this._logger.log('Connecting…');
    NativeMqtt.connect(this.clientRef);
  }

  disconnect() {
    this._logger.log('Disconnecting…');
    this._state = ConnectionState.DISCONNECTING;
    NativeMqtt.disconnect(this.clientRef);
  }

  reconnect() {
    this._logger.log('Reconnecting…');
    this._state = ConnectionState.RECONNECTING;
    NativeMqtt.reconnect(this.clientRef);
  }

  // ── Subscribe / Unsubscribe ──────────────────────────────────────────────

  /**
   * Subscribe to a single topic or an array of topics.
   *
   * Single:  client.subscribe('home/temp', 1)
   * Batch:   client.subscribe([{ topic: 'home/temp', qos: 1 }, { topic: 'home/hum', qos: 0 }])
   * Timeout: client.subscribe('home/temp', 1, { timeoutMs: 5000 })
   *
   * @param {string | Array<{topic: string, qos?: number}>} topicOrList
   * @param {number} [qos=0]
   * @param {{ timeoutMs?: number }} [opts={}]
   * @returns {Promise<void>}
   */
  subscribe(topicOrList, qos = 0, opts = {}) {
    const entries = _normalizeTopicList(topicOrList, qos);

    if (entries.length === 0) {
      return Promise.reject(new Error('subscribe: at least one topic is required'));
    }

    const work = entries.map(({ topic, qos: q }) => {
      if (!topic || typeof topic !== 'string') {
        return Promise.reject(new Error(`subscribe: invalid topic "${topic}"`));
      }
      this._logger.log(`Subscribe → ${topic} (qos=${q})`);
      NativeMqtt.subscribe(this.clientRef, topic, q);
      return Promise.resolve();
    });

    const all = Promise.all(work).then(() => undefined);
    return opts.timeoutMs ? _withTimeout(all, opts.timeoutMs, 'subscribe') : all;
  }

  /**
   * Unsubscribe from a single topic or an array of topics.
   *
   * Single: client.unsubscribe('home/temp')
   * Batch:  client.unsubscribe(['home/temp', 'home/hum'])
   *
   * @param {string | string[]} topicOrList
   * @param {{ timeoutMs?: number }} [opts={}]
   * @returns {Promise<void>}
   */
  unsubscribe(topicOrList, opts = {}) {
    const topics = Array.isArray(topicOrList) ? topicOrList : [topicOrList];

    if (topics.length === 0) {
      return Promise.reject(new Error('unsubscribe: at least one topic is required'));
    }

    const work = topics.map((topic) => {
      if (!topic || typeof topic !== 'string') {
        return Promise.reject(new Error(`unsubscribe: invalid topic "${topic}"`));
      }
      this._logger.log(`Unsubscribe → ${topic}`);
      NativeMqtt.unsubscribe(this.clientRef, topic);
      return Promise.resolve();
    });

    const all = Promise.all(work).then(() => undefined);
    return opts.timeoutMs ? _withTimeout(all, opts.timeoutMs, 'unsubscribe') : all;
  }

  // ── Publish ──────────────────────────────────────────────────────────────

  /**
   * Publish a message. When `options.json` is true, objects are automatically
   * serialized; pass `json: false` in opts to override per-call.
   *
   * @param {string} topic
   * @param {string | object} payload
   * @param {number} [qos=0]
   * @param {boolean} [retain=false]
   * @param {{ json?: boolean, timeoutMs?: number }} [opts={}]
   * @returns {Promise<void>}
   */
  publish(topic, payload, qos = 0, retain = false, opts = {}) {
    if (!topic || typeof topic !== 'string') {
      return Promise.reject(new Error('publish: topic must be a non-empty string'));
    }

    const useJson = opts.json !== undefined ? opts.json : (this.options.json === true);
    let serialized;

    if (useJson && typeof payload === 'object' && payload !== null) {
      try {
        serialized = JSON.stringify(payload);
      } catch (e) {
        return Promise.reject(
          new Error(`publish: failed to serialize payload to JSON — ${e.message}`)
        );
      }
    } else if (typeof payload !== 'string') {
      return Promise.reject(
        new Error(`publish: payload must be a string (or an object when json mode is enabled)`)
      );
    } else {
      serialized = payload;
    }

    this._logger.log(`Publish → ${topic} (qos=${qos}, retain=${retain})`, serialized);
    NativeMqtt.publish(this.clientRef, topic, serialized, qos, retain);

    const work = new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    return opts.timeoutMs ? _withTimeout(work, opts.timeoutMs, 'publish') : work;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize a topic/qos argument into a uniform array of { topic, qos } entries.
 * @param {string | Array<string | {topic: string, qos?: number}>} topicOrList
 * @param {number} defaultQos
 * @returns {Array<{topic: string, qos: number}>}
 */
function _normalizeTopicList(topicOrList, defaultQos) {
  if (typeof topicOrList === 'string') {
    return [{ topic: topicOrList, qos: defaultQos }];
  }
  if (Array.isArray(topicOrList)) {
    return topicOrList.map((item) => {
      if (typeof item === 'string') return { topic: item, qos: defaultQos };
      if (item && typeof item.topic === 'string') {
        return { topic: item.topic, qos: item.qos !== undefined ? item.qos : defaultQos };
      }
      return { topic: String(item), qos: defaultQos };
    });
  }
  return [];
}

/**
 * Wrap a Promise with a timeout.
 * @param {Promise<any>} promise
 * @param {number} ms
 * @param {string} operation
 */
function _withTimeout(promise, ms, operation) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${operation}: timed out after ${ms}ms`));
    }, ms);

    promise.then(() => {
      clearTimeout(timeout);
      resolve();
    }).catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function _normalizeMessage(message, eventData = {}) {
  if (message && typeof message === 'object' && !Array.isArray(message)) {
    return {
      topic: message.topic ?? eventData.topic ?? '',
      data: message.data ?? message.payload ?? null,
      retain: message.retain ?? false,
      qos: message.qos ?? 0,
    };
  }

  return {
    topic: eventData.topic ?? '',
    data: message ?? null,
    retain: false,
    qos: 0,
  };
}

function _tryParseJson(value) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

// ─── mqtt namespace ───────────────────────────────────────────────────────────

const mqtt = {
  _clients: [],
  _eventSub: null,

  /**
   * Create a new MQTT client.
   *
   * @param {import('./index.d.ts').MqttClientOptions} options
   * @returns {Promise<MqttClient>}
   */
  async createClient(options) {
    if (!options || typeof options !== 'object') {
      throw new Error('createClient: options object is required');
    }

    // URI parsing — supports mqtt://, mqtts://, ws://, wss://
    if (options.uri) {
      const pattern = /^((mqtt[s]?|ws[s]?)?:(\/\/)([0-9a-zA-Z_.\-]*):?(\d+))$/;
      const matches = options.uri.match(pattern);
      if (!matches) {
        throw new Error(
          `createClient: URI "${options.uri}" doesn't match a known protocol ` +
          `(mqtt://, mqtts://, ws://, wss://).`
        );
      }
      const protocol = matches[2];
      options = {
        ...options,
        host: matches[4],
        port: parseInt(matches[5], 10),
        protocol: 'tcp',
      };
      if (protocol === 'mqtts' || protocol === 'wss') options.tls = true;
      if (protocol === 'ws' || protocol === 'wss') options.protocol = 'ws';
    }

    if (!options.clientId) {
      throw new Error('createClient: clientId is required');
    }

    const clientRef = await NativeMqtt.createClient(options);
    const client = new MqttClient(options, clientRef);

    if (this._eventSub === null) {
      this._eventSub = emitter.addListener('mqtt_events', (data) => {
        this._clients.forEach((c) => c._dispatch(data));
      });
    }

    this._clients.push(client);
    return client;
  },

  /**
   * Remove and clean up a client.
   * @param {MqttClient} client
   */
  removeClient(client) {
    if (!(client instanceof MqttClient)) {
      throw new Error('removeClient: argument must be an MqttClient instance');
    }

    const idx = this._clients.indexOf(client);
    if (idx > -1) this._clients.splice(idx, 1);

    if (this._clients.length === 0 && this._eventSub !== null) {
      this._eventSub.remove();
      this._eventSub = null;
    }

    NativeMqtt.removeClient(client.clientRef);
  },

  /**
   * Disconnect all active clients.
   */
  disconnectAll() {
    NativeMqtt.disconnectAll();
  },
};

export default mqtt;
export { MqttClient };
