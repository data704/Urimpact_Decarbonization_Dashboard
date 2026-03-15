// Auth Controllers
export {
  register,
  login,
  refresh,
  logout,
  getProfile,
  updateProfile,
  changeUserPassword,
} from './authController.js';

// Document Controllers
export {
  uploadDocument,
  getDocuments,
  getDocument,
  removeDocument,
  processDocument,
} from './documentController.js';

// Emission Controllers
export {
  getEmissions,
  getEmission,
  calculateEmission,
  removeEmission,
  getEmissionsSummary,
  exportEmissions,
} from './emissionController.js';

// Report Controllers
export {
  getDashboard,
  getTrends,
  getReportInsights,
  getComplianceReport,
  generateCustomReport,
} from './reportController.js';

// Client Config Controllers
export { saveConfig, getConfig } from './clientConfigController.js';

// Admin Controllers
export {
  getUsers,
  getUser,
  createUser,
  updateUser,
  getAuditLogsHandler,
  getSystemStats,
  getAllDocumentsHandler,
} from './adminController.js';
