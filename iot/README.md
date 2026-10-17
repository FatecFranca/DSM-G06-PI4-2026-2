## Instruções para instalar o firmware e sensores no hardware Arduino.

Antes de gravar no ESP32
Altere estas linhas no início do arquivo:

```
#define WIFI_SSID "SUA_REDE_WIFI"
#define WIFI_PASSWORD "SUA_SENHA_WIFI"
```

Não coloque suas credenciais reais no Git.

Também instale na Arduino IDE:

```
- Suporte para ESP32;
- DHT sensor library;
- PubSubClient;
- ArduinoJson.

Depois:

1. Abra o arquivo na Arduino IDE;
2. Selecione a placa ESP32;
3. Selecione a porta serial;
4. Faça o upload;
5. Abra o monitor serial em 115200 baud.
```

```
Pinos mantidos

Componente                 GPIO

DHT22                        4
Relé                         5
Sensor de umidade do solo   34


Confirme a ligação elétrica antes de energizar o relé.

O GPIO 34 é somente entrada, portanto está adequado para leitura analógica.
```
