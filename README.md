# sa-react-native-mqtt

[![npm version](https://img.shields.io/npm/v/sa-react-native-mqtt.svg)](https://www.npmjs.com/package/sa-react-native-mqtt)
[![npm downloads](https://img.shields.io/npm/dt/sa-react-native-mqtt.svg)](https://www.npmjs.com/package/sa-react-native-mqtt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/sankalppatra2002-beep/sa-react-native-mqtt/pulls)

> MQTT client for React Native — native performance, hooks-first DX, full TypeScript support.

---

## Features

- 📱 Works on iOS and Android
- 🔒 SSL/TLS with mutual certificate authentication
- ⚡ Native performance (Eclipse Paho on Android, MQTTClient on iOS)
- 🪝 **React Hooks** — `useMqtt`, `useSubscription`, `usePublish`
- 📦 **Batch subscribe / unsubscribe** in one call
- 🔄 **JSON mode** — automatic payload serialization & deserialization
- 🐛 **Built-in debug logging** via `debug: true`
- ⏱ **Timeouts** on publish and subscribe operations
- 🔌 **Connection state helper** — synchronous `getState()` + `ConnectionState` constants
- 🟦 Full TypeScript support with strict types

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [React Hooks](#react-hooks)
  - [useMqtt](#usemqtt)
  - [useSubscription](#usesubscription)
  - [usePublish](#usepublish)
- [Core API](#core-api)
  - [mqtt.createClient](#mqttcreateclient)
  - [client.subscribe](#clientsubscribe--batch)
  - [client.unsubscribe](#clientunsubscribe--batch)
  - [client.publish](#clientpublish)
  - [client.getState](#clientgetstate)
  - [Events](#events)
- [Options Reference](#options-reference)
- [JSON Mode](#json-mode)
- [Debug Logging](#debug-logging)
- [Connection State](#connection-state)
- [Timeouts](#timeouts)
- [Platform Setup](#platform-setup)
- [Changelog](#changelog)

---

## Installation

```bash
npm install sa-react-native-mqtt
# or
yarn add sa-react-native-mqtt
```

**Version compatibility**

| Dependency   | Minimum version |
|--------------|-----------------|
| React        | 18.0.0          |
| React Native | 0.73.0          |
| iOS          | 12.0            |
| Android API  | 21 (Android 5)  |

---

## Quick Start

```js
import mqtt from 'sa-react-native-mqtt';

const client = await mqtt.createClient({
  uri: 'mqtt://broker.hivemq.com:1883',
  clientId: 'my-app',
});

client.on('connect', () => {
  client.subscribe('home/temperature', 1);
  client.publish('home/cmd', 'hello', 0, false);
});

client.on('message', (msg) => {
  console.log(msg.topic, msg.data);
});

client.connect();
```

---

## React Hooks

Import hooks from the `/hooks` subpath:

```js
import { useMqtt, useSubscription, usePublish } from 'sa-react-native-mqtt/hooks';
```

### useMqtt

Creates, manages, and cleans up an MQTT client for the lifetime of the component.

```jsx
import { useMqtt } from 'sa-react-native-mqtt/hooks';

function StatusBar() {
  const { isConnected, lastMessage, error, connect, disconnect } = useMqtt(
    {
      uri: 'mqtt://broker.hivemq.com:1883',
      clientId: 'my-app',
      debug: true,   // logs to console
      json: true,    // auto-parse incoming JSON
    },
    { connectOnMount: true }  // connect automatically
  );

  return (
    <>
      <Text>{isConnected ? '🟢 Connected' : '🔴 Offline'}</Text>
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      {lastMessage && <Text>{JSON.stringify(lastMessage.data)}</Text>}
    </>
  );
}
```

**Returns**

| Field             | Type                    | Description                                      |
|-------------------|-------------------------|--------------------------------------------------|
| `client`          | `MqttClient \| null`    | The client instance (null until created)         |
| `connectionState` | `ConnectionStateValue`  | Current state string from `ConnectionState`      |
| `isConnected`     | `boolean`               | Shorthand for `connectionState === 'connected'`  |
| `lastMessage`     | `MqttMessage \| null`   | Most recent message across all subscribed topics |
| `error`           | `string \| null`        | Last error message                               |
| `connect`         | `() => void`            | Imperative connect trigger                       |
| `disconnect`      | `() => void`            | Imperative disconnect trigger                    |

**Options** (`hookOptions`)

| Option           | Type      | Default | Description                              |
|------------------|-----------|---------|------------------------------------------|
| `connectOnMount` | `boolean` | `false` | Call `connect()` right after creation    |

---

### useSubscription

Subscribe to one or more topics and receive messages. Automatically unsubscribes on cleanup.

```jsx
import { useMqtt, useSubscription } from 'sa-react-native-mqtt/hooks';

function TemperatureWidget() {
  const { client } = useMqtt(
    { uri: 'mqtt://broker.hivemq.com:1883', clientId: 'widget', json: true },
    { connectOnMount: true }
  );

  // Single topic
  const { message } = useSubscription(client, 'home/temperature', 1);

  // Multiple topics with wildcard
  const { message: sensorMsg } = useSubscription(client, ['home/+/temp', 'sensors/#']);

  return <Text>{message ? `${message.data}°C` : '—'}</Text>;
}
```

**Parameters**

| Parameter | Type                       | Default | Description                                         |
|-----------|----------------------------|---------|-----------------------------------------------------|
| `client`  | `MqttClient \| null`       | —       | Client from `useMqtt`. Pass `null` to defer.        |
| `topics`  | `string \| string[]`       | —       | Topic filter(s). Supports `+` and `#` wildcards.    |
| `qos`     | `0 \| 1 \| 2`              | `0`     | Quality of service level                            |

**Returns** `{ message: MqttMessage | null, error: string | null }`

---

### usePublish

Returns a stable `publish` function that never changes reference — safe to use in `useEffect` dependencies.

```jsx
import { useMqtt, usePublish } from 'sa-react-native-mqtt/hooks';

function ControlPanel() {
  const { client } = useMqtt(
    { uri: 'mqtt://broker.hivemq.com:1883', clientId: 'control' },
    { connectOnMount: true }
  );

  const { publish, error } = usePublish(client);

  const sendCommand = async () => {
    // plain string
    await publish('home/cmd', 'toggle', 1);

    // object — serialize with per-call json option
    await publish('home/data', { value: 42 }, 1, false, { json: true });
  };

  return <Button title="Send" onPress={sendCommand} />;
}
```

**Parameters**

| Parameter | Type                 | Description                                     |
|-----------|----------------------|-------------------------------------------------|
| `client`  | `MqttClient \| null` | Client instance. Calls reject when `null`.      |

**Returns** `{ publish: Function, error: string | null }`

---

## Core API

### mqtt.createClient

```js
const client = await mqtt.createClient(options);
```

Creates a new native MQTT client. The client is **not** connected yet — call `client.connect()` to open the connection.

Throws when `clientId` is missing or the URI is malformed.

---

### client.subscribe — batch

```js
// Single topic
await client.subscribe('home/temp', 1);

// Batch — all at QoS 0
await client.subscribe(['home/temp', 'home/humidity']);

// Batch — per-topic QoS
await client.subscribe([
  { topic: 'home/temp',     qos: 1 },
  { topic: 'home/humidity', qos: 0 },
]);

// With timeout
await client.subscribe('home/temp', 1, { timeoutMs: 5000 });
```

---

### client.unsubscribe — batch

```js
// Single
await client.unsubscribe('home/temp');

// Batch
await client.unsubscribe(['home/temp', 'home/humidity']);

// With timeout
await client.unsubscribe('home/temp', { timeoutMs: 3000 });
```

---

### client.publish

```js
// Plain string
await client.publish('home/cmd', 'on', 1, false);

// JSON object (requires json mode on client or per-call option)
await client.publish('home/data', { temp: 22.5 }, 1, false, { json: true });

// With timeout
await client.publish('home/cmd', 'on', 0, false, { timeoutMs: 3000 });
```

| Parameter | Type                  | Default | Description                                              |
|-----------|-----------------------|---------|----------------------------------------------------------|
| `topic`   | `string`              | —       | Publish topic                                            |
| `payload` | `string \| object`    | —       | Message payload; objects require JSON mode               |
| `qos`     | `0 \| 1 \| 2`         | `0`     | Quality of service                                       |
| `retain`  | `boolean`             | `false` | Ask the broker to retain the message                     |
| `opts`    | `PublishOptions`      | `{}`    | `{ json?: boolean, timeoutMs?: number }`                 |

---

### client.getState

```js
import { ConnectionState } from 'sa-react-native-mqtt';

const state = client.getState();
// 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'disconnecting' | 'error'

if (state === ConnectionState.CONNECTED) { /* … */ }
```

Synchronous — updated immediately when events arrive from the native layer.

---

### Events

```js
client.on('connect',     ({ reconnect }) => console.log('connected, reconnect=', reconnect));
client.on('closed',      (msg)  => console.log('closed', msg));
client.on('error',       (msg)  => console.error('error', msg));
client.on('message',     (msg)  => console.log(msg.topic, msg.data));
client.on('connecting',  ()     => console.log('connecting…'));
client.on('reconnecting',()     => console.log('reconnecting…'));
client.on('msgSent',     (id)   => console.log('delivered', id));   // iOS only

// Remove a listener
client.off('message');
```

| Event         | Payload                      | Fired when                                      |
|---------------|------------------------------|-------------------------------------------------|
| `connect`     | `{ reconnect: boolean }`     | Connection fully established                    |
| `closed`      | `string`                     | Connection closed cleanly                       |
| `closing`     | `string`                     | Connection is in the process of closing         |
| `connecting`  | `string`                     | Initial connection attempt started              |
| `reconnecting`| `string`                     | Automatic reconnection attempt started          |
| `error`       | `string`                     | Any connection or protocol error                |
| `message`     | `MqttMessage`                | Inbound message received                        |
| `msgSent`     | `string`                     | Publish delivery confirmed (iOS only)           |

---

## Options Reference

| Option              | Type      | Default             | Description                                          |
|---------------------|-----------|---------------------|------------------------------------------------------|
| `uri`               | `string`  | —                   | `mqtt://host:port` — overrides host/port/protocol    |
| `host`              | `string`  | `'localhost'`       | Broker hostname or IP                                |
| `port`              | `number`  | `1883`              | Broker port                                          |
| `clientId`          | `string`  | **required**        | Unique client identifier                             |
| `protocol`          | `string`  | `'tcp'`             | `tcp \| ws \| wss \| mqtt \| mqtts`                  |
| `tls`               | `boolean` | `false`             | Enable TLS/SSL                                       |
| `keepalive`         | `number`  | `60`                | Keep-alive interval (seconds)                        |
| `protocolLevel`     | `3\|4\|5` | `4`                 | MQTT protocol version                                |
| `clean`             | `boolean` | `true`              | Start a clean session                                |
| `auth`              | `boolean` | `false`             | Enable username/password auth                        |
| `user`              | `string`  | `''`                | Username                                             |
| `pass`              | `string`  | `''`                | Password                                             |
| `will`              | `boolean` | `false`             | Enable last-will message                             |
| `willMsg`           | `string`  | `''`                | Last-will payload                                    |
| `willtopic`         | `string`  | `''`                | Last-will topic                                      |
| `willQos`           | `0\|1\|2` | `0`                 | Last-will QoS                                        |
| `willRetainFlag`    | `boolean` | `false`             | Retain the last-will message                         |
| `automaticReconnect`| `boolean` | `false`             | Auto-reconnect on connection loss                    |
| `certificate`       | `string`  | `''`                | Base64-encoded PKCS#12 client certificate            |
| `certificatePass`   | `string`  | `''`                | Password for the PKCS#12 certificate                 |
| `ca`                | `string`  | `''`                | Base64-encoded DER CA certificate                    |
| `json`              | `boolean` | `false`             | Auto-serialize/deserialize JSON payloads             |
| `debug`             | `boolean` | `false`             | Log internal operations to the console               |

---

## JSON Mode

Enable `json: true` on the client to automatically serialize objects on `publish` and parse incoming payloads on `message`.

```js
const client = await mqtt.createClient({
  uri: 'mqtt://broker.hivemq.com:1883',
  clientId: 'json-demo',
  json: true,
});

// Publishing an object — automatically JSON.stringify'd
client.publish('sensors/data', { temp: 22.5, unit: 'C' }, 1, false);

// Receiving — data is already parsed
client.on('message', (msg) => {
  console.log(msg.data.temp); // 22.5
});
```

Override JSON mode per publish call:

```js
// Force JSON for this call even if json: false on the client
client.publish('topic', { key: 'value' }, 0, false, { json: true });

// Force raw string even if json: true on the client
client.publish('topic', '{"raw":true}', 0, false, { json: false });
```

---

## Debug Logging

Pass `debug: true` to get prefixed console output for every event, subscribe, unsubscribe, and publish operation.

```js
const client = await mqtt.createClient({
  uri: 'mqtt://broker.hivemq.com:1883',
  clientId: 'debug-demo',
  debug: true,
});

// Console output:
// [sa-react-native-mqtt] Client created abc-123
// [sa-react-native-mqtt] Connecting…
// [sa-react-native-mqtt] Event: connect { reconnect: false }
// [sa-react-native-mqtt] Subscribe → home/temp (qos=1)
// [sa-react-native-mqtt] Publish → home/cmd (qos=0, retain=false) on
```

---

## Connection State

```js
import mqtt, { ConnectionState } from 'sa-react-native-mqtt';

const client = await mqtt.createClient({ … });

// Synchronous check — updated from incoming native events
client.getState(); // 'disconnected' | 'connecting' | 'connected' | …

// Async native query
const connected = await client.isConnected();

// Compare against constants
if (client.getState() === ConnectionState.CONNECTED) {
  client.publish('topic', 'hello');
}
```

| Constant                        | Value            |
|---------------------------------|------------------|
| `ConnectionState.DISCONNECTED`  | `'disconnected'` |
| `ConnectionState.CONNECTING`    | `'connecting'`   |
| `ConnectionState.CONNECTED`     | `'connected'`    |
| `ConnectionState.RECONNECTING`  | `'reconnecting'` |
| `ConnectionState.DISCONNECTING` | `'disconnecting'`|
| `ConnectionState.ERROR`         | `'error'`        |

---

## Timeouts

Prevent operations from hanging indefinitely by passing `timeoutMs`:

```js
// Subscribe with a 5-second timeout
await client.subscribe('home/temp', 1, { timeoutMs: 5000 });

// Publish with a 3-second timeout
await client.publish('home/cmd', 'on', 1, false, { timeoutMs: 3000 });

// Unsubscribe with timeout
await client.unsubscribe('home/temp', { timeoutMs: 3000 });
```

---

## Platform Setup

### iOS

Add to your `ios/Podfile`:

```ruby
pod 'MQTTClient'
```

Then run:

```bash
cd ios && pod install && cd ..
```

### Android

Update `android/settings.gradle`:

```gradle
include ':sa-react-native-mqtt'
project(':sa-react-native-mqtt').projectDir = new File(rootProject.projectDir, '../node_modules/sa-react-native-mqtt/android')
```

Update `android/app/build.gradle`:

```gradle
dependencies {
    implementation project(':sa-react-native-mqtt')
}
```

---

## Changelog

### v1.2.0 — Developer Experience

- **React Hooks** — `useMqtt`, `useSubscription`, `usePublish` via `sa-react-native-mqtt/hooks`
- **Batch subscribe/unsubscribe** — pass an array of topics or `{ topic, qos }` objects
- **JSON mode** — `json: true` option auto-serializes publish payloads and auto-parses incoming messages; overridable per call
- **Debug logging** — `debug: true` logs all internal operations with a `[sa-react-native-mqtt]` prefix
- **Connection state helper** — synchronous `client.getState()` and exported `ConnectionState` constants
- **Timeouts** — `timeoutMs` option on `subscribe`, `unsubscribe`, and `publish`
- **`client.off(event)`** — remove a previously registered event listener
- **Better error messages** — descriptive errors for missing `clientId`, malformed URI, invalid topics, and JSON serialization failures
- **TypeScript improvements** — `ConnectionState`, `ConnectionStateValue`, `TopicSubscription`, `PublishOptions`, `SubscribeOptions`, full hook return types, JSDoc on all public members
- No breaking changes from v1.1.x

### v1.1.1

- Initial public release with SSL/TLS, reconnect, and multi-client support
