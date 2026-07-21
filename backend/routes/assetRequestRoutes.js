const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const mhRequestController = require('../controllers/mhRequestController');

const fs = require('fs');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/AssetRequest/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: timestamp-originalName
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
});

// PUBLIC: approver clicks "Assign" link from email (no auth required)
router.get('/:id/assign-link/:engineerId', mhRequestController.assignEngineerFromLink);

// Apply protection to all routes
router.use(protect);

// @route   POST /api/asset-request
// @desc    Create a new MH request
// @access  Private
router.post('/', protect, checkPermission('assetRequest'), upload.single('drawingFile'), mhRequestController.createMHRequest);

// @route   GET /api/asset-request
// @desc    Get all active MH requests
// @access  Public
router.get('/', mhRequestController.getAllMHRequests);

// @route   POST /api/asset-request/:id/generate-asset
// @desc    Generate Asset ID for an accepted MH request if missing
// @access  Private
router.post('/:id/generate-asset', mhRequestController.generateAssetForRequest);

// @route   PATCH /api/asset-request/:id/assign-engineer
// @desc    Assign PED Engineer to MH request
// @access  Private
router.patch('/:id/assign-engineer', mhRequestController.assignEngineer);

// @route   PATCH /api/asset-request/:id/assign-designer
// @desc    Assign Designer to MH request (via PED Engineer)
// @access  Private
router.patch('/:id/assign-designer', mhRequestController.assignDesigner);

// @route   POST /api/asset-request/:id/email-log
// @desc    Append email log entry to MH request
// @access  Private
router.post('/:id/email-log', mhRequestController.addEmailLog);

// @route   GET /api/asset-request/:id
// @desc    Get single MH request by ID
// @access  Public
router.get('/:id', mhRequestController.getMHRequestById);

// @route   PUT /api/asset-request/:id
// @desc    Update MH request
// @access  Public
router.put('/:id', upload.single('drawingFile'), mhRequestController.updateMHRequest);

// @route   DELETE /api/asset-request/:id
// @desc    Soft delete MH request
// @access  Public
router.delete('/:id', mhRequestController.deleteMHRequest);

// Error handling middleware for Multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: 'File upload error: ' + err.message });
    } else if (err.message === 'Only image files are allowed!') {
        return res.status(400).json({ message: err.message });
    }
    next(err);
});

module.exports = router;
