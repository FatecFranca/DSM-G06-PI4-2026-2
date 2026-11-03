import mongoose from 'mongoose';

const harvestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    crop: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'other' },
    status: {
      type: String,
      enum: ['planned', 'growing', 'ready', 'available', 'reserved', 'delivered', 'cancelled'],
      default: 'available',
      index: true,
    },
    plantingDate: { type: Date, index: true },
    harvestDate: { type: Date, required: true, index: true },
    quantity: { type: Number, min: 0, required: true, default: 0 },
    availableQuantity: { type: Number, min: 0, default: 0 },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    deliveredQuantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true, default: 'unidade' },
    notes: { type: String, trim: true },
    available: { type: Boolean, default: true, index: true },
    reservedBy: { type: String, trim: true },
    reservedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    reservedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { versionKey: false },
);

export const Harvest = mongoose.model('Harvest', harvestSchema);
