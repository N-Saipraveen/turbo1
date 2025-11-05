import { z } from 'zod';

export const ConvertFormSchema = z.object({
  from: z.enum(['sql', 'mongo', 'json']),
  to: z.enum(['sql', 'mongo', 'json']),
  content: z.string().min(1, 'Content is required'),
  dialect: z.enum(['postgres', 'mysql', 'sqlite', 'mongodb']).optional(),
  useAi: z.boolean().default(false),
});

export type ConvertFormData = z.infer<typeof ConvertFormSchema>;
