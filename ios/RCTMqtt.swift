import Foundation
import React

@objc(RCTMqtt)
class RCTMqtt: RCTEventEmitter {

    private var clients: [String: Mqtt] = [:]
    private var hasListeners = false

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String] {
        return ["mqtt_events"]
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    override func sendEvent(withName name: String, body: Any?) {
        guard hasListeners, bridge != nil else { return }
        super.sendEvent(withName: name, body: body)
    }

    @objc func createClient(_ options: [String: Any],
                            resolver resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
        let clientRef = ProcessInfo.processInfo.globallyUniqueString
        let client = Mqtt(emitter: self, options: options, clientRef: clientRef)
        clients[clientRef] = client
        resolve(clientRef)
    }

    @objc func removeClient(_ clientRef: String) {
        clients.removeValue(forKey: clientRef)
    }

    @objc func connect(_ clientRef: String) {
        clients[clientRef]?.connect()
    }

    @objc func disconnect(_ clientRef: String) {
        clients[clientRef]?.disconnect()
    }

    @objc func disconnectAll() {
        clients.values.forEach { $0.disconnect() }
    }

    @objc func subscribe(_ clientRef: String, topic: String, qos: NSNumber) {
        clients[clientRef]?.subscribe(topic: topic, qos: qos.intValue)
    }

    @objc func unsubscribe(_ clientRef: String, topic: String) {
        clients[clientRef]?.unsubscribe(topic: topic)
    }

    @objc func publish(_ clientRef: String,
                       topic: String,
                       data: String,
                       qos: NSNumber,
                       retain: Bool) {
        guard let payload = data.data(using: .utf8) else { return }
        clients[clientRef]?.publish(topic: topic, data: payload, qos: qos.intValue, retain: retain)
    }

    @objc func isConnected(_ clientRef: String,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let client = clients[clientRef] else {
            reject("client_not_found", "Client \(clientRef) does not exist", nil)
            return
        }
        resolve(client.isConnected)
    }

    @objc func isSubbed(_ clientRef: String,
                        topic: String,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let client = clients[clientRef] else {
            reject("client_not_found", "Client \(clientRef) does not exist", nil)
            return
        }
        resolve(client.isSubbed(topic: topic))
    }

    @objc func getTopics(_ clientRef: String,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let client = clients[clientRef] else {
            reject("client_not_found", "Client \(clientRef) does not exist", nil)
            return
        }
        resolve(client.getTopics())
    }

    override func invalidate() {
        disconnectAll()
    }
}
