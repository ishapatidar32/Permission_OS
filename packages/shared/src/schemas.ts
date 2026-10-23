import { z } from 'zod';

export const ReadOrderInputSchema = z
  .object({
    orderId: z
      .string()
      .min(1, 'orderId must be between 1 and 32 characters')
      .max(32, 'orderId must be between 1 and 32 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'orderId contains invalid characters'),
  })
  .strict();

export const UpdateDeliveryAddressInputSchema = z
  .object({
    orderId: z
      .string()
      .min(1, 'orderId must be between 1 and 32 characters')
      .max(32, 'orderId must be between 1 and 32 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'orderId contains invalid characters'),
    address: z
      .string()
      .transform((val) => val.trim().normalize('NFKC'))
      .pipe(
        z
          .string()
          .min(5, 'address must be at least 5 characters')
          .max(200, 'address cannot exceed 200 characters')
      ),
  })
  .strict();

export const ExportAllCustomersInputSchema = z
  .object({
    format: z.enum(['json', 'csv']).optional(),
  })
  .strict();

export const GetActionStatusInputSchema = z
  .object({
    approvalId: z.string().min(1).max(64),
  })
  .strict();

export const DecisionInputSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
  })
  .strict();
