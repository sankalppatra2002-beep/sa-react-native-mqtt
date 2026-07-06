/**
 * sa-react-native-mqtt — React Hooks
 *
 * Provides three hooks built on top of the core mqtt API:
 *   - useMqtt()          full client lifecycle + message handling
 *   - useSubscription()  subscribe to a topic and receive messages
 *   - usePublish()       publish helper tied to a client
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import mqtt, { ConnectionState } from './index.js';

// ─── useMqtt ─────────────────────────────────────────────────────────────────

/**
 * Create, manage, and automatically clean up an MQTT client.
 *
 * @param {import('./index.d.ts').MqttClientOptions} options
 * @param {{ connectOnMount?: boolean }} [hookOptions]
 *
 * @returns {{
 *   client: import('./index.d.ts').MqttClient | null,
 *   connectionState: string,
 *   isConnected: boolean,
 *   lastMessage: import('./index.d.ts').MqttMessage | null,
 *   error: string | null,
 *   connect: () => void,
 *   disconnect: () => void,
 * }}
 *
 * @example
 * const { client, isConnected, lastMessage, connect, disconnect } = useMqtt({
 *   uri: 'mqtt://broker.hivemq.com:1883',
 *   clientId: 'my-app',
 *   debug: true,
 * });
 */
export function useMqtt(options, hookOptions = {}) {
  const { connectOnMount = false } = hookOptions;

  const [client, setClient] = useState(null);
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);

  // Stable ref so callbacks always see the current client
  const clientRef = useRef(null);
  // Prevent double-init in StrictMode
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;
    let createdClient = null;

    mqtt
      .createClient(options)
      .then((c) => {
        if (!mounted) {
          mqtt.removeClient(c);
          return;
        }

        createdClient = c;
        clientRef.current = c;

        c.on('connecting', () => {
          if (!mounted) return;
          setConnectionState(ConnectionState.CONNECTING);
          setError(null);
        });

        c.on('connect', () => {
          if (!mounted) return;
          setConnectionState(ConnectionState.CONNECTED);
          setError(null);
        });

        c.on('reconnecting', () => {
          if (!mounted) return;
          setConnectionState(ConnectionState.RECONNECTING);
        });

        c.on('closed', () => {
          if (!mounted) return;
          setConnectionState(ConnectionState.DISCONNECTED);
        });

        c.on('closing', () => {
          if (!mounted) return;
          setConnectionState(ConnectionState.DISCONNECTING);
        });

        c.on('error', (msg) => {
          if (!mounted) return;
          setConnectionState(ConnectionState.ERROR);
          setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        });

        c.on('message', (msg) => {
          if (!mounted) return;
          setLastMessage(msg);
        });

        setClient(c);

        if (connectOnMount) c.connect();
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message ?? String(err));
      });

    return () => {
      mounted = false;
      initializedRef.current = false;
      if (createdClient) {
        try {
          createdClient.disconnect();
        } catch {
          // ignore disconnect errors during cleanup
        }
        mqtt.removeClient(createdClient);
        clientRef.current = null;
        setClient(null);
        setConnectionState(ConnectionState.DISCONNECTED);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — options are captured once on mount

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  return {
    client,
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    lastMessage,
    error,
    connect,
    disconnect,
  };
}

// ─── useSubscription ─────────────────────────────────────────────────────────

/**
 * Subscribe to one or more topics on an existing client and receive messages.
 * Automatically subscribes when the client becomes connected and unsubscribes
 * on cleanup or when the topic/qos changes.
 *
 * @param {import('./index.d.ts').MqttClient | null} client
 * @param {string | string[]} topics
 * @param {0 | 1 | 2} [qos=0]
 *
 * @returns {{
 *   message: import('./index.d.ts').MqttMessage | null,
 *   error: string | null,
 * }}
 *
 * @example
 * const { message } = useSubscription(client, 'home/temperature', 1);
 *
 * @example
 * // Multiple topics
 * const { message } = useSubscription(client, ['home/temp', 'home/humidity']);
 */
export function useSubscription(client, topics, qos = 0) {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Stringify so the effect dep comparison works for arrays
  const topicsKey = JSON.stringify(
    Array.isArray(topics) ? [...topics].sort() : topics
  );

  useEffect(() => {
    if (!client) return;

    const topicList = Array.isArray(topics) ? topics : [topics];
    if (topicList.length === 0) return;

    let active = true;

    // Subscribe
    client
      .subscribe(topicList.map((t) => ({ topic: t, qos })))
      .catch((err) => {
        if (active) setError(err?.message ?? String(err));
      });

    // Listen for messages and filter to subscribed topics
    // Listen for messages and filter to subscribed topics
    const handler = (msg) => {
      if (
        active &&
        msg &&
        topicList.some((t) => _topicMatches(t, msg.topic))
      ) {
        setMessage(msg);
      }
    };

    client.on('message', handler);

    return () => {
      active = false;
      client.off('message', handler);
      client.unsubscribe(topicList).catch(() => { });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, topicsKey, qos]);

  return { message, error };
}

// ─── usePublish ───────────────────────────────────────────────────────────────

/**
 * Returns a stable `publish` function bound to the given client.
 *
 * @param {import('./index.d.ts').MqttClient | null} client
 *
 * @returns {{
 *   publish: (
 *     topic: string,
 *     payload: string | object,
 *     qos?: 0 | 1 | 2,
 *     retain?: boolean,
 *     opts?: { json?: boolean, timeoutMs?: number }
 *   ) => Promise<void>,
 *   error: string | null,
 * }}
 *
 * @example
 * const { publish } = usePublish(client);
 * await publish('home/temp', { value: 22.5 }, 1, false, { json: true });
 */
export function usePublish(client) {
  const [error, setError] = useState(null);
  const clientRef = useRef(client);

  // Keep ref in sync so the stable callback always uses the latest client
  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  const publish = useCallback(
    (topic, payload, qos = 0, retain = false, opts = {}) => {
      const c = clientRef.current;
      if (!c) {
        const err = new Error('usePublish: client is not available');
        setError(err.message);
        return Promise.reject(err);
      }

      return c.publish(topic, payload, qos, retain, opts).catch((err) => {
        setError(err?.message ?? String(err));
        throw err;
      });
    },
    [] // stable — uses ref internally
  );

  return { publish, error };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Minimal MQTT topic wildcard matching.
 *   '#' matches everything at and below the current level.
 *   '+' matches exactly one level.
 *
 * @param {string} filter  e.g. 'home/+/temp' or 'home/#'
 * @param {string} topic   e.g. 'home/room1/temp'
 * @returns {boolean}
 */
function _topicMatches(filter, topic) {
  if (filter === topic) return true;

  const fParts = filter.split('/');
  const tParts = topic.split('/');

  for (let i = 0; i < fParts.length; i++) {
    if (fParts[i] === '#') return true;
    if (fParts[i] === '+') continue;
    if (fParts[i] !== tParts[i]) return false;
  }

  return fParts.length === tParts.length;
}
