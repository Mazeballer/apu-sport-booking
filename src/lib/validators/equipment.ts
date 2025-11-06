import { z } from 'zod';

export const upsertEquipmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, 'Equipment name is required').max(100),
  facilityId: z.string().uuid({ message: 'Facility selection is required' }),
  qtyTotal: z.coerce
    .number()
    .int()
    .min(1, 'Total quantity must be greater than 0'),
  qtyAvailable: z.coerce
    .number()
    .int()
    .min(0, 'Available quantity cannot be negative'),
});

export const deleteSchema = z.object({
  id: z.string().uuid(),
});
