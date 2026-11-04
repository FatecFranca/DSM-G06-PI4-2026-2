import mqtt from 'mqtt';

// Conexão com broker MQTT
const client = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://localhost:1883');

// Limites para irrigação automática
const LIMITS = {
  soilMoistureMin: 40,
  soilMoistureMax: 80,
  tempMax: 30,
  humidityMin: 50,
};

function generateTelemetry() {
  return {
    soilMoisture: Math.floor(Math.random() * 100),
    temperature: +(20 + Math.random() * 15).toFixed(1),
    humidity: +(40 + Math.random() * 40).toFixed(1),
    timestamp: new Date().toISOString(),
  };
}

client.on('connect', () => {
  console.log('Simulador conectado ao broker MQTT');

  setInterval(() => {
    const data = generateTelemetry();
    client.publish('horta/telemetry', JSON.stringify(data));
    console.log('Telemetria enviada:', data);

    // Regras de irrigação automática
    if (data.soilMoisture < LIMITS.soilMoistureMin) {
      client.publish('horta/irrigation', JSON.stringify({ command: 'on' }));
      console.log('💧 Irrigação LIGADA automaticamente');
    } else if (data.soilMoisture > LIMITS.soilMoistureMax) {
      client.publish('horta/irrigation', JSON.stringify({ command: 'off' }));
      console.log('💧 Irrigação DESLIGADA automaticamente');
    }

    // Alertas adicionais
    if (data.temperature > LIMITS.tempMax) {
      console.log('⚠️ Temperatura alta detectada!');
    }
    if (data.humidity < LIMITS.humidityMin) {
      console.log('⚠️ Umidade do ar baixa detectada!');
    }
  }, Number(process.env.SIMULATOR_TELEMETRY_INTERVAL_MS || 10000));
});
