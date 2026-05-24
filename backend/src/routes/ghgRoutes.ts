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
  getPurchasedElectricityTemplate,
  postPurchasedElectricityBulkPreview,
  postPurchasedElectricityBulkConfirm,
  postPurchasedElectricityAiExtract,
  postPurchasedElectricityAiConfirm,
  getPurchasedHeatingTemplate,
  postPurchasedHeatingBulkPreview,
  postPurchasedHeatingBulkConfirm,
  postPurchasedHeatingAiExtract,
  postPurchasedHeatingAiConfirm,
  getPurchasedCoolingTemplate,
  postPurchasedCoolingBulkPreview,
  postPurchasedCoolingBulkConfirm,
  postPurchasedCoolingAiExtract,
  postPurchasedCoolingAiConfirm,
  getPurchasedSteamingTemplate,
  postPurchasedSteamingBulkPreview,
  postPurchasedSteamingBulkConfirm,
  postPurchasedSteamingAiExtract,
  postPurchasedSteamingAiConfirm,
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

/** Purchased electricity — template download + bulk preview / confirm (Scope 2) */
router.get('/scope-2/categories/purchased-electricity/template', getPurchasedElectricityTemplate);
router.post(
  '/scope-2/categories/purchased-electricity/bulk/preview',
  uploadGhgBulkMemory.single('file'),
  postPurchasedElectricityBulkPreview
);
router.post('/scope-2/categories/purchased-electricity/bulk/confirm', postPurchasedElectricityBulkConfirm);

/** AI document extraction — purchased electricity: upload electricity bill, get structured data; then confirm to persist */
router.post(
  '/scope-2/categories/purchased-electricity/ai/extract',
  uploadReceiptMemory.single('file'),
  postPurchasedElectricityAiExtract
);
router.post('/scope-2/categories/purchased-electricity/ai/confirm', postPurchasedElectricityAiConfirm);

/** Purchased heating — template download + bulk preview / confirm (Scope 2) */
router.get('/scope-2/categories/purchased-heating/template', getPurchasedHeatingTemplate);
router.post(
  '/scope-2/categories/purchased-heating/bulk/preview',
  uploadGhgBulkMemory.single('file'),
  postPurchasedHeatingBulkPreview
);
router.post('/scope-2/categories/purchased-heating/bulk/confirm', postPurchasedHeatingBulkConfirm);

/** AI document extraction — purchased heating: upload heating bill, get structured data; then confirm to persist */
router.post(
  '/scope-2/categories/purchased-heating/ai/extract',
  uploadReceiptMemory.single('file'),
  postPurchasedHeatingAiExtract
);
router.post('/scope-2/categories/purchased-heating/ai/confirm', postPurchasedHeatingAiConfirm);

/** Purchased cooling — template download + bulk preview / confirm (Scope 2) */
router.get('/scope-2/categories/purchased-cooling/template', getPurchasedCoolingTemplate);
router.post(
  '/scope-2/categories/purchased-cooling/bulk/preview',
  uploadGhgBulkMemory.single('file'),
  postPurchasedCoolingBulkPreview
);
router.post('/scope-2/categories/purchased-cooling/bulk/confirm', postPurchasedCoolingBulkConfirm);

/** AI document extraction — purchased cooling: upload cooling bill, get structured data; then confirm to persist */
router.post(
  '/scope-2/categories/purchased-cooling/ai/extract',
  uploadReceiptMemory.single('file'),
  postPurchasedCoolingAiExtract
);
router.post('/scope-2/categories/purchased-cooling/ai/confirm', postPurchasedCoolingAiConfirm);

/** Purchased steaming — template download + bulk preview / confirm (Scope 2) */
router.get('/scope-2/categories/purchased-steaming/template', getPurchasedSteamingTemplate);
router.post(
  '/scope-2/categories/purchased-steaming/bulk/preview',
  uploadGhgBulkMemory.single('file'),
  postPurchasedSteamingBulkPreview
);
router.post('/scope-2/categories/purchased-steaming/bulk/confirm', postPurchasedSteamingBulkConfirm);

/** AI document extraction — purchased steaming: upload steam bill, get structured data; then confirm to persist */
router.post(
  '/scope-2/categories/purchased-steaming/ai/extract',
  uploadReceiptMemory.single('file'),
  postPurchasedSteamingAiExtract
);
router.post('/scope-2/categories/purchased-steaming/ai/confirm', postPurchasedSteamingAiConfirm);

/** One emission row per request — Scope 2 category form */
router.post('/scope-2/categories/:categorySlug/form', postScope2CategoryForm);
router.get('/scope-2/categories/:categorySlug/entries', getScope2CategoryEntries);

export default router;
