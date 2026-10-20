#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

//
// CONFIGURAÇÕES
//

#define WIFI_SSID "SUA_REDE_WIFI"
#define WIFI_PASSWORD "SUA_SENHA_WIFI"

//
// Em produção trocar por:
//
// mqtt.horta.com.br
//
// ou IP da VM Azure
//
#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PORT 1883

#define TELEMETRY_TOPIC "horta/telemetry"
#define IRRIGATION_TOPIC "horta/irrigation"

#define DHT_PIN 4
#define SOIL_PIN 34
#define RELAY_PIN 5

//
// INTERVALOS
//

constexpr unsigned long TELEMETRY_INTERVAL = 5000;

//
// HISTERese
//

constexpr int SOIL_DRY_THRESHOLD = 40;
constexpr int SOIL_WET_THRESHOLD = 60;

//
// OBJETOS
//

DHT dht(DHT_PIN, DHT22);

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

//
// ESTADO
//

unsigned long lastTelemetry = 0;

bool irrigationOn = false;
bool manualOverride = false;

//
// UTILITÁRIOS
//

String mqttClientId() {
  return "horta-esp32-" +
         String((uint32_t)ESP.getEfuseMac(), HEX);
}

void setIrrigation(bool active) {
  digitalWrite(RELAY_PIN, active ? HIGH : LOW);
  irrigationOn = active;
}

//
// WIFI
//

void connectWifi() {

  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.println();
  Serial.println("Conectando ao Wi-Fi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi conectado");

  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  Serial.print("RSSI: ");
  Serial.println(WiFi.RSSI());
}

//
// MQTT
//

void connectMqtt() {

  while (!mqttClient.connected()) {

    connectWifi();

    String clientId = mqttClientId();

    Serial.print("Conectando ao MQTT... ");

    if (mqttClient.connect(clientId.c_str())) {

      mqttClient.subscribe(IRRIGATION_TOPIC);

      Serial.println("OK");

    } else {

      Serial.print("Falha MQTT. Estado: ");
      Serial.println(mqttClient.state());

      delay(2000);
    }
  }
}

//
// MQTT CALLBACK
//

void mqttCallback(
  char* topic,
  byte* payload,
  unsigned int length
) {

  if (String(topic) != IRRIGATION_TOPIC) {
    return;
  }

  StaticJsonDocument<128> doc;

  DeserializationError error =
    deserializeJson(doc, payload, length);

  if (error) {

    Serial.print("Erro ao interpretar JSON: ");
    Serial.println(error.c_str());

    return;
  }

  const char* command =
    doc["command"] | "";

  const char* mode =
    doc["mode"] | "manual";

  if (strcmp(command, "auto") == 0) {

    manualOverride = false;

    Serial.println(
      "Irrigação em modo automático"
    );

    return;
  }

  manualOverride =
    strcmp(mode, "automatic") != 0;

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

//
// TELEMETRIA
//

void publishTelemetry() {

  float humidity =
    dht.readHumidity();

  float temperature =
    dht.readTemperature();

  if (
    isnan(humidity) ||
    isnan(temperature)
  ) {

    Serial.println(
      "Falha na leitura do DHT22"
    );

    return;
  }

  int soilRaw =
    analogRead(SOIL_PIN);

  int soilMoisture =
    constrain(
      map(
        soilRaw,
        0,
        4095,
        100,
        0
      ),
      0,
      100
    );

  //
  // CONTROLE AUTOMÁTICO
  //

  if (
    !manualOverride &&
    soilMoisture < SOIL_DRY_THRESHOLD &&
    !irrigationOn
  ) {

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

  //
  // PAYLOAD TELEMETRIA
  //
  // Timestamp continua sendo
  // gerado pelo Backend
  //

  StaticJsonDocument<256> doc;

  doc["soilMoisture"] = soilMoisture;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;

  doc["irrigationOn"] = irrigationOn;

  doc["mode"] =
    manualOverride
      ? "manual"
      : "automatic";

  //
  // Informações auxiliares
  // para diagnóstico
  //

  doc["rssi"] = WiFi.RSSI();

  doc["ip"] =
    WiFi.localIP().toString();

  doc["uptime"] =
    millis();

  String payload;

  serializeJson(doc, payload);

  bool sent =
    mqttClient.publish(
      TELEMETRY_TOPIC,
      payload.c_str()
    );

  if (sent) {

    Serial.println(
      "Telemetria enviada:"
    );

    Serial.println(payload);

  } else {

    Serial.println(
      "Falha ao publicar telemetria"
    );
  }
}

//
// SETUP
//

void setup() {

  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);

  setIrrigation(false);

  dht.begin();

  mqttClient.setServer(
    MQTT_BROKER,
    MQTT_PORT
  );

  mqttClient.setCallback(
    mqttCallback
  );

  mqttClient.setKeepAlive(15);

  mqttClient.setSocketTimeout(5);

  connectWifi();

  lastTelemetry =
    millis() - TELEMETRY_INTERVAL;
}

//
// LOOP
//

void loop() {

  if (
    WiFi.status() != WL_CONNECTED
  ) {
    connectWifi();
  }

  if (
    !mqttClient.connected()
  ) {
    connectMqtt();
  }

  mqttClient.loop();

  if (
    millis() - lastTelemetry >=
    TELEMETRY_INTERVAL
  ) {

    lastTelemetry = millis();

    publishTelemetry();
  }
}


// Evolução planejada para uma futura versão (firmware-esp32-v2.ino)

// Não implementar agora:

// Timestamp via NTP
// MQTT com usuário e senha
// DeviceId explícito no payload
// TLS/SSL MQTT (mqtts)
// FreeHeap
// OTA Update
// Tópicos específicos por dispositivo