import 'dotenv/config';
import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import mqtt from 'mqtt';
import { Server } from 'socket.io';
import { Harvest } from './models/Harvest.js';
import { Telemetry } from './models/Telemetry.js';
import { seedInitialAdmin } from './auth/bootstrap.js';
import { authRouter } from './auth/routes.js';
import { usersRouter } from './auth/users-routes.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});
const port = process.env.PORT || 3000;
let irrigation = {
  active: false,
  mode: 'automatic',
  updatedAt: new Date().toISOString(),
};
let latestTelemetry = {
  soilMoisture: 42,
  temperature: 26,
  humidity: 68,
  timestamp: new Date().toISOString(),
};
const telemetryHistory = [latestTelemetry];
const demoHarvests = [
  {
    id: 'harvest-1',
    crop: 'Alface crespa',
    harvestDate: '2026-09-26T16:00:00.000Z',
    available: true,
    quantity: 24,
  },
  {
    id: 'harvest-2',
    crop: 'Cebolinha',
    harvestDate: '2026-09-27T08:30:00.000Z',
    available: true,
    quantity: 18,
  },
];

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function getStatus() {
  return { ...latestTelemetry, irrigation };
}

function emitStatus() {
  io.emit('status:update', getStatus());
}

function serializeHarvest(harvest) {
  const item = harvest.toObject ? harvest.toObject() : harvest;
  return {
    ...item,
    id: item.id || item._id?.toString(),
    _id: undefined,
    harvestDate: new Date(item.harvestDate).toISOString(),
    reservedAt: item.reservedAt
      ? new Date(item.reservedAt).toISOString()
      : undefined,
  };
}

async function seedHarvests() {
  if ((await Harvest.countDocuments()) > 0) return;
  await Harvest.insertMany(demoHarvests);
  console.log('Colheitas iniciais criadas');
}

app.use(cors());
app.use(express.json());
io.on('connection', (socket) => {
  socket.emit('status:update', getStatus());
});
app.get('/health', (_request, response) =>
  response.json({ ok: true, service: 'horta-comunitaria-api' }),
);
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.get('/status', (_request, response) =>
  response.json(getStatus()),
);
app.get('/telemetry/history', (_request, response) =>
  response.json(telemetryHistory.slice(-100).reverse()),
);
app.post('/irrigation', (request, response) => {
  const { action, mode = 'manual' } = request.body;
  if (!['on', 'off', 'auto'].includes(action))
    return response
      .status(400)
      .json({ error: 'Ação inválida. Use on, off ou auto.' });
  const automatic = action === 'auto';
  irrigation = automatic
    ? { ...irrigation, mode: 'automatic', updatedAt: new Date().toISOString() }
    : {
        active: action === 'on',
        mode,
        updatedAt: new Date().toISOString(),
      };
  emitStatus();
  const client = app.locals.mqtt;
  if (client) {
    const topic = process.env.MQTT_IRRIGATION_TOPIC || 'horta/irrigation';
    client.publish(
      topic,
      JSON.stringify({
        command: automatic ? 'auto' : action,
        mode: automatic ? 'automatic' : mode,
      }),
      (error) => {
        if (error)
          return response
            .status(502)
            .json({ error: 'Falha ao publicar no MQTT' });
        response.json({ message: `Irrigação ${action}`, irrigation });
      },
    );
    return;
  }
  response.json({ message: `Irrigação ${action}`, irrigation });
});
app.get('/harvest', async (_request, response) => {
  if (!isMongoReady()) return response.json(demoHarvests);
  const harvests = await Harvest.find().sort({ harvestDate: 1 }).lean();
  response.json(harvests.map(serializeHarvest));
});
app.post('/harvest', async (request, response) => {
  const { crop, harvestDate, quantity = 0 } = request.body;
  const parsedHarvestDate = new Date(harvestDate);
  const parsedQuantity = Number(quantity);
  if (!crop || !harvestDate)
    return response
      .status(400)
      .json({ error: 'crop e harvestDate são obrigatórios.' });
  if (Number.isNaN(parsedHarvestDate.getTime()))
    return response.status(400).json({ error: 'harvestDate inválida.' });
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0)
    return response.status(400).json({ error: 'quantity inválida.' });
  const harvest = {
    id: `harvest-${Date.now()}`,
    crop,
    harvestDate: parsedHarvestDate,
    quantity: parsedQuantity,
    available: true,
  };
  if (!isMongoReady()) {
    demoHarvests.push(harvest);
    return response.status(201).json(harvest);
  }
  const createdHarvest = await Harvest.create(harvest);
  response.status(201).json(serializeHarvest(createdHarvest));
});
app.put('/harvest/:id/reserve', async (request, response) => {
  if (isMongoReady()) {
    const harvest = await Harvest.findOneAndUpdate(
      { id: request.params.id, available: true },
      {
        $set: {
          available: false,
          reservedBy: request.body.reservedBy || 'Morador',
          reservedAt: new Date(),
        },
      },
      { new: true },
    );
    if (harvest) return response.json(serializeHarvest(harvest));
    const existingHarvest = await Harvest.exists({ id: request.params.id });
    if (!existingHarvest)
      return response.status(404).json({ error: 'Colheita não encontrada.' });
    return response.status(409).json({ error: 'Colheita já reservada.' });
  }

  const harvest = demoHarvests.find((item) => item.id === request.params.id);
  if (!harvest)
    return response.status(404).json({ error: 'Colheita não encontrada.' });
  if (!harvest.available)
    return response.status(409).json({ error: 'Colheita já reservada.' });
  harvest.available = false;
  harvest.reservedBy = request.body.reservedBy || 'Morador';
  harvest.reservedAt = new Date().toISOString();
  response.json(harvest);
});

async function connectIntegrations() {
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 2500,
      });
    } catch {
      console.log('MongoDB indisponível; usando memória');
      return;
    }
    await seedHarvests();
    await seedInitialAdmin();
    console.log('MongoDB conectado');
  }

  if (process.env.MQTT_BROKER) {
    const client = mqtt.connect(process.env.MQTT_BROKER, {
      reconnectPeriod: 5000,
      connectTimeout: 2500,
    });
    client.on('connect', () => {
      console.log('MQTT conectado');
      client.subscribe([
        process.env.MQTT_TELEMETRY_TOPIC || 'horta/telemetry',
        process.env.MQTT_IRRIGATION_TOPIC || 'horta/irrigation',
      ]);
    });
    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        const irrigationTopic =
          process.env.MQTT_IRRIGATION_TOPIC || 'horta/irrigation';
        if (topic === irrigationTopic) {
          if (['on', 'off'].includes(data.command)) {
            irrigation = {
              active: data.command === 'on',
              mode: data.mode || 'automatic',
              updatedAt: new Date().toISOString(),
            };
            emitStatus();
          } else if (data.command === 'auto') {
            irrigation = {
              ...irrigation,
              mode: 'automatic',
              updatedAt: new Date().toISOString(),
            };
            emitStatus();
          }
          return;
        }
        latestTelemetry = {
          ...data,
          timestamp: data.timestamp || new Date().toISOString(),
        };
        if (
          typeof data.irrigationOn === 'boolean' &&
          ['manual', 'automatic'].includes(data.mode)
        ) {
          irrigation = {
            active: data.irrigationOn,
            mode: data.mode,
            updatedAt: latestTelemetry.timestamp,
          };
        }
        telemetryHistory.push(latestTelemetry);
        io.emit('telemetry:update', latestTelemetry);
        emitStatus();
        if (mongoose.connection.readyState === 1) {
          Telemetry.create(latestTelemetry).catch(() =>
            console.error('Falha ao salvar telemetria'),
          );
        }
      } catch {
        console.error('Telemetria MQTT inválida');
      }
    });
    app.locals.mqtt = client;
  }
}

connectIntegrations().catch((error) =>
  console.error(
    'Falha ao inicializar integrações:',
    error instanceof Error ? error.message : error,
  ),
);
httpServer.listen(port, () =>
  console.log(`Horta Comunitária API disponível em http://localhost:${port}`),
);
