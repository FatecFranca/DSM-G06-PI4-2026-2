import mongoose from 'mongoose';

const harvestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    crop: { type: String, required: true, trim: true },
    harvestDate: { type: Date, required: true, index: true },
    quantity: { type: Number, min: 0, default: 0 },
    available: { type: Boolean, default: true, index: true },
    reservedBy: { type: String, trim: true },
    reservedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    reservedAt: { type: Date },
  },
  { versionKey: false },
);

export const Harvest = mongoose.model('Harvest', harvestSchema);
