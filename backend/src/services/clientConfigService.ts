import prisma from '../config/database.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

export interface SaveClientConfigInput {
  userId: string;
  targetYear: number;
  ambitionLevel: string;
  capexOpexPreference?: string | null;
  supportingDocuments?: string[];
}

/**
 * Save client inputs & constraints (creates new record each time for history)
 */
export async function saveClientConfig(input: SaveClientConfigInput) {
  const config = await prisma.clientConfig.create({
    data: {
      userId: input.userId,
      targetYear: input.targetYear,
      ambitionLevel: input.ambitionLevel,
      capexOpexPreference: input.capexOpexPreference ?? null,
      supportingDocuments: input.supportingDocuments ?? [],
    },
  });

  logger.info(`Client config saved: ${config.id} for user ${input.userId}`);
  return config;
}

/**
 * Get latest client config for user
 */
export async function getLatestClientConfig(userId: string) {
  const config = await prisma.clientConfig.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!config) {
    throw new NotFoundError('Client configuration');
  }

  return config;
}

/**
 * Get latest client config or null (for report calculations when config may not exist yet)
 */
export async function getLatestClientConfigOrNull(userId: string) {
  return prisma.clientConfig.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
