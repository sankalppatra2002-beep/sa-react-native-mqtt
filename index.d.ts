export type QoS = 0 | 1 | 2;

export interface MqttClientOptions {
  uri?: string;
  host?: string;
  port?: number;
  clientId: string;
  protocol?: 'tcp' | 'ws' | 'wss' | 'mqtt' | 'mqtts';
  tls?: boolean;
  keepalive?: number;
  protocolLevel?: 3 | 4 | 5;
  clean?: boolean;
  auth?: boolean;
  user?: string;
  pass?: string;
  will?: boolean;
  willMsg?: string;
  willtopic?: string;
  willQos?: QoS;
  willRetainFlag?: boolean;
  automaticReconnect?: boolean;
  certificate?: string;
  certificatePass?: string;
  ca?: string;
}

export interface MqttMessage {
  topic: string;
  data: string;
  qos: QoS;
  retain: boolean;
}

export interface TopicEntry {
  topic: string;
  qos: QoS;
}

export type MqttEventMap = {
  connect: { reconnect: boolean };
  closed: string;
  closing: string;
  connecting: string;
  reconnecting: string;
  error: string;
  message: MqttMessage;
  msgSent: string;
};

export interface MqttClient {
  readonly clientRef: string;
  readonly options: MqttClientOptions;

  on<E extends keyof MqttEventMap>(event: E, callback: (msg: MqttEventMap[E]) => void): void;

  connect(): void;
  disconnect(): void;
  reconnect(): void;
  subscribe(topic: string, qos: QoS): void;
  unsubscribe(topic: string): void;
  publish(topic: string, payload: string, qos: QoS, retain: boolean): void;
  isConnected(): Promise<boolean>;
  isSubbed(topic: string): Promise<boolean>;
  getTopics(): Promise<TopicEntry[]>;
}

declare const mqtt: {
  createClient(options: MqttClientOptions): Promise<MqttClient>;
  removeClient(client: MqttClient): void;
  disconnectAll(): void;
};

export default mqtt;
