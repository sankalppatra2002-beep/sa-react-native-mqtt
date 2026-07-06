/**
 * sa-react-native-mqtt — React Hooks type declarations
 * @version 1.2.0
 */

import type {
  MqttClient,
  MqttClientOptions,
  MqttMessage,
  QoS,
  ConnectionStateValue,
} from './index.d.ts';

// ─── useMqtt ─────────────────────────────────────────────────────────────────

export interface UseMqttOptions {
  /**
   * Automatically call `client.connect()` after the client is created.
   * @default false
   */
  connectOnMount?: boolean;
}

export interface UseMqttResult {
  /**
   * The created `MqttClient` instance, or `null` while creation is in progress
   * or after the component unmounts.
   */
  client: MqttClient | null;

  /**
   * Current connection state string — one of the `ConnectionState` constants.
   */
  connectionState: ConnectionStateValue;

  /** `true` when `connectionState === 'connected'`. Convenience shorthand. */
  isConnected: boolean;

  /** The most recently received message across all subscribed topics, or `null`. */
  lastMessage: MqttMessage | null;

  /** Last error message string, or `null` when no error has occurred. */
  error: string | null;

  /** Call `client.connect()` imperatively. Safe to call before the client is ready. */
  connect: () => void;

  /** Call `client.disconnect()` imperatively. Safe to call before the client is ready. */
  disconnect: () => void;
}

/**
 * Create, manage, and automatically clean up an MQTT client.
 *
 * The client is created once on mount. Options are captured at mount time and
 * changes are **not** reactive — remount the component to use new options.
 *
 * @param options     MQTT connection options (same as `mqtt.createClient`).
 * @param hookOptions Hook-level options.
 *
 * @example
 * function App() {
 *   const { client, isConnected, lastMessage, connect } = useMqtt(
 *     { uri: 'mqtt://broker.hivemq.com:1883', clientId: 'my-app', debug: true },
 *     { connectOnMount: true }
 *   );
 *
 *   return <Text>{isConnected ? 'Online' : 'Offline'}</Text>;
 * }
 */
export function useMqtt(
  options: MqttClientOptions,
  hookOptions?: UseMqttOptions
): UseMqttResult;

// ─── useSubscription ─────────────────────────────────────────────────────────

export interface UseSubscriptionResult {
  /**
   * The most recently received message that matches the subscribed topic(s),
   * or `null` until a message arrives.
   */
  message: MqttMessage | null;

  /** Last subscription error, or `null`. */
  error: string | null;
}

/**
 * Subscribe to one or more MQTT topics on an existing client.
 *
 * Automatically subscribes when `client` becomes available and unsubscribes
 * on cleanup. Supports MQTT wildcards (`+` and `#`).
 *
 * @param client  An `MqttClient` instance (e.g. from `useMqtt`). Pass `null`
 *                to defer subscription until the client is ready.
 * @param topics  A single topic string or an array of topic strings.
 * @param qos     Quality of service level (default: 0).
 *
 * @example
 * // Single topic
 * const { message } = useSubscription(client, 'home/temperature', 1);
 *
 * @example
 * // Multiple topics with wildcard
 * const { message } = useSubscription(client, ['home/+/temp', 'sensors/#']);
 */
export function useSubscription(
  client: MqttClient | null,
  topics: string | string[],
  qos?: QoS
): UseSubscriptionResult;

// ─── usePublish ───────────────────────────────────────────────────────────────

export interface UsePublishResult {
  /**
   * Stable publish function bound to the provided client.
   *
   * Parameters mirror `client.publish()` — see `MqttClient.publish` for
   * full documentation including JSON mode behaviour.
   */
  publish: (
    topic: string,
    payload: string | object,
    qos?: QoS,
    retain?: boolean,
    opts?: { json?: boolean; timeoutMs?: number }
  ) => Promise<void>;

  /** Last publish error message, or `null`. */
  error: string | null;
}

/**
 * Returns a stable `publish` function bound to the given client.
 *
 * The returned `publish` reference is guaranteed to be stable across renders
 * (safe to pass as a prop or use as an effect dependency without causing
 * unnecessary re-renders).
 *
 * @param client  An `MqttClient` instance. Pass `null` to obtain the hook
 *                before the client is available — calls will reject with an
 *                error until a real client is provided.
 *
 * @example
 * const { publish, error } = usePublish(client);
 *
 * // Plain string
 * await publish('sensors/cmd', 'on', 1);
 *
 * // Auto-serialized object (requires json mode on the client or per-call)
 * await publish('sensors/data', { temp: 22.5 }, 1, false, { json: true });
 */
export function usePublish(client: MqttClient | null): UsePublishResult;
