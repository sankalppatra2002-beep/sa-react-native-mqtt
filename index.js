import { NativeEventEmitter, NativeModules } from 'react-native';

const { Mqtt: NativeMqtt } = NativeModules;
const emitter = new NativeEventEmitter(NativeMqtt);

class MqttClient {
  constructor(options, clientRef) {
    this.options = options;
    this.clientRef = clientRef;
    this._handlers = {};
  }

  on(event, callback) {
    this._handlers[event] = callback;
  }

  _dispatch(data) {
    if (data && data.clientRef === this.clientRef && data.event) {
      const handler = this._handlers[data.event];
      if (handler) handler(data.message);
    }
  }

  connect() {
    NativeMqtt.connect(this.clientRef);
  }

  disconnect() {
    NativeMqtt.disconnect(this.clientRef);
  }

  subscribe(topic, qos) {
    NativeMqtt.subscribe(this.clientRef, topic, qos);
  }

  unsubscribe(topic) {
    NativeMqtt.unsubscribe(this.clientRef, topic);
  }

  publish(topic, payload, qos, retain) {
    NativeMqtt.publish(this.clientRef, topic, payload, qos, retain);
  }

  reconnect() {
    NativeMqtt.reconnect(this.clientRef);
  }

  isConnected() {
    return NativeMqtt.isConnected(this.clientRef);
  }

  getTopics() {
    return NativeMqtt.getTopics(this.clientRef);
  }

  isSubbed(topic) {
    return NativeMqtt.isSubbed(this.clientRef, topic);
  }
}

const mqtt = {
  _clients: [],
  _eventSub: null,

  async createClient(options) {
    if (options.uri) {
      const pattern = /^((mqtt[s]?|ws[s]?)?:(\/\/)([0-9a-zA-Z_.\-]*):?(\d+))$/;
      const matches = options.uri.match(pattern);
      if (!matches) {
        throw new Error(
          `Uri "${options.uri}" doesn't match a known protocol (mqtt://, mqtts://, ws://, wss://).`
        );
      }
      const protocol = matches[2];
      options.host = matches[4];
      options.port = parseInt(matches[5], 10);
      options.protocol = 'tcp';

      if (protocol === 'wss' || protocol === 'mqtts') options.tls = true;
      if (protocol === 'ws' || protocol === 'wss') options.protocol = 'ws';
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

  removeClient(client) {
    const idx = this._clients.indexOf(client);
    if (idx > -1) this._clients.splice(idx, 1);

    if (this._clients.length === 0 && this._eventSub !== null) {
      this._eventSub.remove();
      this._eventSub = null;
    }

    NativeMqtt.removeClient(client.clientRef);
  },

  disconnectAll() {
    NativeMqtt.disconnectAll();
  },
};

export default mqtt;
export { MqttClient };
