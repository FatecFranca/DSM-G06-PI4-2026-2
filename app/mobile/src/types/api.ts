export type IrrigationMode = 'manual' | 'automatic';

export type Telemetry = {
  soilMoisture: number;
  temperature: number;
  humidity: number;
  timestamp: string;
  irrigationOn?: boolean;
  mode?: IrrigationMode;
};

export type IrrigationState = {
  active: boolean;
  mode: IrrigationMode;
  updatedAt: string;
};

export type HortaStatus = Telemetry & {
  irrigation: IrrigationState;
};

export type Harvest = {
  id: string;
  crop: string;
  category?: string;
  status?: 'planned' | 'growing' | 'ready' | 'available' | 'reserved' | 'delivered' | 'cancelled';
  harvestDate: string;
  plantingDate?: string;
  quantity: number;
  availableQuantity?: number;
  reservedQuantity?: number;
  deliveredQuantity?: number;
  unit?: string;
  notes?: string;
  available: boolean;
  reservedBy?: string;
  reservedAt?: string;
  reservationId?: string;
  reservationQuantity?: number;
};

export type HarvestCalendarEvent = {
  harvestId: string;
  crop: string;
  type: 'planting' | 'harvest';
  date: string;
  status?: Harvest['status'];
  quantity: number;
  unit?: string;
};