import prisma from '../config/database.js';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { deleteUploadedFile } from '../middleware/upload.js';
import { DocumentFilters, ExtractedDocumentData } from '../types/index.js';
import { parsePagination } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

interface CreateDocumentInput {
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  s3Key?: string;
  documentType?: DocumentType;
}

/**
 * Create a new document record
 */
export async function createDocument(input: CreateDocumentInput) {
  const document = await prisma.document.create({
    data: {
      userId: input.userId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      filePath: input.filePath,
      s3Key: input.s3Key,
      documentType: input.documentType || 'OTHER',
      status: 'UPLOADED',
    },
  });

  logger.info(`Document created: ${document.id} for user ${input.userId}`);
  return document;
}

/**
 * Get document by ID with ownership check
 */
export async function getDocumentById(documentId: string, userId: string, isAdmin = false) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      emissions: true,
    },
  });

  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check ownership unless admin
  if (!isAdmin && document.userId !== userId) {
    throw new ForbiddenError('You do not have access to this document');
  }

  if (document.deletedAt) {
    throw new NotFoundError('Document');
  }

  return document;
}

/**
 * Get user's documents with pagination and filters
 */
export async function getUserDocuments(
  userId: string,
  filters: DocumentFilters,
  query: { page?: string; limit?: string }
) {
  const { page, limit, skip } = parsePagination(query);

  const where: {
    userId: string;
    deletedAt: null;
    status?: DocumentStatus;
    documentType?: DocumentType;
    uploadedAt?: { gte?: Date; lte?: Date };
  } = {
    userId,
    deletedAt: null,
  };

  // Apply filters
  if (filters.status) {
    where.status = filters.status as DocumentStatus;
  }

  if (filters.documentType) {
    where.documentType = filters.documentType as DocumentType;
  }

  if (filters.startDate || filters.endDate) {
    where.uploadedAt = {};
    if (filters.startDate) {
      where.uploadedAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.uploadedAt.lte = new Date(filters.endDate);
    }
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take: limit,
      orderBy: { uploadedAt: 'desc' },
      include: {
        _count: {
          select: { emissions: true },
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents,
    pagination: { page, limit, total },
  };
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  errorMessage?: string
) {
  const updateData: {
    status: DocumentStatus;
    processedAt?: Date;
    errorMessage?: string;
  } = { status };

  if (status === 'COMPLETED' || status === 'FAILED') {
    updateData.processedAt = new Date();
  }

  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }

  const document = await prisma.document.update({
    where: { id: documentId },
    data: updateData,
  });

  logger.info(`Document ${documentId} status updated to ${status}`);
  return document;
}

/**
 * Update document with OCR results.
 * extractedData can be a single ExtractedDocumentData or { entries: array } for multi-row (e.g. Excel).
 * Status is set to PROCESSING so the user can submit to Climatiq; only submit sets COMPLETED.
 */
export async function updateDocumentOCR(
  documentId: string,
  ocrData: object,
  extractedData: ExtractedDocumentData | { entries: unknown[] }
) {
  const isMulti = typeof extractedData === 'object' && Array.isArray((extractedData as { entries?: unknown[] }).entries);
  const document = await prisma.document.update({
    where: { id: documentId },
    data: {
      ocrData,
      extractedData: extractedData as object,
      status: 'PROCESSING', // await user submit to Climatiq; submit endpoint sets COMPLETED
      processedAt: new Date(),
    },
  });

  logger.info(`Document ${documentId} OCR data updated${isMulti ? ' (multi-row)' : ''}`);
  return document;
}

/**
 * Soft delete a document
 */
export async function deleteDocument(documentId: string, userId: string, isAdmin = false) {
  // Get document first
  const document = await getDocumentById(documentId, userId, isAdmin);

  // Soft delete
  await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });

  // Try to delete the actual file
  try {
    await deleteUploadedFile(document.filePath);
  } catch (error) {
    logger.warn(`Failed to delete file for document ${documentId}:`, error);
  }

  logger.info(`Document ${documentId} deleted by user ${userId}`);
  return { success: true };
}

/**
 * Get document counts by status for a user
 */
export async function getDocumentStats(userId: string) {
  const stats = await prisma.document.groupBy({
    by: ['status'],
    where: {
      userId,
      deletedAt: null,
    },
    _count: true,
  });

  const result: Record<string, number> = {
    UPLOADED: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    FAILED: 0,
  };

  stats.forEach((stat) => {
    result[stat.status] = stat._count;
  });

  return result;
}

/**
 * Get recent documents for a user
 */
export async function getRecentDocuments(userId: string, limit = 5) {
  return prisma.document.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: { uploadedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      fileName: true,
      documentType: true,
      status: true,
      uploadedAt: true,
    },
  });
}

/**
 * Get all documents (admin only)
 */
export async function getAllDocuments(
  filters: DocumentFilters & { userId?: string },
  query: { page?: string; limit?: string }
) {
  const { page, limit, skip } = parsePagination(query);

  const where: {
    deletedAt: null;
    userId?: string;
    status?: DocumentStatus;
    documentType?: DocumentType;
    uploadedAt?: { gte?: Date; lte?: Date };
  } = {
    deletedAt: null,
  };

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.status) {
    where.status = filters.status as DocumentStatus;
  }

  if (filters.documentType) {
    where.documentType = filters.documentType as DocumentType;
  }

  if (filters.startDate || filters.endDate) {
    where.uploadedAt = {};
    if (filters.startDate) {
      where.uploadedAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.uploadedAt.lte = new Date(filters.endDate);
    }
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take: limit,
      orderBy: { uploadedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            company: true,
          },
        },
        _count: {
          select: { emissions: true },
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents,
    pagination: { page, limit, total },
  };
}
