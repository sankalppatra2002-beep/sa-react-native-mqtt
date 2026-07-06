/**
 * sa-react-native-mqtt — TypeScript declarations
 * @version 1.2.0
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

/** MQTT Quality of Service level. */
export type QoS = 0 | 1 | 2;

// ─── Connection state ─────────────────────────────────────────────────────────

/**
 * All possible connection state strings returned by `client.getState()` and
 * the `connectionState` field of `useMqtt()`.
 */
export declare const ConnectionState: {
  readonly DISCONNECTED: 'disconnected';
  readonly CONNECTING: 'connecting';
  readonly CONNECTED: 'connected';
  readonly RECONNECTING: 'reconnecting';
  readonly DISCONNECTING: 'disconnecting';
  readonly ERROR: 'error';
};

export type ConnectionStateValue =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnecting'
  | 'error';

// ─── Client options ───────────────────────────────────────────────────────────

export interface MqttClientOptions {
  /**
   * Convenience URI — overrides `host`, `port`, `protocol`, and `tls`.
   * Accepted schemes: `mqtt://`, `mqtts://`, `ws://`, `wss://`
   * @example 'mqtt://broker.hivemq.com:1883'
   */
  uri?: string;

  /** Broker hostname or IP address. */
  host?: string;

  /** Broker port number. */
  port?: number;

  /**
   * Unique client identifier (required).
   * @example 'my-app-client-1'
   */
  clientId: string;

  /** Transport protocol. Derived automatically from `uri` when set. */
  protocol?: 'tcp' | 'ws' | 'wss' | 'mqtt' | 'mqtts';

  /** Enable TLS/SSL. Derived automatically from `uri` when `mqtts://` or `wss://` is used. */
  tls?: boolean;

  /** Keep-alive interval in seconds (default: 60). */
  keepalive?: number;

  /** MQTT protocol version (default: 4 = 3.1.1). */
  protocolLevel?: 3 | 4 | 5;

  /** Start a clean session (default: true). */
  clean?: boolean;

  /** Enable username/password authentication. */
  auth?: boolean;

  /** Username (requires `auth: true`). */
  user?: string;

  /** Password (requires `auth: true`). */
  pass?: string;

  /** Send a last-will message on unexpected disconnect. */
  will?: boolean;

  /** Last-will message payload. */
  willMsg?: string;

  /** Last-will topic. */
  willtopic?: string;

  /** Last-will QoS level. */
  willQos?: QoS;

  /** Retain the last-will message. */
  willRetainFlag?: boolean;

  /** Let the broker automatically reconnect on connection loss. */
  automaticReconnect?: boolean;

  /** Base64-encoded PKCS#12 client certificate for mutual TLS. */
  certificate?: string;

  /** Password for the PKCS#12 certificate. */
  certificatePass?: string;

  /** Base64-encoded DER CA certificate for server verification. */
  ca?: string;

  /**
   * Enable automatic JSON serialization on `publish()` and deserialization
   * on received `message` events. Can be overridden per-call.
   * @default false
   */
  json?: boolean;

  /**
   * Log internal events and operations to the console.
   * @default false
   */
  debug?: boolean;
}

// ─── Messages & topics ────────────────────────────────────────────────────────

/** Inbound MQTT message. When `json` mode is active, `data` is already parsed. */
export interface MqttMessage {
  /** Topic the message was received on. */
  topic: string;
  /**
   * Message payload. A plain string in normal mode; a parsed value when
   * `json` mode is enabled on the client or for the specific publish call.
   */
  data: string | unknown;
  /** Quality of service level. */
  qos: QoS;
  /** Whether this is a retained message. */
  retain: boolean;
}

/** Entry returned by `client.getTopics()`. */
export interface TopicEntry {
  topic: string;
  qos: QoS;
}

/** Item for batch subscribe — topic with optional per-topic QoS override. */
export interface TopicSubscription {
  topic: string;
  /** Defaults to the `qos` argument passed to `subscribe()`. */
  qos?: QoS;
}

// ─── Event map ────────────────────────────────────────────────────────────────

export type MqttEventMap = {
  /** Emitted when the connection is fully established. */
  connect: { reconnect: boolean };
  /** Emitted when the connection is closed cleanly. */
  closed: string;
  /** Emitted while the connection is closing. */
  closing: string;
  /** Emitted while the initial connection attempt is in progress. */
  connecting: string;
  /** Emitted when an automatic reconnection attempt starts. */
  reconnecting: string;
  /** Emitted on any connection or protocol error. */
  error: string;
  /** Emitted for every inbound message. */
  message: MqttMessage;
  /** Emitted when a published message delivery is confirmed (iOS). */
  msgSent: string;
};

// ─── Per-call options ─────────────────────────────────────────────────────────

export interface PublishOptions {
  /**
   * Override the client-level `json` setting for this call only.
   * When `true`, objects are serialized; when `false`, raw strings are sent.
   */
  json?: boolean;
  /** Reject if the native layer does not confirm within this many milliseconds. */
  timeoutMs?: number;
}

export interface SubscribeOptions {
  /** Reject if the subscribe ACK is not received within this many milliseconds. */
  timeoutMs?: number;
}

// ─── MqttClient ───────────────────────────────────────────────────────────────

export interface MqttClient {
  /** Native client identifier assigned by the broker layer. */
  readonly clientRef: string;

  /** The resolved options used to create this client. */
  readonly options: MqttClientOptions;

  // ── Events ──────────────────────────────────────────────────────────────

  /**
   * Register a callback for an MQTT lifecycle or message event.
   * Calling `on()` again for the same event replaces the previous callback.
   */
  on<E extends keyof MqttEventMap>(
    event: E,
    callback: (msg: MqttEventMap[E]) => void
  ): void;

  /**
   * Remove the callback registered for the given event.
   * When `callback` is omitted, all listeners for the event are removed.
   */
  off<E extends keyof MqttEventMap>(event: E, callback?: (msg: MqttEventMap[E]) => void): void;

  // ── Connection state ─────────────────────────────────────────────────────

  /**
   * Returns the current connection state as a `ConnectionState` string.
   * This is a synchronous in-memory value updated by incoming events.
   */
  getState(): ConnectionStateValue;

  /**
   * Queries the native layer to confirm whether the client is connected.
   * Prefer `getState()` for reactive UI; use this for one-shot checks.
   */
  isConnected(): Promise<boolean>;

  /**
   * Returns whether the client is currently subscribed to the given topic.
   */
  isSubbed(topic: string): Promise<boolean>;

  /**
   * Returns all topics the client is currently subscribed to.
   */
  getTopics(): Promise<TopicEntry[]>;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /** Open the MQTT connection. Listen for the `connect` event to confirm. */
  connect(): void;

  /** Gracefully close the connection. */
  disconnect(): void;

  /** Trigger a manual reconnection attempt. */
  reconnect(): void;

  // ── Subscribe / Unsubscribe ──────────────────────────────────────────────

  /**
   * Subscribe to a single topic.
   * @param topic   Topic filter (supports `+` and `#` wildcards).
   * @param qos     Quality of service (default: 0).
   * @param options Optional timeout.
   */
  subscribe(topic: string, qos?: QoS, options?: SubscribeOptions): Promise<void>;

  /**
   * Batch subscribe to multiple topics.
   * @param topics  Array of topic strings (all use the `qos` argument) or
   *                `TopicSubscription` objects with per-topic QoS overrides.
   * @param qos     Default QoS when items are plain strings (default: 0).
   * @param options Optional timeout.
   */
  subscribe(
    topics: Array<string | TopicSubscription>,
    qos?: QoS,
    options?: SubscribeOptions
  ): Promise<void>;

  /**
   * Unsubscribe from a single topic.
   * @param topic   Topic to unsubscribe from.
   * @param options Optional timeout.
   */
  unsubscribe(topic: string, options?: SubscribeOptions): Promise<void>;

  /**
   * Batch unsubscribe from multiple topics.
   * @param topics  Array of topic strings.
   * @param options Optional timeout.
   */
  unsubscribe(topics: string[], options?: SubscribeOptions): Promise<void>;

  // ── Publish ──────────────────────────────────────────────────────────────

  /**
   * Publish a message.
   *
   * When `options.json` is `true` (or `clientOptions.json` is `true`), `payload`
   * may be any JSON-serializable value and will be automatically stringified.
   * The receiver will have the raw JSON string in `message.data` unless their
   * client also has `json` mode enabled, in which case it is parsed automatically.
   *
   * @param topic   Topic to publish to.
   * @param payload Message payload — a string, or any object when JSON mode is active.
   * @param qos     Quality of service (default: 0).
   * @param retain  Whether the broker should retain the message (default: false).
   * @param options Per-call JSON override and optional timeout.
   */
  publish(
    topic: string,
    payload: string | object,
    qos?: QoS,
    retain?: boolean,
    options?: PublishOptions
  ): Promise<void>;
}

// ─── mqtt namespace ───────────────────────────────────────────────────────────

declare const mqtt: {
  /**
   * Create a new MQTT client.
   *
   * The returned client is not yet connected; call `client.connect()` to
   * open the connection, or pass `connectOnMount: true` to `useMqtt()`.
   *
   * @throws {Error} when `clientId` is missing or the URI is malformed.
   */
  createClient(options: MqttClientOptions): Promise<MqttClient>;

  /**
   * Destroy a client and release its native resources. Always call this
   * when the client is no longer needed to avoid memory leaks.
   *
   * @throws {Error} when the argument is not an `MqttClient` instance.
   */
  removeClient(client: MqttClient): void;

  /**
   * Disconnect all active clients at once (e.g. on app background/close).
   */
  disconnectAll(): void;
};

export default mqtt;
export { MqttClient };
