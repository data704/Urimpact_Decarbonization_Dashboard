import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  blockPendingPasswordChange,
  blockIncompleteOrganizationOnboarding,
  requireGhgScopeOnboardingComplete,
} from '../middleware/accountStatus.js';
import {
  postScope1CategoryForm,
  postScope2CategoryForm,
  getScope1CategoryEntries,
  getScope2CategoryEntries,
  getStationaryCombustionTemplate,
  getStationaryCombustionLookupOptions,
  postStationaryCombustionBulkPreview,
  postStationaryCombustionBulkConfirm,
  postStationaryCombustionAiExtract,
  postStationaryCombustionAiConfirm,
  postMobileCombustionAiExtract,
  postMobileCombustionAiConfirm,
  postProcessEmissionsAiExtract,
  postProcessEmissionsAiConfirm,
  postFugitiveEmissionsAiExtract,
  postFugitiveEmissionsAiConfirm,
  getMobileCombustionTemplate,
  getMobileCombustionLookupOptions,
  postMobileCombustionBulkPreview,
  postMobileCombustionBulkConfirm,
} from '../controllers/ghgController.js';
import { uploadGhgBulkMemory, uploadReceiptMemory } from '../middleware/upload.js';

const router = Router();

router.use(authenticate);
router.use(blockPendingPasswordChange);
router.use(blockIncompleteOrganizationOnboarding);
router.use(requireGhgScopeOnboardingComplete);

/** Stationary combustion — official Excel template download + bulk preview / confirm (Scope 1 only) */
router.get('/scope-1/categories/stationary-combustion/template', getStationaryCombustionTemplate);
router.get('/scope-1/categories/stationary-combustion/lookup-options', getStationaryCombustionLookupOptions);
router.post(
  '/scope-1/categories/stationary-combustion/bulk/preview',
  uploadGhgBulkMemory.single('file'),
  postStationaryCombustionBulkPreview
);
router.post('/scope-1/categories/stationary-combustion/bulk/confirm', postStationaryCombustionBulkConfirm);

/** Mobile combustion — template download + bulk preview / confirm (Scope 1 only) */
router.get('/scope-1/categories/mobile-combustion/template', getMobileCombustionTemplate);
router.get('/scope-1/categories/mobile-combustion/lookup-options', getMobileCombustionLookupOptions);
router.post(
  '/scope-1/categories/mobile-combustion/bulk/preview',
  uploadGhgBulkMemory.single('file'),
  postMobileCombustionBulkPreview
);
router.post('/scope-1/categories/mobile-combustion/bulk/confirm', postMobileCombustionBulkConfirm);

/** AI receipt extraction — upload image/PDF, get structured data; then confirm to persist */
router.post(
  '/scope-1/categories/stationary-combustion/ai/extract',
  uploadReceiptMemory.single('file'),
  postStationaryCombustionAiExtract
);
router.post('/scope-1/categories/stationary-combustion/ai/confirm', postStationaryCombustionAiConfirm);

/** AI receipt extraction — mobile combustion: upload image/PDF, get structured data; then confirm to persist */
router.post(
  '/scope-1/categories/mobile-combustion/ai/extract',
  uploadReceiptMemory.single('file'),
  postMobileCombustionAiExtract
);
router.post('/scope-1/categories/mobile-combustion/ai/confirm', postMobileCombustionAiConfirm);

/** AI document extraction — process emissions: upload image/PDF, get structured data; then confirm to persist */
router.post(
  '/scope-1/categories/process-emissions/ai/extract',
  uploadReceiptMemory.single('file'),
  postProcessEmissionsAiExtract
);
router.post('/scope-1/categories/process-emissions/ai/confirm', postProcessEmissionsAiConfirm);

/** AI document extraction — fugitive emissions: upload image/PDF, get structured data; then confirm to persist */
router.post(
  '/scope-1/categories/fugitive-emissions/ai/extract',
  uploadReceiptMemory.single('file'),
  postFugitiveEmissionsAiExtract
);
router.post('/scope-1/categories/fugitive-emissions/ai/confirm', postFugitiveEmissionsAiConfirm);

/** One emission row per request — Scope 1 category form */
router.post('/scope-1/categories/:categorySlug/form', postScope1CategoryForm);
router.get('/scope-1/categories/:categorySlug/entries', getScope1CategoryEntries);

/** One emission row per request — Scope 2 category form */
router.post('/scope-2/categories/:categorySlug/form', postScope2CategoryForm);
router.get('/scope-2/categories/:categorySlug/entries', getScope2CategoryEntries);

export default router;
