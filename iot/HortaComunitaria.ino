#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// Configure these values for the physical installation. Do not commit real
// Wi-Fi credentials to the repository.
#define WIFI_SSID "SUA_REDE_WIFI"
#define WIFI_PASSWORD "SUA_SENHA_WIFI"

// This is the same public broker used by the Wokwi firmware and Docker backend.
#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PORT 1883
#define TELEMETRY_TOPIC "horta/telemetry"
#define IRRIGATION_TOPIC "horta/irrigation"

#define DHT_PIN 4
#define SOIL_PIN 34
#define RELAY_PIN 5

constexpr unsigned long TELEMETRY_INTERVAL = 5000;
constexpr int SOIL_DRY_THRESHOLD = 40;
constexpr int SOIL_WET_THRESHOLD = 60;

DHT dht(DHT_PIN, DHT22);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastTelemetry = 0;
bool irrigationOn = false;
bool manualOverride = false;

String mqttClientId() {
  return "horta-esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
}

void setIrrigation(bool active) {
  digitalWrite(RELAY_PIN, active ? HIGH : LOW);
  irrigationOn = active;
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Wi-Fi conectado. IP: ");
  Serial.println(WiFi.localIP());
}

void connectMqtt() {
  while (!mqttClient.connected()) {
    if (WiFi.status() != WL_CONNECTED) {
      connectWifi();
    }

    String clientId = mqttClientId();
    Serial.print("Conectando ao MQTT...");
    if (mqttClient.connect(clientId.c_str())) {
      mqttClient.subscribe(IRRIGATION_TOPIC);
      Serial.println(" conectado");
    } else {
      Serial.print(" falhou, estado: ");
      Serial.println(mqttClient.state());
      delay(1000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (String(topic) != IRRIGATION_TOPIC) return;

  StaticJsonDocument<128> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    Serial.print("Erro ao interpretar comando MQTT: ");
    Serial.println(error.c_str());
    return;
  }

  const char* command = doc["command"] | "";
  const char* mode = doc["mode"] | "manual";

  if (strcmp(command, "auto") == 0) {
    manualOverride = false;
    Serial.println("Irrigação em modo automático");
    return;
  }

  manualOverride = strcmp(mode, "automatic") != 0;
  if (strcmp(command, "on") == 0) {
    setIrrigation(true);
    Serial.println(
      manualOverride
        ? "Irrigação ligada manualmente"
        : "Irrigação ligada automaticamente"
    );
  } else if (strcmp(command, "off") == 0) {
    setIrrigation(false);
    Serial.println(
      manualOverride
        ? "Irrigação desligada manualmente"
        : "Irrigação desligada automaticamente"
    );
  }
}

void publishTelemetry() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Falha na leitura do DHT22; telemetria não enviada");
    return;
  }

  int soilRaw = analogRead(SOIL_PIN);
  int soilMoisture = constrain(map(soilRaw, 0, 4095, 100, 0), 0, 100);

  // Hysteresis prevents the relay from switching repeatedly near one limit.
  if (!manualOverride && soilMoisture < SOIL_DRY_THRESHOLD && !irrigationOn) {
    setIrrigation(true);
    mqttClient.publish(
      IRRIGATION_TOPIC,
      "{\"command\":\"on\",\"mode\":\"automatic\"}"
    );
  } else if (
    !manualOverride &&
    soilMoisture > SOIL_WET_THRESHOLD &&
    irrigationOn
  ) {
    setIrrigation(false);
    mqttClient.publish(
      IRRIGATION_TOPIC,
      "{\"command\":\"off\",\"mode\":\"automatic\"}"
    );
  }

  String payload = "{\"soilMoisture\":" + String(soilMoisture) +
                   ",\"temperature\":" + String(temperature, 1) +
                   ",\"humidity\":" + String(humidity, 1) +
                   ",\"irrigationOn\":" + (irrigationOn ? "true" : "false") +
                   ",\"mode\":\"" +
                   (manualOverride ? "manual" : "automatic") + "\"}";

  mqttClient.publish(TELEMETRY_TOPIC, payload.c_str());
  Serial.println("Telemetria enviada: " + payload);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  setIrrigation(false);
  dht.begin();

  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(15);
  mqttClient.setSocketTimeout(5);
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);

  connectWifi();
  lastTelemetry = millis() - TELEMETRY_INTERVAL;
}

void loop() {
  if (!mqttClient.connected()) connectMqtt();
  mqttClient.loop();

  if (millis() - lastTelemetry >= TELEMETRY_INTERVAL) {
    lastTelemetry = millis();
    publishTelemetry();
  }
}
