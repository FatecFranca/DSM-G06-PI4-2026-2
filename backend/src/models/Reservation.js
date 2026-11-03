import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema(
  {
    harvestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Harvest', required: true, index: true },
    harvestCode: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quantity: { type: Number, min: 1, required: true },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'delivered'],
      default: 'active',
      index: true,
    },
    reservedAt: { type: Date, default: Date.now },
    cancelledAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

reservationSchema.index({ harvestId: 1, userId: 1, status: 1 });

export const Reservation = mongoose.model('Reservation', reservationSchema);
