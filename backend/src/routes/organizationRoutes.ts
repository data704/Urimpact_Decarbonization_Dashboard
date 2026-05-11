import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getMyOrganization,
  putOnboardingDraft,
  postRegistrationDocument,
  postOnboardingFacilityProof,
  submitOnboarding,
  putScopeOnboardingDraft,
  postScope1OnboardingSubmit,
  postScope2OnboardingSubmit,
} from '../controllers/onboardingController.js';
import { uploadOrgRegistration } from '../middleware/upload.js';

const router = Router();

router.use(authenticate);

router.get('/me', getMyOrganization);
router.put('/me/onboarding/draft', putOnboardingDraft);
router.post(
  '/me/onboarding/registration-document',
  uploadOrgRegistration.single('file'),
  postRegistrationDocument
);
router.post(
  '/me/onboarding/facility-proof-document',
  uploadOrgRegistration.single('file'),
  postOnboardingFacilityProof
);
router.post('/me/onboarding/submit', submitOnboarding);
router.put('/me/onboarding/scope-draft', putScopeOnboardingDraft);
router.post('/me/onboarding/scope1/submit', postScope1OnboardingSubmit);
router.post('/me/onboarding/scope2/submit', postScope2OnboardingSubmit);

export default router;
