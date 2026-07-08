const MHDevelopmentTracker = require('../models/MHDevelopmentTracker');
const MHRequest = require('../models/MHRequest');
const Vendor = require('../models/Vendor');
const VendorLoading = require('../models/VendorLoading');
const VendorScoring = require('../models/VendorScoring');
const Employee = require('../models/EmployeeModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/drawings';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'drawing-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, JPG, and PNG files are allowed'));
        }
    }
});

async function ensureTrackerForRequest(request) {
    if (!request || !request.mhRequestId) return;

    const basePayload = {
        departmentName: request.departmentName,
        userName: request.userName,
        assetRequestId: request.mhRequestId,
        requestType: request.requestType,
        productModel: request.productModel,
        plantLocation: request.plantLocation,
        implementationTarget: null,
        status: 'Not Started',
        currentStage: 'Not Started',
        remarks: ''
    };

    const update = {
        $setOnInsert: basePayload,
        $set: {
            materialHandlingEquipment: request.materialHandlingEquipment || ''
        }
    };

    if (request.allocationAssetId) {
        update.$set.assetId = request.allocationAssetId;
    } else {
        update.$setOnInsert.assetId = '';
    }

    await MHDevelopmentTracker.findOneAndUpdate(
        { assetRequestId: request.mhRequestId },
        update,
        { new: true, upsert: true }
    );
}

async function syncTrackersFromAcceptedRequests() {
    const acceptedRequests = await MHRequest.find({ status: 'Accepted', activeStatus: true });
    for (const request of acceptedRequests) {
        await ensureTrackerForRequest(request);
    }
}

const getAllTrackers = async (req, res) => {
    try {
        await syncTrackersFromAcceptedRequests();

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.search) {
            filter.$or = [
                { assetRequestId: { $regex: req.query.search, $options: 'i' } },
                { vendorName: { $regex: req.query.search, $options: 'i' } },
                { departmentName: { $regex: req.query.search, $options: 'i' } },
                { productModel: { $regex: req.query.search, $options: 'i' } },
                { userName: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }

        const trackers = await MHDevelopmentTracker.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await MHDevelopmentTracker.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        const ProjectPlan = require('../models/ProjectPlan');
        const projectPlans = await ProjectPlan.find().lean();
        const planMap = {};
        for (const p of projectPlans) {
            planMap[p.trackerId.toString()] = p;
        }

        for (const t of trackers) {
            const actualPlan = planMap[t._id.toString()];
            if (actualPlan && actualPlan.milestones && t.projectPlan && t.projectPlan.milestones) {
                for (let i = 0; i < t.projectPlan.milestones.length; i++) {
                    const actualMs = actualPlan.milestones.find(m => m.sNo === t.projectPlan.milestones[i].sNo);
                    if (actualMs) {
                        t.projectPlan.milestones[i].actualStart = actualMs.actualStart;
                        t.projectPlan.milestones[i].actualEnd = actualMs.actualEnd;
                        t.projectPlan.milestones[i].delayInDays = actualMs.delayInDays;
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            data: trackers,
            count: trackers.length,
            total,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error('Error fetching trackers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tracker records'
        });
    }
};

// Get single tracker record
const getTrackerById = async (req, res) => {
    try {
        const tracker = await MHDevelopmentTracker.findById(req.params.id).lean();

        if (!tracker) {
            return res.status(404).json({
                success: false,
                message: 'Tracker record not found'
            });
        }

        const ProjectPlan = require('../models/ProjectPlan');
        const actualPlan = await ProjectPlan.findOne({ trackerId: tracker._id }).lean();
        if (actualPlan && actualPlan.milestones && tracker.projectPlan && tracker.projectPlan.milestones) {
            for (let i = 0; i < tracker.projectPlan.milestones.length; i++) {
                const actualMs = actualPlan.milestones.find(m => m.sNo === tracker.projectPlan.milestones[i].sNo);
                if (actualMs) {
                    tracker.projectPlan.milestones[i].actualStart = actualMs.actualStart;
                    tracker.projectPlan.milestones[i].actualEnd = actualMs.actualEnd;
                    tracker.projectPlan.milestones[i].delayInDays = actualMs.delayInDays;
                }
            }
        }

        res.status(200).json({
            success: true,
            data: tracker
        });
    } catch (error) {
        console.error('Error fetching tracker:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tracker record'
        });
    }
};

// Create new tracker record
const createTracker = async (req, res) => {
    try {
        const {
            departmentName,
            userName,
            assetRequestId,
            requestType,
            productModel,
            materialHandlingEquipment,
            plantLocation,
            implementationTarget,
            status,
            currentStage,
            remarks,
            assetId
        } = req.body;

        // Validate required fields
        if (!departmentName || !userName || !assetRequestId || !requestType || !productModel || !plantLocation) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Check for duplicate asset request ID
        const existingTracker = await MHDevelopmentTracker.findOne({ assetRequestId });
        if (existingTracker) {
            return res.status(400).json({
                success: false,
                message: 'Tracker record already exists for this Asset Request ID'
            });
        }

        const tracker = new MHDevelopmentTracker({
            departmentName,
            userName,
            assetRequestId,
            requestType,
            productModel,
            materialHandlingEquipment: materialHandlingEquipment || '',
            plantLocation,
            implementationTarget,
            status: status || 'Not Started',
            currentStage: currentStage || 'Not Started',
            remarks: remarks || '',
            assetId: assetId || ''
        });

        const savedTracker = await tracker.save();

        res.status(201).json({
            success: true,
            message: 'Tracker record created successfully',
            data: savedTracker
        });
    } catch (error) {
        console.error('Error creating tracker:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create tracker record'
        });
    }
};

// Update tracker record
const updateTracker = async (req, res) => {
    try {
        const tracker = await MHDevelopmentTracker.findById(req.params.id);

        if (!tracker) {
            return res.status(404).json({
                success: false,
                message: 'Tracker record not found'
            });
        }

        // Capture previous state before update for change-detection email
        const previousStatus = tracker.status;
        const previousStage = tracker.currentStage;

        // Update fields
        const allowedUpdates = [
            'departmentName', 'userName', 'requestType', 'productModel', 'materialHandlingEquipment', 'plantLocation',
            'vendorCode', 'vendorName', 'vendorLocation', 'vendorId',
            'projectPlan', 'implementationTarget', 'status', 'implementationVisibility',
            'currentStage', 'remarks', 'assetId'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                tracker[field] = req.body[field];
            }
        });

        const updatedTracker = await tracker.save();

        // ── Trigger 3: Notify requester when stage or status changes ──
        const statusChanged = updatedTracker.status !== previousStatus;
        const stageChanged  = updatedTracker.currentStage !== previousStage;
        if (statusChanged || stageChanged) {
            try {
                const MHRequest = require('../models/MHRequest');
                const mhReq = await MHRequest.findOne({ mhRequestId: updatedTracker.assetRequestId });
                const requesterEmployee = mhReq
                    ? await Employee.findOne({ mailId: mhReq.mailId }) || await Employee.findOne({ employeeName: updatedTracker.userName })
                    : await Employee.findOne({ employeeName: updatedTracker.userName });
                const requesterEmail = requesterEmployee?.mailId || mhReq?.mailId;
                if (requesterEmail) {
                    sendTrackerStatusChangeEmail(requesterEmail, {
                        projectId:               updatedTracker.assetRequestId,
                        requesterName:           updatedTracker.userName,
                        previousStatus,
                        newStatus:               updatedTracker.status,
                        previousStage,
                        newStage:                updatedTracker.currentStage,
                        materialHandlingEquipment: updatedTracker.materialHandlingEquipment,
                        departmentName:          updatedTracker.departmentName,
                        plantLocation:           updatedTracker.plantLocation
                    }); // fire and forget
                }
            } catch (emailErr) {
                console.error('[AutoEmail] Tracker status-change email error:', emailErr.message);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Tracker record updated successfully',
            data: updatedTracker
        });
    } catch (error) {
        console.error('Error updating tracker:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update tracker record'
        });
    }
};

// Delete tracker record
const deleteTracker = async (req, res) => {
    try {
        const tracker = await MHDevelopmentTracker.findById(req.params.id);

        if (!tracker) {
            return res.status(404).json({
                success: false,
                message: 'Tracker record not found'
            });
        }

        // Delete associated drawing file if exists
        if (tracker.drawingUrl) {
            const filePath = path.join(__dirname, '..', tracker.drawingUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await MHDevelopmentTracker.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Tracker record deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting tracker:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete tracker record'
        });
    }
};

// Upload drawing
const uploadDrawing = async (req, res) => {
    try {
        const tracker = await MHDevelopmentTracker.findById(req.params.id);

        if (!tracker) {
            return res.status(404).json({
                success: false,
                message: 'Tracker record not found'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Delete old file if exists
        if (tracker.drawingUrl) {
            const oldFilePath = path.join(__dirname, '..', tracker.drawingUrl);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }
        }

        // Update tracker with new file info
        tracker.drawingUrl = req.file.path.replace(/\\/g, '/');
        tracker.drawingFileName = req.file.originalname;

        await tracker.save();

        res.status(200).json({
            success: true,
            message: 'Drawing uploaded successfully',
            data: {
                drawingUrl: tracker.drawingUrl,
                drawingFileName: tracker.drawingFileName
            }
        });
    } catch (error) {
        console.error('Error uploading drawing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload drawing'
        });
    }
};

const { sendVendorAllocationEmail, sendVendorAssignedToRequesterEmail, sendTrackerStatusChangeEmail } = require('./emailController');

// Get vendors for selection (from Vendor Scoring)
const getVendorsForSelection = async (req, res) => {
    try {
        const { location, overrideLocation } = req.query;
        const isAdmin = req.user && req.user.role === 'Admin';

        let query = { status: { $ne: 'INACTIVE' } }; // Only non-INACTIVE vendors by default

        // Logic for location filtering
        // If location is provided AND (it's not an admin OR admin didn't explicitly override)
        if (location && (!isAdmin || overrideLocation !== 'true')) {
            // Fuzzy match: Get the first word of the plant location (e.g., "Hosur" from "Hosur Plant 1")
            // and search for vendors that match that word.
            const firstWord = location.split(/[\s,-]/)[0];
            if (firstWord) {
                query.vendorLocation = { $regex: new RegExp(firstWord, 'i') };
            } else {
                query.vendorLocation = { $regex: new RegExp(`^${location}$`, 'i') };
            }
        }

        let vendors = await Vendor.find(query);

        // If no vendors matched and it's an admin (and they didn't override yet),
        // we could optionally not fall back here, but let the frontend handle it.
        // The requirement says "Only vendors matching the selected plant location should be visible".

        // Get all active projects to calculate current load
        const allActiveProjects = await MHDevelopmentTracker.find({
            status: { $nin: ['Completed', 'Cancelled'] }
        });

        const vendorsWithScores = await Promise.all(
            vendors.map(async (vendor) => {
                const latestScore = await VendorScoring.findOne({ vendorId: vendor._id })
                    .sort({ scoringYear: -1, scoringMonth: -1 })
                    .limit(1);

                // Calculate current load (number of active projects)
                const currentLoad = allActiveProjects.filter(p =>
                    p.vendorId?.toString() === vendor._id.toString()
                ).length;

                return {
                    _id: vendor._id,
                    vendorCode: vendor.vendorCode,
                    vendorName: vendor.vendorName,
                    location: vendor.vendorLocation,
                    vendorMailId: vendor.vendorMailId,
                    qcdScore: latestScore?.qcdScore || 0,
                    qsrScore: latestScore?.qsrScore || 0,
                    costScore: latestScore?.costScore || 0,
                    deliveryScore: latestScore?.deliveryScore || 0,
                    currentLoad: currentLoad
                };
            })
        );

        // Sort by QCD score descending
        vendorsWithScores.sort((a, b) => b.qcdScore - a.qcdScore);

        res.status(200).json({
            success: true,
            data: vendorsWithScores,
            count: vendorsWithScores.length
        });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendors'
        });
    }
};

// Allocate Vendor to Project
const allocateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { vendorId, vendorCode, vendorName, vendorLocation, vendorMailId } = req.body;

        const tracker = await MHDevelopmentTracker.findById(id);
        if (!tracker) {
            return res.status(404).json({
                success: false,
                message: 'Project record not found'
            });
        }

        // 1. Update project record
        tracker.vendorId = vendorId;
        tracker.vendorCode = vendorCode;
        tracker.vendorName = vendorName;
        tracker.vendorLocation = vendorLocation;
        tracker.currentStage = 'Design';
        tracker.status = 'On Track';

        await tracker.save();

        // 2. Sync vendor loading counts
        try {
            const upperCode = vendorCode.trim().toUpperCase();
            const allVendorTrackers = await MHDevelopmentTracker.find({ vendorCode: upperCode });

            let completedProjects = 0;
            let designStageProjects = 0;
            let trialStageProjects = 0;
            let bulkProjects = 0;

            allVendorTrackers.forEach(t => {
                const stage = t.currentStage || 'Not Started';
                if (stage === 'Completed') completedProjects++;
                else if (stage === 'Design' || stage === 'PR/PO') designStageProjects++;
                else if (stage === 'Sample Production') trialStageProjects++;
                else if (stage === 'Production Ready') bulkProjects++;
            });

            let loadingEntry = await VendorLoading.findOne({ vendorCode: upperCode });
            if (!loadingEntry) {
                loadingEntry = new VendorLoading({ vendorCode: upperCode });
            }
            loadingEntry.totalProjects = allVendorTrackers.length;
            loadingEntry.completedProjects = completedProjects;
            loadingEntry.designStageProjects = designStageProjects;
            loadingEntry.trialStageProjects = trialStageProjects;
            loadingEntry.bulkProjects = bulkProjects;
            await loadingEntry.save();
        } catch (syncErr) {
            console.error('Error syncing vendor loading counts:', syncErr);
        }

        // 3. Send notification to vendor
        if (vendorMailId) {
            await sendVendorAllocationEmail(vendorMailId, {
                projectId: tracker.assetRequestId,
                department: tracker.departmentName,
                plant: tracker.plantLocation
            });
        }

        // ── Trigger 2: Notify the original requester that a vendor has been assigned ──
        try {
            const MHRequest = require('../models/MHRequest');
            const mhReq = await MHRequest.findOne({ mhRequestId: tracker.assetRequestId });
            const requesterEmployee = mhReq
                ? await Employee.findOne({ mailId: mhReq.mailId }) || await Employee.findOne({ employeeName: tracker.userName })
                : await Employee.findOne({ employeeName: tracker.userName });
            const requesterEmail = requesterEmployee?.mailId || mhReq?.mailId;
            if (requesterEmail) {
                sendVendorAssignedToRequesterEmail(requesterEmail, {
                    projectId:               tracker.assetRequestId,
                    requesterName:           tracker.userName,
                    vendorName,
                    vendorLocation,
                    materialHandlingEquipment: tracker.materialHandlingEquipment,
                    departmentName:          tracker.departmentName,
                    plantLocation:           tracker.plantLocation
                }); // fire and forget
            }
        } catch (emailErr) {
            console.error('[AutoEmail] Vendor-assigned requester email error:', emailErr.message);
        }

        res.status(200).json({
            success: true,
            message: 'Vendor allocated and notified successfully',
            data: tracker
        });
    } catch (error) {
        console.error('Error allocating vendor:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to allocate vendor'
        });
    }
};

// Get projects assigned to a specific vendor (for Loading Chart → Total Projects → List of projects)
const getProjectsByVendor = async (req, res) => {
    try {
        const { vendorCode } = req.query;
        if (!vendorCode) {
            return res.status(400).json({
                success: false,
                message: 'vendorCode query parameter is required'
            });
        }

        const trackers = await MHDevelopmentTracker.find({
            vendorCode: vendorCode.trim().toUpperCase()
        }).sort({ createdAt: -1 });

        // Return project list with MH Request info
        const projects = trackers.map((t, idx) => ({
            id: t._id,
            sno: idx + 1,
            project: t.materialHandlingEquipment || `Project ${idx + 1}`,
            status: t.status || 'Not Started',
            currentStage: t.currentStage || 'Not Started',
            departmentName: t.departmentName || '-',
            productModel: t.productModel || '-',
            plantLocation: t.plantLocation || '-',
            requestType: t.requestType || '-',
            materialHandlingEquipment: t.materialHandlingEquipment || '-'
        }));

        res.status(200).json({
            success: true,
            data: projects,
            count: projects.length
        });
    } catch (error) {
        console.error('Error fetching vendor projects:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendor projects'
        });
    }
};

module.exports = {
    getAllTrackers,
    getTrackerById,
    createTracker,
    updateTracker,
    deleteTracker,
    uploadDrawing,
    getVendorsForSelection,
    allocateVendor,
    getProjectsByVendor,
    upload
};