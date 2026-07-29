const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/authMiddleware');
const {
    getDraft, saveDraft, publish, getHistory, getVersion, exportDefinition, importDefinition, testRun,
    getPresets, createPreset, deletePreset
} = require('../controllers/workflowDefinitionController');

router.use(protect);

router.get('/draft', getDraft);
router.put('/draft', checkPermission('workflowStudio'), saveDraft);
router.post('/publish', checkPermission('workflowStudio'), publish);
router.get('/history', getHistory);
router.get('/export', exportDefinition);
router.post('/import', checkPermission('workflowStudio'), importDefinition);
router.post('/test-run', testRun);

// Custom node presets (Studio's "CUSTOM" library section)
router.get('/presets', getPresets);
router.post('/presets', checkPermission('workflowStudio'), createPreset);
router.delete('/presets/:presetId', checkPermission('workflowStudio'), deletePreset);

// NOTE: keep this catch-all last — /:version would otherwise swallow /presets
router.get('/:version', getVersion);

module.exports = router;
