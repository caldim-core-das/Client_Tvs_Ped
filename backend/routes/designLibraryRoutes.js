const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Admin-only gate for Design Library writes (moved in-file since
// workflowAuthMiddleware.js was removed — its role/transition maps became
// WorkflowDefinition graph data, but this route never dealt with transitions,
// just an admin check, so it gets its own tiny copy here).
const requireWorkflowRole = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const userRole = (req.user.role || '').trim().toLowerCase();
    if (userRole === 'admin' || userRole === 'system admin' || userRole.includes('admin')) return next();
    const allowedLower = roles.map(r => r.toLowerCase());
    if (!allowedLower.includes(userRole)) {
        return res.status(403).json({
            message: `Role '${req.user.role}' is not permitted to perform this action. Required: ${roles.join(' or ')}`
        });
    }
    next();
};

const {
    getAllDesigns,
    searchDesigns,
    getDesignById,
    createDesign,
    updateDesign,
    deleteDesign,
    getLeadTimeMasterRules,
    upsertLeadTimeMasterRule
} = require('../controllers/designLibraryController');

router.use(protect);

// Design Library
router.get('/search',            searchDesigns);
router.get('/',                  getAllDesigns);
router.get('/:id',               getDesignById);
router.post('/',                 requireWorkflowRole('Admin'), createDesign);
router.put('/:id',               requireWorkflowRole('Admin'), updateDesign);
router.delete('/:id',            requireWorkflowRole('Admin'), deleteDesign);

// Lead Time Master (Admin only)
router.get('/lead-time-master',  getLeadTimeMasterRules);
router.post('/lead-time-master', requireWorkflowRole('Admin'), upsertLeadTimeMasterRule);

module.exports = router;
