import { z } from 'zod';

export const PolicyRuleSchema = z.object({
  tool: z.string().min(1),
  effect: z.enum(['allow', 'approve', 'deny']),
  roles: z.array(z.string()).optional(),
  resourceScope: z.string().optional(),
  reasonCode: z.string().min(1),
  approvalTtlSeconds: z.number().positive().optional(),
});

export const PolicySchema = z.object({
  version: z.string().min(1),
  defaultEffect: z.enum(['allow', 'approve', 'deny']).default('deny'),
  rules: z.array(PolicyRuleSchema),
});

export function validatePolicy(data: unknown) {
  return PolicySchema.parse(data);
}
