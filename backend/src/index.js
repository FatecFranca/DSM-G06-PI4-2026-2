import 'dotenv/config';
import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import mqtt from 'mqtt';
import { Server } from 'socket.io';
import { Harvest } from './models/Harvest.js';
import { Reservation } from './models/Reservation.js';
import { AuditLog } from './models/AuditLog.js';
import { Telemetry } from './models/Telemetry.js';
import { seedInitialAdmin } from './auth/bootstrap.js';
import { authRouter } from './auth/routes.js';
import { usersRouter } from './auth/users-routes.js';
import { requireAuth, requirePermission } from './auth/middleware.js';

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
const telemetryPersistIntervalMs = Math.max(
  1000,
  Number(process.env.TELEMETRY_PERSIST_INTERVAL_MS || 10000),
);
let lastPersistedTelemetryAt = 0;
const demoHarvests = [
  {
    id: 'harvest-1',
    crop: 'Alface crespa',
    category: 'leafy',
    status: 'available',
    harvestDate: '2026-09-26T16:00:00.000Z',
    available: true,
    quantity: 24,
    availableQuantity: 24,
    reservedQuantity: 0,
    deliveredQuantity: 0,
    unit: 'unidade',
  },
  {
    id: 'harvest-2',
    crop: 'Cebolinha',
    category: 'herb',
    status: 'available',
    harvestDate: '2026-09-27T08:30:00.000Z',
    available: true,
    quantity: 18,
    availableQuantity: 18,
    reservedQuantity: 0,
    deliveredQuantity: 0,
    unit: 'unidade',
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
  const reservedBy = item.reservedByUserId?._id || item.reservedByUserId || item.reservedBy;
  const availableQuantity = item.availableQuantity ?? (
    item.available ? item.quantity : 0
  );
  const reservedQuantity = item.reservedQuantity ?? item.quantity - availableQuantity;
  return {
    ...item,
    id: item.id || item._id?.toString(),
    _id: undefined,
    harvestDate: new Date(item.harvestDate).toISOString(),
    reservedBy: reservedBy?.toString(),
    availableQuantity,
    reservedQuantity,
    deliveredQuantity: item.deliveredQuantity || 0,
    status: item.status || (item.available ? 'available' : 'reserved'),
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

async function normalizeActiveReservations() {
  const duplicates = await Reservation.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: { harvestId: '$harvestId', userId: '$userId' }, ids: { $push: '$_id' }, quantity: { $sum: '$quantity' } } },
    { $match: { 'ids.1': { $exists: true } } },
  ]);
  for (const duplicate of duplicates) {
    const [keeper, ...obsolete] = duplicate.ids;
    await Reservation.updateOne({ _id: keeper }, { $set: { quantity: duplicate.quantity } });
    await Reservation.deleteMany({ _id: { $in: obsolete } });
  }
  await Reservation.collection.createIndex(
    { harvestId: 1, userId: 1 },
    { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_reservation_per_user' },
  );
}

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }));
app.use(express.json());
io.on('connection', (socket) => {
  socket.emit('status:update', getStatus());
});
app.get('/health', (_request, response) =>
  response.json({ ok: true, service: 'horta-comunitaria-api' }),
);
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }), authRouter);
app.use('/users', usersRouter);
app.get('/status', requireAuth, (_request, response) =>
  response.json(getStatus()),
);
app.get('/telemetry/history', requireAuth, (_request, response) =>
  response.json(telemetryHistory.slice(-100).reverse()),
);
function numericStatistics(values) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  return {
    average: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    minimum: Number(sorted[0].toFixed(2)),
    maximum: Number(sorted[sorted.length - 1].toFixed(2)),
    standardDeviation: Number(Math.sqrt(variance).toFixed(2)),
  };
}

function calculateHealthScore(latest, metrics) {
  if (!latest || !metrics.soilMoisture || !metrics.temperature || !metrics.humidity) return null;
  const soilScore = Math.max(0, 100 - Math.abs(60 - latest.soilMoisture) * 2.5);
  const temperatureScore = Math.max(0, 100 - Math.abs(25 - latest.temperature) * 8);
  const humidityScore = Math.max(0, 100 - Math.abs(65 - latest.humidity) * 2);
  return Math.round((soilScore * 0.4) + (temperatureScore * 0.3) + (humidityScore * 0.3));
}

app.get('/analytics/summary', requireAuth, requirePermission('view_telemetry'), async (request, response, next) => {
  try {
    const allowedRanges = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
    const range = allowedRanges[request.query.range] ? request.query.range : '24h';
    const from = new Date(Date.now() - allowedRanges[range] * 60 * 60 * 1000);
    if (!isMongoReady()) {
      return response.json({
        range,
        from: from.toISOString(),
        to: new Date().toISOString(),
        samples: 0,
        sampling: { configuredIntervalMs: telemetryPersistIntervalMs, averageIntervalMs: null },
        metrics: { soilMoisture: null, temperature: null, humidity: null },
        series: [],
        health: null,
        criticalMinutes: 0,
        irrigation: { cycles: 0, activeMinutes: 0 },
      });
    }
    const readings = await Telemetry.find({ timestamp: { $gte: from } })
      .sort({ timestamp: 1 })
      .limit(10000)
      .lean();
    const values = {
      soilMoisture: readings.map((item) => item.soilMoisture),
      temperature: readings.map((item) => item.temperature),
      humidity: readings.map((item) => item.humidity),
    };
    let criticalMinutes = 0;
    let irrigationCycles = 0;
    let irrigationActiveMinutes = 0;
    let previous = null;
    for (const reading of readings) {
      if (previous) {
        const minutes = Math.min(15, Math.max(0, new Date(reading.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 60000);
        if (previous.soilMoisture < 40 || previous.temperature > 35 || previous.humidity < 50) criticalMinutes += minutes;
        if (reading.irrigationOn && !previous.irrigationOn) irrigationCycles += 1;
        if (previous.irrigationOn) irrigationActiveMinutes += minutes;
      }
      previous = reading;
    }
    const intervals = readings.slice(1).map((item, index) => new Date(item.timestamp).getTime() - new Date(readings[index].timestamp).getTime()).filter((value) => value > 0);
    const series = readings.filter((_item, index) => index % Math.max(1, Math.ceil(readings.length / 120)) === 0).map((item) => ({
      timestamp: item.timestamp,
      soilMoisture: item.soilMoisture,
      temperature: item.temperature,
      humidity: item.humidity,
      irrigationOn: Boolean(item.irrigationOn),
    }));
    const metrics = {
      soilMoisture: numericStatistics(values.soilMoisture),
      temperature: numericStatistics(values.temperature),
      humidity: numericStatistics(values.humidity),
    };
    response.json({
      range,
      from: from.toISOString(),
      to: new Date().toISOString(),
      samples: readings.length,
      sampling: {
        configuredIntervalMs: telemetryPersistIntervalMs,
        averageIntervalMs: intervals.length ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length) : null,
      },
      metrics,
      series,
      health: calculateHealthScore(readings.at(-1), metrics),
      criticalMinutes: Math.round(criticalMinutes),
      irrigation: { cycles: irrigationCycles, activeMinutes: Math.round(irrigationActiveMinutes) },
    });
  } catch (error) {
    next(error);
  }
});
app.post('/irrigation', requireAuth, requirePermission('control_irrigation'), async (request, response) => {
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
  if (isMongoReady()) {
    await AuditLog.create({
      actorUserId: request.user._id,
      action: 'irrigation.commanded',
      targetUserId: request.user._id,
      metadata: { action, mode },
      ip: request.ip,
    });
  }
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
function parsePositiveQuantity(value, fallback = 1) {
  const quantity = Number(value ?? fallback);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

function validateHarvestDates(plantingDate, harvestDate) {
  if (plantingDate && plantingDate > harvestDate) {
    return 'A data do plantio não pode ser posterior à data prevista da colheita.';
  }
  return null;
}

function harvestPayload(body) {
  const quantity = Number(body.quantity);
  const harvestDate = new Date(body.harvestDate);
  const plantingDate = body.plantingDate ? new Date(body.plantingDate) : undefined;
  const crop = typeof body.crop === 'string' ? body.crop.trim() : '';
  if (!crop) {
    return { error: 'Informe a cultura.' };
  }
  if (Number.isNaN(harvestDate.getTime())) {
    return { error: 'Informe uma data de colheita válida.' };
  }
  if (plantingDate && Number.isNaN(plantingDate.getTime())) {
    return { error: 'Informe uma data de plantio válida.' };
  }
  const dateError = validateHarvestDates(plantingDate, harvestDate);
  if (dateError) return { error: dateError };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: 'A quantidade produzida deve ser maior que zero.' };
  }
  return {
    crop,
    category: body.category || 'other',
    status: body.status || 'available',
    plantingDate,
    harvestDate,
    quantity,
    availableQuantity: quantity,
    reservedQuantity: 0,
    deliveredQuantity: 0,
    unit: body.unit?.trim() || 'unidade',
    notes: body.notes?.trim(),
    available: ['available', 'ready'].includes(body.status || 'available'),
  };
}

app.get('/harvest', requireAuth, async (_request, response, next) => {
  try {
    if (!isMongoReady()) return response.json(demoHarvests.map(serializeHarvest));
    const harvests = await Harvest.find().sort({ harvestDate: 1 }).lean();
    response.json(harvests.map(serializeHarvest));
  } catch (error) {
    next(error);
  }
});
app.get('/harvest/calendar', requireAuth, async (request, response, next) => {
  try {
    const from = new Date(request.query.from || new Date().toISOString());
    const to = new Date(request.query.to || new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString());
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      return response.status(422).json({ error: 'Informe um período de calendário válido.' });
    }
    const source = isMongoReady()
      ? await Harvest.find({
        $or: [
          { harvestDate: { $gte: from, $lt: to } },
          { plantingDate: { $gte: from, $lt: to } },
        ],
      }).sort({ harvestDate: 1 }).lean()
      : demoHarvests.filter((harvest) => {
        const harvestDate = new Date(harvest.harvestDate);
        const plantingDate = harvest.plantingDate ? new Date(harvest.plantingDate) : null;
        return (harvestDate >= from && harvestDate < to)
          || (plantingDate && plantingDate >= from && plantingDate < to);
      });
    const events = source.flatMap((harvest) => {
      const base = {
        harvestId: harvest.id,
        crop: harvest.crop,
        status: harvest.status || (harvest.available ? 'available' : 'reserved'),
        unit: harvest.unit || 'unidade',
        quantity: harvest.quantity,
      };
      return [
        ...(harvest.plantingDate && new Date(harvest.plantingDate) >= from && new Date(harvest.plantingDate) < to
          ? [{ ...base, type: 'planting', date: new Date(harvest.plantingDate).toISOString() }]
          : []),
        ...(new Date(harvest.harvestDate) >= from && new Date(harvest.harvestDate) < to
          ? [{ ...base, type: 'harvest', date: new Date(harvest.harvestDate).toISOString() }]
          : []),
      ];
    }).sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    response.json({ from: from.toISOString(), to: to.toISOString(), events });
  } catch (error) {
    next(error);
  }
});
app.get('/harvest/:id', requireAuth, async (request, response, next) => {
  try {
    if (['mine', 'dashboard'].includes(request.params.id)) return next();
    const harvest = isMongoReady()
      ? await Harvest.findOne({ id: request.params.id }).lean()
      : demoHarvests.find((item) => item.id === request.params.id);
    if (!harvest) return response.status(404).json({ error: 'Colheita não encontrada.' });
    response.json(serializeHarvest(harvest));
  } catch (error) {
    next(error);
  }
});
app.get('/harvest/mine', requireAuth, requirePermission('view_harvests'), async (request, response, next) => {
  try {
    if (!isMongoReady()) {
      const reservations = demoHarvests.filter((harvest) => harvest.reservedByUserId?.toString() === request.user._id.toString());
      return response.json(reservations.map(serializeHarvest));
    }
    const reservations = await Reservation.find({ userId: request.user._id, status: 'active' })
      .populate('harvestId')
      .sort({ reservedAt: -1 })
      .lean();
    response.json(reservations.map((reservation) => ({
      ...serializeHarvest(reservation.harvestId),
      reservationId: reservation._id.toString(),
      reservedQuantity: reservation.quantity,
      reservationStatus: reservation.status,
    })));
  } catch (error) {
    next(error);
  }
});
app.post('/harvest', requireAuth, requirePermission('manage_harvests'), async (request, response, next) => {
  try {
    const payload = harvestPayload(request.body);
    if (payload.error) return response.status(422).json({ error: payload.error });
    payload.id = `harvest-${Date.now()}`;
    payload.createdBy = request.user._id;
    if (!isMongoReady()) {
      demoHarvests.push(payload);
      io.emit('harvest:created', serializeHarvest(payload));
      return response.status(201).json(serializeHarvest(payload));
    }
    const createdHarvest = await Harvest.create(payload);
    await AuditLog.create({
      actorUserId: request.user._id,
      action: 'harvest.created',
      targetUserId: request.user._id,
      metadata: { harvestId: createdHarvest.id },
      ip: request.ip,
    });
    const serialized = serializeHarvest(createdHarvest);
    io.emit('harvest:created', serialized);
    response.status(201).json(serialized);
  } catch (error) {
    next(error);
  }
});
app.patch('/harvest/:id/status', requireAuth, requirePermission('manage_harvests'), async (request, response, next) => {
  try {
    const allowed = ['planned', 'growing', 'ready', 'available', 'cancelled'];
    if (!allowed.includes(request.body.status)) return response.status(422).json({ error: 'Status de colheita inválido.' });
    const harvest = isMongoReady()
      ? await Harvest.findOneAndUpdate({ id: request.params.id }, { $set: { status: request.body.status, available: request.body.status === 'available' } }, { new: true })
      : demoHarvests.find((item) => item.id === request.params.id);
    if (!harvest) return response.status(404).json({ error: 'Colheita não encontrada.' });
    if (!isMongoReady()) harvest.status = request.body.status;
    const serialized = serializeHarvest(harvest);
    io.emit('harvest:statusChanged', serialized);
    response.json(serialized);
  } catch (error) {
    next(error);
  }
});
app.patch('/harvest/:id', requireAuth, requirePermission('manage_harvests'), async (request, response, next) => {
  try {
    if (!isMongoReady()) return response.status(503).json({ error: 'Edição persistente indisponível sem MongoDB.' });
    const current = await Harvest.findOne({ id: request.params.id }).lean();
    if (!current) return response.status(404).json({ error: 'Colheita não encontrada.' });
    const updates = {};
    for (const field of ['crop', 'category', 'unit', 'notes']) {
      if (request.body[field] !== undefined) updates[field] = String(request.body[field]).trim();
    }
    if (request.body.status !== undefined) {
      const allowed = ['planned', 'growing', 'ready', 'available', 'cancelled'];
      if (!allowed.includes(request.body.status)) return response.status(422).json({ error: 'Status de colheita inválido.' });
      updates.status = request.body.status;
      updates.available = ['ready', 'available'].includes(request.body.status);
    }
    if (request.body.plantingDate !== undefined) {
      const date = new Date(request.body.plantingDate);
      if (Number.isNaN(date.getTime())) return response.status(422).json({ error: 'Data de plantio inválida.' });
      updates.plantingDate = date;
    }
    if (request.body.harvestDate !== undefined) {
      const date = new Date(request.body.harvestDate);
      if (Number.isNaN(date.getTime())) return response.status(422).json({ error: 'Data de colheita inválida.' });
      updates.harvestDate = date;
    }
    const effectivePlantingDate = updates.plantingDate || current.plantingDate;
    const effectiveHarvestDate = updates.harvestDate || current.harvestDate;
    const dateError = validateHarvestDates(effectivePlantingDate, effectiveHarvestDate);
    if (dateError) return response.status(422).json({ error: dateError });
    if (request.body.quantity !== undefined) {
      const quantity = Number(request.body.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return response.status(422).json({ error: 'A quantidade deve ser maior que zero.' });
      const committed = (current.reservedQuantity || 0) + (current.deliveredQuantity || 0);
      if (quantity < committed) return response.status(409).json({ error: 'A quantidade não pode ser menor que o estoque já reservado ou entregue.' });
      updates.quantity = quantity;
      updates.availableQuantity = quantity - committed;
    }
    const harvest = await Harvest.findOneAndUpdate({ id: request.params.id }, { $set: updates }, { new: true });
    if (!harvest) return response.status(404).json({ error: 'Colheita não encontrada.' });
    await AuditLog.create({
      actorUserId: request.user._id,
      action: 'harvest.updated',
      targetUserId: request.user._id,
      metadata: { harvestId: harvest.id, fields: Object.keys(updates) },
      ip: request.ip,
    });
    io.emit('harvest:updated', serializeHarvest(harvest));
    response.json(serializeHarvest(harvest));
  } catch (error) {
    next(error);
  }
});
app.delete('/harvest/:id', requireAuth, requirePermission('manage_harvests'), async (request, response, next) => {
  try {
    if (!isMongoReady()) return response.status(503).json({ error: 'Exclusão persistente indisponível sem MongoDB.' });
    const harvest = await Harvest.findOne({ id: request.params.id });
    if (!harvest) return response.status(404).json({ error: 'Colheita não encontrada.' });
    const activeReservation = await Reservation.exists({ harvestCode: harvest.id, status: 'active' });
    if (activeReservation) return response.status(409).json({ error: 'Não é possível excluir uma colheita com reservas ativas.' });
    await harvest.deleteOne();
    await AuditLog.create({
      actorUserId: request.user._id,
      action: 'harvest.deleted',
      targetUserId: request.user._id,
      metadata: { harvestId: harvest.id },
      ip: request.ip,
    });
    io.emit('harvest:updated', { id: harvest.id, status: 'deleted' });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
app.put('/harvest/:id/reserve', requireAuth, requirePermission('reserve_harvest'), async (request, response, next) => {
  try {
    const quantity = parsePositiveQuantity(request.body.quantity);
    if (!quantity) return response.status(422).json({ error: 'Informe uma quantidade inteira maior que zero.' });
    if (!isMongoReady()) {
      const harvest = demoHarvests.find((item) => item.id === request.params.id);
      if (!harvest) return response.status(404).json({ error: 'Colheita não encontrada.' });
      if ((harvest.availableQuantity ?? harvest.quantity) < quantity) return response.status(409).json({ error: 'Quantidade indisponível.' });
      harvest.availableQuantity = (harvest.availableQuantity ?? harvest.quantity) - quantity;
      harvest.reservedQuantity = (harvest.reservedQuantity || 0) + quantity;
      harvest.available = harvest.availableQuantity > 0;
      harvest.status = harvest.available ? 'available' : 'reserved';
      harvest.reservedByUserId = request.user._id.toString();
      harvest.reservedAt = new Date().toISOString();
      io.emit('reservation:created', serializeHarvest(harvest));
      return response.json(serializeHarvest(harvest));
    }
    const existingReservation = await Reservation.findOne({
      harvestCode: request.params.id,
      userId: request.user._id,
      status: 'active',
    }).lean();
    if (existingReservation) return response.status(409).json({ error: 'Você já possui uma reserva ativa para esta colheita. Cancele-a antes de fazer uma nova.' });
    const sourceHarvest = await Harvest.findOne({ id: request.params.id, status: { $in: ['ready', 'available'] } }).lean();
    if (!sourceHarvest) return response.status(404).json({ error: 'Colheita não encontrada ou indisponível.' });
    let reservation;
    try {
      reservation = await Reservation.create({
        harvestId: sourceHarvest._id,
        harvestCode: sourceHarvest.id,
        userId: request.user._id,
        quantity,
      });
    } catch (error) {
      if (error?.code === 11000) return response.status(409).json({ error: 'Você já possui uma reserva ativa para esta colheita.' });
      throw error;
    }
    const harvest = await Harvest.findOneAndUpdate(
      { _id: sourceHarvest._id, availableQuantity: { $gte: quantity } },
      { $inc: { availableQuantity: -quantity, reservedQuantity: quantity }, $set: { status: 'available', available: true } },
      { new: true },
    );
    if (!harvest) {
      await Reservation.deleteOne({ _id: reservation._id });
      return response.status(409).json({ error: 'Quantidade indisponível.' });
    }
    await AuditLog.create({
      actorUserId: request.user._id,
      action: 'harvest.reserved',
      targetUserId: request.user._id,
      metadata: { harvestId: harvest.id, reservationId: reservation._id.toString(), quantity },
      ip: request.ip,
    });
    const serialized = { ...serializeHarvest(harvest), reservationId: reservation._id.toString(), reservationQuantity: quantity };
    io.emit('reservation:created', serialized);
    response.json(serialized);
  } catch (error) {
    next(error);
  }
});
app.put('/harvest/:id/cancel-reservation', requireAuth, requirePermission('reserve_harvest'), async (request, response, next) => {
  try {
    if (!isMongoReady()) {
      const harvest = demoHarvests.find((item) => item.id === request.params.id && item.reservedByUserId?.toString() === request.user._id.toString());
      if (!harvest) return response.status(404).json({ error: 'Reserva não encontrada.' });
      harvest.availableQuantity = (harvest.availableQuantity || 0) + (harvest.reservedQuantity || 1);
      harvest.reservedQuantity = 0;
      harvest.available = true;
      harvest.status = 'available';
      delete harvest.reservedByUserId;
      return response.json(serializeHarvest(harvest));
    }
    const reservation = await Reservation.findOneAndUpdate(
      { harvestCode: request.params.id, userId: request.user._id, status: 'active' },
      { $set: { status: 'cancelled', cancelledAt: new Date() } },
      { new: true },
    );
    if (!reservation) return response.status(404).json({ error: 'Reserva não encontrada.' });
    const harvest = await Harvest.findOneAndUpdate(
      { id: request.params.id },
      { $inc: { availableQuantity: reservation.quantity, reservedQuantity: -reservation.quantity }, $set: { available: true, status: 'available' } },
      { new: true },
    );
    await AuditLog.create({
      actorUserId: request.user._id,
      action: 'harvest.reservation_cancelled',
      targetUserId: request.user._id,
      metadata: { harvestId: request.params.id, reservationId: reservation._id.toString() },
      ip: request.ip,
    });
    io.emit('reservation:cancelled', { harvestId: request.params.id, reservationId: reservation._id.toString() });
    response.json(serializeHarvest(harvest));
  } catch (error) {
    next(error);
  }
});

app.get('/reservations', requireAuth, requirePermission('manage_reservations'), async (request, response, next) => {
  try {
    if (!isMongoReady()) return response.json({ reservations: [] });
    const status = request.query.status || 'active';
    const filter = status === 'all'
      ? {}
      : { status: status === 'history' ? { $in: ['cancelled', 'delivered', 'expired'] } : status };
    const reservations = await Reservation.find(filter)
      .populate('harvestId', 'id crop harvestDate unit')
      .populate('userId', 'fullName email')
      .sort({ reservedAt: -1 })
      .lean();
    response.json({ reservations });
  } catch (error) {
    next(error);
  }
});
app.patch('/reservations/:id/status', requireAuth, requirePermission('manage_reservations'), async (request, response, next) => {
  try {
    if (!['delivered', 'cancelled'].includes(request.body.status)) return response.status(422).json({ error: 'Status de reserva inválido.' });
    const reservation = await Reservation.findOne({ _id: request.params.id, status: 'active' });
    if (!reservation) return response.status(404).json({ error: 'Reserva ativa não encontrada.' });
    reservation.status = request.body.status;
    reservation.deliveredAt = request.body.status === 'delivered' ? new Date() : undefined;
    reservation.cancelledAt = request.body.status === 'cancelled' ? new Date() : undefined;
    await reservation.save();
    if (request.body.status === 'delivered') {
      await Harvest.findByIdAndUpdate(reservation.harvestId, { $inc: { reservedQuantity: -reservation.quantity, deliveredQuantity: reservation.quantity }, $set: { status: 'delivered' } });
    } else {
      await Harvest.findByIdAndUpdate(reservation.harvestId, { $inc: { reservedQuantity: -reservation.quantity, availableQuantity: reservation.quantity }, $set: { available: true, status: 'available' } });
    }
    await AuditLog.create({
      actorUserId: request.user._id,
      action: `reservation.${request.body.status}`,
      targetUserId: reservation.userId,
      metadata: { reservationId: reservation._id.toString(), quantity: reservation.quantity },
      ip: request.ip,
    });
    io.emit(`reservation:${request.body.status}`, { reservationId: reservation._id.toString(), harvestId: reservation.harvestCode });
    response.json({ reservation });
  } catch (error) {
    next(error);
  }
});
app.get('/harvest/dashboard', requireAuth, requirePermission('view_harvests'), async (_request, response, next) => {
  try {
    if (!isMongoReady()) return response.json({ totals: { harvests: demoHarvests.length, produced: demoHarvests.reduce((sum, item) => sum + item.quantity, 0), available: demoHarvests.reduce((sum, item) => sum + (item.availableQuantity ?? item.quantity), 0), reserved: 0, delivered: 0 } });
    const [totals] = await Harvest.aggregate([{ $group: { _id: null, harvests: { $sum: 1 }, produced: { $sum: '$quantity' }, available: { $sum: '$availableQuantity' }, reserved: { $sum: '$reservedQuantity' }, delivered: { $sum: '$deliveredQuantity' } } }]);
    response.json({ totals: totals || { harvests: 0, produced: 0, available: 0, reserved: 0, delivered: 0 } });
  } catch (error) {
    next(error);
  }
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
    await Harvest.updateMany(
      { availableQuantity: { $exists: false } },
      [
        {
          $set: {
            availableQuantity: { $cond: ['$available', '$quantity', 0] },
            reservedQuantity: { $cond: ['$available', 0, '$quantity'] },
            deliveredQuantity: 0,
            status: { $cond: ['$available', 'available', 'reserved'] },
          },
        },
      ],
    );
    await normalizeActiveReservations();
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
        const telemetryTime = new Date(latestTelemetry.timestamp).getTime();
        if (
          mongoose.connection.readyState === 1
          && Number.isFinite(telemetryTime)
          && (telemetryTime - lastPersistedTelemetryAt >= telemetryPersistIntervalMs)
        ) {
          lastPersistedTelemetryAt = telemetryTime;
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
