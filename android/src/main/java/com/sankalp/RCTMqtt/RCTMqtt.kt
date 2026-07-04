package com.sankalp.RCTMqtt

import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.RCTNativeAppEventEmitter
import org.eclipse.paho.client.mqttv3.IMqttActionListener
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken
import org.eclipse.paho.client.mqttv3.IMqttToken
import org.eclipse.paho.client.mqttv3.MqttAsyncClient
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttException
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import java.io.ByteArrayInputStream
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

class RCTMqtt(
    private val clientRef: String,
    private val reactContext: ReactApplicationContext,
    options: ReadableMap,
) : MqttCallbackExtended {

    private val topics = mutableMapOf<String, Int>()
    private lateinit var client: MqttAsyncClient
    private lateinit var mqttOptions: MqttConnectOptions

    companion object {
        private val RECONNECTABLE_REASON_CODES = setOf(
            MqttException.REASON_CODE_CLIENT_EXCEPTION.toInt(),
            MqttException.REASON_CODE_CONNECTION_LOST.toInt(),
            MqttException.REASON_CODE_SERVER_CONNECT_ERROR.toInt(),
            MqttException.REASON_CODE_CLIENT_TIMEOUT.toInt(),
        )
    }

    init {
        buildClient(options)
    }

    private fun opt(options: ReadableMap, key: String, default: Any): Any =
        when (default) {
            is String -> if (options.hasKey(key)) options.getString(key) ?: default else default
            is Int -> if (options.hasKey(key)) options.getInt(key) else default
            is Boolean -> if (options.hasKey(key)) options.getBoolean(key) else default
            else -> default
        }

    private fun buildClient(options: ReadableMap) {
        val host = opt(options, "host", "localhost") as String
        val port = opt(options, "port", 1883) as Int
        val protocol = opt(options, "protocol", "tcp") as String
        val tls = opt(options, "tls", false) as Boolean
        val keepalive = opt(options, "keepalive", 60) as Int
        val clientId = opt(options, "clientId", "react-native-mqtt") as String
        val protocolLevel = opt(options, "protocolLevel", 4) as Int
        val clean = opt(options, "clean", true) as Boolean
        val auth = opt(options, "auth", false) as Boolean
        val user = opt(options, "user", "") as String
        val pass = opt(options, "pass", "") as String
        val will = opt(options, "will", false) as Boolean
        val willMsg = opt(options, "willMsg", "") as String
        val willTopic = opt(options, "willtopic", "") as String
        val willQos = opt(options, "willQos", 0) as Int
        val willRetain = opt(options, "willRetainFlag", false) as Boolean
        val automaticReconnect = opt(options, "automaticReconnect", false) as Boolean
        val certificateBase64 = opt(options, "certificate", "") as String
        val certificatePass = opt(options, "certificatePass", "") as String
        val caBase64 = opt(options, "ca", "") as String

        mqttOptions = MqttConnectOptions().apply {
            if (protocolLevel == 3) mqttVersion = MqttConnectOptions.MQTT_VERSION_3_1
            keepAliveInterval = keepalive
            maxInflight = 1000
            connectionTimeout = 10
            isCleanSession = clean
            isAutomaticReconnect = automaticReconnect

            if (auth) {
                if (user.isNotEmpty()) userName = user
                if (pass.isNotEmpty()) password = pass.toCharArray()
            }

            if (will && willTopic.isNotEmpty()) {
                setWill(willTopic, willMsg.toByteArray(), willQos, willRetain)
            }
        }

        val scheme = when {
            tls && protocol == "ws" -> "wss"
            tls -> "ssl"
            protocol == "ws" -> "ws"
            else -> "tcp"
        }
        val uri = "$scheme://$host:$port"

        if (tls) {
            mqttOptions.socketFactory = buildSslSocketFactory(certificateBase64, certificatePass, caBase64)
        }

        client = MqttAsyncClient(uri, clientId, MemoryPersistence())
    }

    private fun buildSslSocketFactory(certBase64: String, certPass: String, caBase64: String): javax.net.ssl.SSLSocketFactory {
        return if (certBase64.isNotEmpty() && caBase64.isNotEmpty()) {
            val certBytes = Base64.decode(certBase64, Base64.DEFAULT)
            val caBytes = Base64.decode(caBase64, Base64.DEFAULT)

            val clientStore = KeyStore.getInstance("PKCS12").apply {
                load(ByteArrayInputStream(certBytes), certPass.toCharArray())
            }
            val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply {
                init(clientStore, certPass.toCharArray())
            }

            val caCert = CertificateFactory.getInstance("X.509")
                .generateCertificate(ByteArrayInputStream(caBytes)) as X509Certificate
            val trustStore = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
                load(null, null)
                setCertificateEntry("ca", caCert)
            }
            val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply {
                init(trustStore)
            }

            SSLContext.getInstance("TLS").apply {
                init(kmf.keyManagers, tmf.trustManagers, SecureRandom())
            }.socketFactory
        } else {
            SSLContext.getInstance("TLS").apply {
                init(null, arrayOf<X509TrustManager>(object : X509TrustManager {
                    override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = Unit
                    override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) = Unit
                    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
                }), SecureRandom())
            }.socketFactory
        }
    }

    fun setCallback() {
        client.setCallback(this)
    }

    fun connect() {
        sendEvent("connecting", "try to connect")
        try {
            client.connect(mqttOptions, reactContext, object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken) {
                    topics.forEach { (topic, qos) -> subscribe(topic, qos) }
                }
                override fun onFailure(asyncActionToken: IMqttToken, exception: Throwable) {
                    sendEvent("error", "connection failure: $exception")
                }
            })
        } catch (e: MqttException) {
            sendEvent("error", "Can't create connection: ${e.message}")
        }
    }

    fun disconnect() {
        try {
            client.disconnect(reactContext, object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken) {
                    sendEvent("closed", "Disconnect")
                }
                override fun onFailure(asyncActionToken: IMqttToken, exception: Throwable) {}
            })
        } catch (_: MqttException) {}
    }

    fun reconnect() {
        sendEvent("reconnecting", "try to reconnect")
        try {
            client.reconnect()
        } catch (e: MqttException) {
            sendEvent("error", e.message ?: "reconnect failed")
        }
    }

    fun isConnected(): Boolean = client.isConnected

    fun getTopics(): WritableArray {
        val arr = WritableNativeArray()
        topics.forEach { (topic, qos) ->
            val entry = WritableNativeMap().apply {
                putString("topic", topic)
                putInt("qos", qos)
            }
            arr.pushMap(entry)
        }
        return arr
    }

    fun isSubbed(topic: String): Boolean = topics.containsKey(topic)

    fun subscribe(topic: String, qos: Int) {
        topics[topic] = qos
        try {
            client.subscribe(topic, qos).setActionCallback(object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken) {}
                override fun onFailure(asyncActionToken: IMqttToken, exception: Throwable) {}
            })
        } catch (_: MqttException) {}
    }

    fun unsubscribe(topic: String) {
        topics.remove(topic)
        try {
            client.unsubscribe(topic).setActionCallback(object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken) {}
                override fun onFailure(asyncActionToken: IMqttToken, exception: Throwable) {}
            })
        } catch (_: MqttException) {}
    }

    fun publish(topic: String, payload: String, qos: Int, retain: Boolean) {
        try {
            val message = MqttMessage(payload.toByteArray(Charsets.UTF_8)).apply {
                this.qos = qos
                isRetained = retain
            }
            client.publish(topic, message)
        } catch (_: MqttException) {}
    }

    override fun connectComplete(reconnect: Boolean, serverURI: String) {
        sendEvent("connect", mapOf("reconnect" to reconnect))
    }

    override fun connectionLost(cause: Throwable?) {
        if (cause == null) return
        val mqttEx = cause as? MqttException ?: return
        if (mqttEx.reasonCode.toInt() in RECONNECTABLE_REASON_CODES) {
            sendEvent("error", "ConnectionLost: $cause")
        }
    }

    override fun messageArrived(topic: String, message: MqttMessage) {
        val params = Arguments.createMap().apply {
            putString("event", "message")
            putString("clientRef", clientRef)
            putMap("message", Arguments.createMap().apply {
                putString("topic", topic)
                putString("data", String(message.payload, Charsets.UTF_8))
                putBoolean("retain", message.isRetained)
                putInt("qos", message.qos)
            })
        }
        reactContext.getJSModule(RCTNativeAppEventEmitter::class.java).emit("mqtt_events", params)
    }

    override fun deliveryComplete(token: IMqttDeliveryToken?) {}

    private fun sendEvent(event: String, message: Any) {
        val params = Arguments.createMap().apply {
            putString("event", event)
            putString("clientRef", clientRef)
            when (message) {
                is String -> putString("message", message)
                is Map<*, *> -> putMap("message", Arguments.createMap().apply {
                    message.forEach { (k, v) ->
                        when (v) {
                            is Boolean -> putBoolean(k as String, v)
                            is Int -> putInt(k as String, v)
                            is String -> putString(k as String, v)
                            else -> {}
                        }
                    }
                })
                else -> putString("message", message.toString())
            }
        }
        reactContext.getJSModule(RCTNativeAppEventEmitter::class.java).emit("mqtt_events", params)
    }
}
