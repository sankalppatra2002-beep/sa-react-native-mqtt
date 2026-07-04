package com.tuanpm.RCTMqtt

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.UUID

class RCTMqttModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val clients = mutableMapOf<String, RCTMqtt>()

    override fun getName(): String = "Mqtt"

    @ReactMethod
    fun createClient(options: ReadableMap, promise: Promise) {
        val clientRef = UUID.randomUUID().toString()
        val client = RCTMqtt(clientRef, reactContext, options)
        client.setCallback()
        clients[clientRef] = client
        promise.resolve(clientRef)
    }

    @ReactMethod
    fun connect(clientRef: String) {
        clients[clientRef]?.connect()
    }

    @ReactMethod
    fun disconnect(clientRef: String) {
        clients[clientRef]?.disconnect()
    }

    @ReactMethod
    fun disconnectAll() {
        clients.values.forEach { it.disconnect() }
    }

    @ReactMethod
    fun subscribe(clientRef: String, topic: String, qos: Int) {
        clients[clientRef]?.subscribe(topic, qos)
    }

    @ReactMethod
    fun unsubscribe(clientRef: String, topic: String) {
        clients[clientRef]?.unsubscribe(topic)
    }

    @ReactMethod
    fun publish(clientRef: String, topic: String, payload: String, qos: Int, retain: Boolean) {
        clients[clientRef]?.publish(topic, payload, qos, retain)
    }

    @ReactMethod
    fun removeClient(clientRef: String) {
        clients.remove(clientRef)
    }

    @ReactMethod
    fun reconnect(clientRef: String) {
        clients[clientRef]?.reconnect()
    }

    @ReactMethod
    fun isConnected(clientRef: String, promise: Promise) {
        val client = clients[clientRef]
        if (client != null) {
            promise.resolve(client.isConnected())
        } else {
            promise.reject("client_not_found", "Client $clientRef does not exist")
        }
    }

    @ReactMethod
    fun getTopics(clientRef: String, promise: Promise) {
        val client = clients[clientRef]
        if (client != null) {
            promise.resolve(client.getTopics())
        } else {
            promise.reject("client_not_found", "Client $clientRef does not exist")
        }
    }

    @ReactMethod
    fun isSubbed(clientRef: String, topic: String, promise: Promise) {
        val client = clients[clientRef]
        if (client != null) {
            promise.resolve(client.isSubbed(topic))
        } else {
            promise.reject("client_not_found", "Client $clientRef does not exist")
        }
    }

    override fun onCatalystInstanceDestroy() {
        disconnectAll()
    }
}
