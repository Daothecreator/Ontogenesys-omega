import { z } from 'zod';

export const presetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  isPublic: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  carrierHz: z.number().min(0.1).max(20000).default(20.51),
  gammaHz: z.number().min(20).max(200).default(90.12),
  deltaHz: z.number().min(0.1).max(4).default(1.25),
  thetaHz: z.number().min(4).max(8).default(5.08),
  lowerHz: z.number().min(0.1).max(100).default(10.55),
  upperHz: z.number().min(1).max(200).default(33.18),
  infralowHz: z.number().min(0.001).max(1).default(0.125),
  carrierMix: z.number().min(0).max(1).default(0.7),
  harmonicMix: z.number().min(0).max(1).default(0.3),
  harmonicDecay: z.number().min(1.01).max(10).default(1.6),
  harmonics: z.number().int().min(1).max(16).default(4),
  stereoWidth: z.number().min(0).max(1).default(0.5),
  stereoExpansion: z.number().min(0).max(2).default(1),
  headroom: z.number().min(0).max(1).default(0.3),
  modDepth: z.number().min(0).max(1).default(0.25),
  gammaIntensity: z.number().min(0).max(1).default(0.6),
  modulationMult: z.number().min(0).max(5).default(1),
  exitCurve: z.number().min(0).max(1).default(0.5),
  durationSec: z.number().min(5).max(3600).default(480),
  attackPercent: z.number().min(0).max(50).default(5),
  releasePercent: z.number().min(0).max(50).default(5),
  mode: z.enum(['action', 'survival', 'recovery', 'drift']).default('drift'),
  tags: z.array(z.string()).default([]),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});
