const Vendor = require('../models/Vendor');

// @desc    Get all vendors with pagination
// @route   GET /api/vendor
// @access  Private
const getAllVendors = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.search) {
            filter.$or = [
                { vendorCode: { $regex: req.query.search, $options: 'i' } },
                { vendorName: { $regex: req.query.search, $options: 'i' } },
                { vendorLocation: { $regex: req.query.search, $options: 'i' } },
                { vendorMailId: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const vendors = await Vendor.find(filter)
            .sort({ sNo: 1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Vendor.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            success: true,
            count: vendors.length,
            total,
            totalPages,
            currentPage: page,
            data: vendors
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get next vendor ID (useful for frontend form)
// @route   GET /api/vendor/next-id
// @access  Private
const getNextVendorId = async (req, res) => {
    try {
        const lastVendor = await Vendor.findOne().sort({ sNo: -1 });
        const nextId = lastVendor ? lastVendor.sNo + 1 : 1;
        res.status(200).json({ nextId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single vendor
// @route   GET /api/vendor/:id
// @access  Private
const getVendorById = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        res.status(200).json(vendor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new vendor
// @route   POST /api/vendor
// @access  Private
const createVendor = async (req, res) => {
    try {
        const { vendorCode, vendorName, GSTIN, vendorLocation, vendorMailId, vendorCapacity, remarks } = req.body;

        // Check if vendor already exists
        const vendorExists = await Vendor.findOne({ $or: [{ vendorCode }, { GSTIN }] });
        if (vendorExists) {
            return res.status(400).json({ message: 'Vendor code or GSTIN already exists' });
        }

        const vendor = await Vendor.create({
            vendorCode,
            vendorName,
            GSTIN,
            vendorLocation,
            vendorMailId,
            vendorCapacity: vendorCapacity || 10,
            remarks
        });

        res.status(201).json(vendor);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update vendor
// @route   PUT /api/vendor/:id
// @access  Private
const updateVendor = async (req, res) => {
    try {
        const { vendorCode, vendorName, GSTIN, vendorLocation, vendorMailId, vendorCapacity, remarks } = req.body;

        const vendor = await Vendor.findById(req.params.id);

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Check for duplicate GSTIN or Code if changed
        if (vendorCode && vendorCode !== vendor.vendorCode) {
            const codeExists = await Vendor.findOne({ vendorCode });
            if (codeExists) return res.status(400).json({ message: 'Vendor Code already exists' });
        }
        if (GSTIN && GSTIN !== vendor.GSTIN) {
            const gstinExists = await Vendor.findOne({ GSTIN });
            if (gstinExists) return res.status(400).json({ message: 'GSTIN already exists' });
        }

        vendor.vendorCode = vendorCode || vendor.vendorCode;
        vendor.vendorName = vendorName || vendor.vendorName;
        vendor.GSTIN = GSTIN || vendor.GSTIN;
        vendor.vendorLocation = vendorLocation || vendor.vendorLocation;
        vendor.vendorMailId = vendorMailId || vendor.vendorMailId;
        if (vendorCapacity !== undefined) vendor.vendorCapacity = vendorCapacity;
        vendor.remarks = remarks !== undefined ? remarks : vendor.remarks;

        const updatedVendor = await vendor.save();
        res.status(200).json(updatedVendor);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete vendor
// @route   DELETE /api/vendor/:id
// @access  Private
const deleteVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        await vendor.deleteOne();
        res.status(200).json({ id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllVendors,
    getNextVendorId,
    getVendorById,
    createVendor,
    updateVendor,
    deleteVendor,
};
