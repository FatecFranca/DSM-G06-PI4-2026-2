import mongoose from 'mongoose';

const telemetrySchema = new mongoose.Schema(
  {
    soilMoisture: { type: Number, min: 0, max: 100, required: true },
    temperature: { type: Number, required: true },
    humidity: { type: Number, min: 0, max: 100, required: true },
    irrigationOn: { type: Boolean, default: false },
    mode: { type: String, enum: ['manual', 'automatic'] },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

export const Telemetry = mongoose.model('Telemetry', telemetrySchema);
