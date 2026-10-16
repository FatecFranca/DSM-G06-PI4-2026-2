# Simulação do hardware e sensores no WIKWI.com

O DHT22 é um sensor digital que mede temperatura e umidade relativa do ar.

👉 No projeto da horta, ele tem a função de monitorar o clima ambiente:

Temperatura: ajuda a entender se o ambiente está adequado para o crescimento das plantas.

Umidade do ar: complementa a leitura da umidade do solo, mostrando se o ar está seco ou úmido.

Essas informações são importantes porque:

Plantas podem sofrer estresse se a temperatura estiver muito alta ou muito baixa.

A umidade do ar influencia a evaporação da água do solo e a transpiração das folhas.

Combinando os dados do DHT22 com o sensor de solo, você consegue tomar decisões mais inteligentes sobre irrigação (por exemplo, se o solo está seco mas o ar está muito úmido, talvez não seja necessário irrigar imediatamente).

No Wokwi, o DHT22 serve para simular essas condições ambientais e gerar dados de telemetria junto com o solo.

👉 Em resumo: o potenciômetro simula a umidade do solo, e o DHT22 fornece temperatura e umidade do ar. Juntos, eles dão uma visão completa do microclima da horta.

Gire o potenciômetro para valores baixos (solo seco → < 40%).

O código vai chamar setIrrigation(true).

O relé recebe HIGH → fecha o contato NO → LED acende.

Gire para valores altos (solo úmido → > 60%).

O relé recebe LOW → abre o contato NO → LED apaga.

## Arquivos utilizados na simulaçâo no WIKWI

```
arquivo: sketch.ino


#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""

#define MQTT_BROKER "test.mosquitto.org"
#define MQTT_PORT 1883
#define TELEMETRY_TOPIC "horta/telemetry"
#define IRRIGATION_TOPIC "horta/irrigation"

#define DHT_PIN 4
#define SOIL_PIN 34
#define RELAY_PIN 5

DHT dht(DHT_PIN, DHT22);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastTelemetry = 0;
bool irrigationOn = false;

void setIrrigation(bool active) {
  digitalWrite(RELAY_PIN, active ? HIGH : LOW);
  irrigationOn = active;
}

void connectWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi conectado!");
}

void connectMqtt() {
  while (!mqttClient.connected()) {
    if (mqttClient.connect("esp32-horta")) {
      mqttClient.subscribe(IRRIGATION_TOPIC);
      Serial.println("Conectado ao broker MQTT!");
    } else {
      delay(2000);
    }
  }
}

void publishTelemetry() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  int soilRaw = analogRead(SOIL_PIN);
  int soilMoisture = map(soilRaw, 0, 4095, 100, 0);

  // Histerese: liga abaixo de 40%, desliga acima de 60%
  if (soilMoisture < 40 && !irrigationOn) {
    setIrrigation(true);
    mqttClient.publish(IRRIGATION_TOPIC, "on");
  } else if (soilMoisture > 60 && irrigationOn) {
    setIrrigation(false);
    mqttClient.publish(IRRIGATION_TOPIC, "off");
  }

  String payload = "{\"soilMoisture\":" + String(soilMoisture) +
                   ",\"temperature\":" + String(temperature, 1) +
                   ",\"humidity\":" + String(humidity, 1) + "}";

  mqttClient.publish(TELEMETRY_TOPIC, payload.c_str());
  Serial.println("Telemetria enviada: " + payload);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  setIrrigation(false);
  dht.begin();

  connectWifi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void loop() {
  if (!mqttClient.connected()) connectMqtt();
  mqttClient.loop();

  if (millis() - lastTelemetry > 5000) {
    lastTelemetry = millis();
    publishTelemetry();
  }
}


```

```
arquivo: diagram.json

{
  "version": 1,
  "author": "Jose",
  "editor": "wokwi",
  "parts": [
    { "type": "board-esp32-devkit-c-v4", "id": "esp", "top": 0, "left": 0, "attrs": {} },
    {
      "type": "wokwi-dht22",
      "id": "dht1",
      "top": -191.7,
      "left": 234.6,
      "attrs": { "temperature": "25", "humidity": "50" }
    },
    { "type": "wokwi-relay-module", "id": "relay1", "top": -355, "left": 201.6, "attrs": {} },
    { "type": "wokwi-potentiometer", "id": "pot1", "top": -279.7, "left": -134.6, "attrs": {} },
    {
      "type": "wokwi-led",
      "id": "led2",
      "top": -406.8,
      "left": 416.6,
      "attrs": { "color": "green" }
    }
  ],
  "connections": [
    [ "esp:TX", "$serialMonitor:RX", "", [] ],
    [ "esp:RX", "$serialMonitor:TX", "", [] ],
    [ "dht1:SDA", "esp:4", "green", [ "v0" ] ],
    [ "dht1:GND", "esp:GND.2", "black", [ "v0" ] ],
    [ "relay1:VCC", "esp:5V", "red", [ "h0" ] ],
    [ "relay1:GND", "esp:GND.2", "black", [ "h0" ] ],
    [ "relay1:IN", "esp:5", "green", [ "h0" ] ],
    [ "pot1:SIG", "esp:34", "green", [ "v0" ] ],
    [ "pot1:VCC", "esp:5V", "red", [ "v0" ] ],
    [ "pot1:GND", "esp:GND.2", "black", [ "v0" ] ],
    [ "dht1:VCC", "esp:3V3", "red", [ "v0" ] ],
    [ "led2:C", "esp:GND.2", "black", [ "v0" ] ],
    [ "relay1:COM", "esp:3V3", "red", [ "h0" ] ],
    [ "led2:A", "relay1:NO", "green", [ "v0" ] ]
  ],
  "dependencies": {}
}


```

🚀 Resultado esperado

```

Solo < 40% → irrigação liga (LED acende).

Solo > 60% → irrigação desliga (LED apaga).

Entre 40% e 60% → mantém o estado atual (se estava ligado, continua ligado; se estava desligado, continua desligado).

```

👉 Comportamento é o que você encontra em sistemas comerciais: estável, confiável e sem ficar oscilando.
