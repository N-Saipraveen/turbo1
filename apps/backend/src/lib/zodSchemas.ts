import { z } from 'zod';

export const ConvertRequestSchema = z.object({
  from: z.enum(['sql', 'mongo', 'json']),
  to: z.enum(['sql', 'mongo', 'json']),
  content: z.string().min(1),
  options: z.object({
    dialect: z.enum(['postgres', 'mysql', 'sqlite', 'mongodb']).optional(),
    ai: z.boolean().optional(),
  }).optional(),
});

export type ConvertRequest = z.infer<typeof ConvertRequestSchema>;

export const AnalyzeRequestSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['sql', 'mongo', 'json']),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
