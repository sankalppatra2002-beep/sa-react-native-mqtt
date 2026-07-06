import Foundation
import React

class Mqtt: NSObject, MQTTSessionManagerDelegate {

    private var manager: MQTTSessionManager?
    private let options: [String: Any]
    private let clientRef: String
    private weak var emitter: RCTEventEmitter?

    private static let defaultOptions: [String: Any] = [
        "host": "localhost",
        "port": 1883,
        "protocol": "tcp",
        "tls": false,
        "keepalive": 120,
        "clientId": "react-native-mqtt",
        "protocolLevel": 4,
        "clean": true,
        "auth": false,
        "user": "",
        "pass": "",
        "will": false,
        "willMsg": "",
        "willtopic": "",
        "willQos": 0,
        "willRetainFlag": false,
        "certificatePass": "",
        "certificate": "",
        "ca": "",
        "automaticReconnect": false,
    ]

    init(emitter: RCTEventEmitter, options: [String: Any], clientRef: String) {
        var merged = Mqtt.defaultOptions
        for (key, value) in options {
            merged[key] = value
        }
        self.options = merged
        self.clientRef = clientRef
        self.emitter = emitter
        super.init()
    }

    func connect() {
        var securityPolicy: MQTTSSLSecurityPolicy? = nil
        if let tls = options["tls"] as? Bool, tls {
            securityPolicy = MQTTSSLSecurityPolicy(pinningMode: .none)
            securityPolicy?.allowInvalidCertificates = true
        }

        var certificates: [Any]? = nil
        if securityPolicy != nil,
           let certBase64 = options["certificate"] as? String, !certBase64.isEmpty,
           let caBase64 = options["ca"] as? String, !caBase64.isEmpty,
           let certData = Data(base64Encoded: certBase64, options: .ignoreUnknownCharacters),
           let caData = Data(base64Encoded: caBase64, options: .ignoreUnknownCharacters) {

            let certPass = (options["certificatePass"] as? String) ?? ""
            var importResult: CFArray?
            let importStatus = SecPKCS12Import(
                certData as CFData,
                [kSecImportExportPassphrase: certPass] as CFDictionary,
                &importResult
            )

            if importStatus == errSecSuccess,
               let items = importResult as? [[String: Any]],
               let first = items.first,
               let identity = first[kSecImportItemIdentity as String] {

                var leafCert: SecCertificate?
                SecIdentityCopyCertificate(identity as! SecIdentity, &leafCert)

                var clientCerts: [Any] = [identity]
                if let cert = leafCert { clientCerts.append(cert) }
                certificates = clientCerts

                if let rootCert = SecCertificateCreateWithData(kCFAllocatorDefault, caData as CFData) {
                    let addQuery: [String: Any] = [
                        kSecClass as String: kSecClassCertificate,
                        kSecValueRef as String: rootCert,
                    ]
                    SecItemAdd(addQuery as CFDictionary, nil)
                }
            }
        }

        var willMsg: Data? = nil
        if let msg = options["willMsg"] as? String, !msg.isEmpty {
            willMsg = msg.data(using: .utf8)
        }

        let host = options["host"] as? String ?? "localhost"
        let port = options["port"] as? Int ?? 1883
        let tls = options["tls"] as? Bool ?? false
        let keepalive = options["keepalive"] as? Int ?? 120
        let clean = options["clean"] as? Bool ?? true
        let auth = options["auth"] as? Bool ?? false
        let user = options["user"] as? String ?? ""
        let pass = options["pass"] as? String ?? ""
        let will = options["will"] as? Bool ?? false
        let willTopic = options["willtopic"] as? String ?? ""
        let willQos = MQTTQosLevel(rawValue: UInt8((options["willQos"] as? Int) ?? 0)) ?? .atMostOnce
        let willRetain = options["willRetainFlag"] as? Bool ?? false
        let clientId = options["clientId"] as? String ?? "react-native-mqtt"

        if manager == nil {
            let queue = DispatchQueue(label: "com.sa.mqtt.\(clientRef)")
            manager = MQTTSessionManager(
                persistence: false,
                maxWindowSize: UInt(MQTT_MAX_WINDOW_SIZE),
                maxMessages: UInt(MQTT_MAX_MESSAGES),
                maxSize: UInt(MQTT_MAX_SIZE),
                maxConnectionRetryInterval: 60.0,
                connectInForeground: false,
                streamSSLLevel: nil,
                queue: queue
            )
            manager?.delegate = self

            manager?.connect(
                to: host,
                port: port,
                tls: tls,
                keepalive: keepalive,
                clean: clean,
                auth: auth,
                user: auth ? user : nil,
                pass: auth ? pass : nil,
                will: will,
                willTopic: will ? willTopic : nil,
                willMsg: will ? willMsg : nil,
                willQos: willQos,
                willRetainFlag: willRetain,
                withClientId: clientId,
                securityPolicy: securityPolicy,
                certificates: certificates,
                protocolLevel: .version311,
                connectHandler: nil
            )
        } else {
            if let manager = manager {
                if manager.responds(to: Selector(("connectToLast:"))) {
                    manager.perform(Selector(("connectToLast:")), with: nil)
                } else if manager.responds(to: Selector(("connect"))) {
                    manager.perform(Selector(("connect")))
                }
            }
        }
    }

    func disconnect() {
        DispatchQueue.global().async { [weak self] in
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 1.0))
            guard let manager = self?.manager else { return }

            if manager.responds(to: Selector(("disconnectWithDisconnectHandler:"))) {
                manager.perform(Selector(("disconnectWithDisconnectHandler:")), with: nil)
            } else if manager.responds(to: Selector(("disconnect"))) {
                manager.perform(Selector(("disconnect")))
            }
        }
    }

    var isConnected: Bool {
        return manager?.session.status == .connected
    }

    func isSubbed(topic: String) -> Bool {
        return manager?.subscriptions[topic] != nil
    }

    func getTopics() -> [[String: Any]] {
        guard let subscriptions = manager?.subscriptions else { return [] }
        return subscriptions.map { key, value in
            ["topic": key, "qos": value]
        }
    }

    func subscribe(topic: String, qos: Int) {
        var subs = (manager?.subscriptions as? [String: NSNumber]) ?? [:]
        subs[topic] = NSNumber(value: qos)
        manager?.subscriptions = subs
    }

    func unsubscribe(topic: String) {
        var subs = (manager?.subscriptions as? [String: NSNumber]) ?? [:]
        subs.removeValue(forKey: topic)
        manager?.subscriptions = subs
    }

    func publish(topic: String, data: Data, qos: Int, retain: Bool) {
        manager?.send(data, topic: topic, qos: MQTTQosLevel(rawValue: UInt8(qos)) ?? .atMostOnce, retain: retain)
    }

    func sessionManager(_ sessonManager: MQTTSessionManager, didChange newState: MQTTSessionManagerState) {
        switch newState {
        case .closed:
            sendEvent("closed", message: "closed")
        case .closing:
            sendEvent("closing", message: "closing")
        case .connected:
            sendEvent("connect", message: "connected")
        case .connecting:
            sendEvent("connecting", message: "connecting")
        case .error:
            let errorMsg = manager?.lastErrorCode?.localizedDescription ?? "unknown error"
            sendEvent("error", message: errorMsg)
        default:
            break
        }
    }

    func messageDelivered(_ msgID: UInt16) {
        sendEvent("msgSent", message: "\(msgID)")
    }

    func handleMessage(_ data: Data, onTopic topic: String, retained: Bool) {
        let text = String(data: data, encoding: .utf8) ?? ""
        emitter?.sendEvent(withName: "mqtt_events", body: [
            "event": "message",
            "clientRef": clientRef,
            "message": ["topic": topic, "data": text, "retain": retained],
        ])
    }

    private func sendEvent(_ event: String, message: Any) {
        emitter?.sendEvent(withName: "mqtt_events", body: [
            "event": event,
            "clientRef": clientRef,
            "message": message,
        ])
    }

    deinit {
        disconnect()
    }
}
