const mongoose = require('mongoose');

/**
 * Role-based permission map.
 * Exported so authController and userController can use it directly.
 */
const ROLE_PERMISSIONS = {
    'Admin': {
        dashboard: true, mhRequest: true, allRequestsOverview: true,
        mhDevelopment: true, projectPlanTracking: true,
        l1ApprovalQueue: true, designQueue: true, checkerQueue: true, finalApproval: true,
        assetManagement: true, assetSummary: true, designLibrary: true,
        employeeMaster: true, vendorMaster: true, vendorScoring: true, vendorLoading: true,
        settings: true
    },
    'Requester': {
        dashboard: true, mhRequest: true, allRequestsOverview: true,
        mhDevelopment: false, projectPlanTracking: false,
        l1ApprovalQueue: false, designQueue: false, checkerQueue: false, finalApproval: false,
        assetManagement: false, assetSummary: false, designLibrary: false,
        employeeMaster: false, vendorMaster: false, vendorScoring: false, vendorLoading: false,
        settings: false
    },
    'L1 Approver': {
        dashboard: true, mhRequest: true, allRequestsOverview: true,
        mhDevelopment: true, projectPlanTracking: true,
        l1ApprovalQueue: true, designQueue: false, checkerQueue: false, finalApproval: false,
        assetManagement: false, assetSummary: false, designLibrary: false,
        employeeMaster: false, vendorMaster: false, vendorScoring: false, vendorLoading: false,
        settings: false
    },
    'PED Engineer': {
        dashboard: true, mhRequest: false, allRequestsOverview: true,
        mhDevelopment: true, projectPlanTracking: true,
        l1ApprovalQueue: false, designQueue: false, checkerQueue: false, finalApproval: false,
        assetManagement: true, assetSummary: true, designLibrary: true,
        employeeMaster: false, vendorMaster: false, vendorScoring: false, vendorLoading: false,
        settings: false
    },
    'Designer': {
        dashboard: true, mhRequest: false, allRequestsOverview: true,
        mhDevelopment: true, projectPlanTracking: true,
        l1ApprovalQueue: false, designQueue: true, checkerQueue: false, finalApproval: false,
        assetManagement: false, assetSummary: false, designLibrary: true,
        employeeMaster: false, vendorMaster: false, vendorScoring: false, vendorLoading: false,
        settings: false
    },
    'Checker': {
        dashboard: true, mhRequest: false, allRequestsOverview: true,
        mhDevelopment: true, projectPlanTracking: true,
        l1ApprovalQueue: false, designQueue: false, checkerQueue: true, finalApproval: false,
        assetManagement: false, assetSummary: false, designLibrary: true,
        employeeMaster: false, vendorMaster: false, vendorScoring: false, vendorLoading: false,
        settings: false
    },
    'Final Approver': {
        dashboard: true, mhRequest: false, allRequestsOverview: true,
        mhDevelopment: true, projectPlanTracking: true,
        l1ApprovalQueue: false, designQueue: false, checkerQueue: false, finalApproval: true,
        assetManagement: false, assetSummary: false, designLibrary: true,
        employeeMaster: false, vendorMaster: false, vendorScoring: false, vendorLoading: false,
        settings: false
    }
};

const userSchema = mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'Requester'
    },
    permissions: {
        dashboard:            { type: Boolean, default: true },
        mhRequest:            { type: Boolean, default: true },
        allRequestsOverview:  { type: Boolean, default: false },
        mhDevelopment:        { type: Boolean, default: false },
        projectPlanTracking:  { type: Boolean, default: false },
        l1ApprovalQueue:      { type: Boolean, default: false },
        designQueue:          { type: Boolean, default: false },
        checkerQueue:         { type: Boolean, default: false },
        finalApproval:        { type: Boolean, default: false },
        assetManagement:      { type: Boolean, default: false },
        assetSummary:         { type: Boolean, default: false },
        designLibrary:        { type: Boolean, default: false },
        employeeMaster:       { type: Boolean, default: false },
        vendorMaster:         { type: Boolean, default: false },
        vendorScoring:        { type: Boolean, default: false },
        vendorLoading:        { type: Boolean, default: false },
        settings:             { type: Boolean, default: false }
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    lastLoginAt: {
        type: Date
    },
    previousLoginAt: {
        type: Date
    },
    refreshToken: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

/**
 * Pre-save hook: auto-set permissions whenever role is new or changed.
 * Fires on User.create() and user.save().
 * Uses async style (Mongoose 9 recommended — no next() callback needed).
 */
userSchema.pre('save', async function () {
    if (this.isNew || (this.isModified('role') && !this.isModified('permissions'))) {
        const perms = ROLE_PERMISSIONS[this.role];
        if (perms) {
            Object.keys(perms).forEach(function(key) {
                this.permissions[key] = perms[key];
            }.bind(this));
        }
    }
});

/**
 * Pre-update hook: auto-set permissions when role is changed via
 * findByIdAndUpdate / findOneAndUpdate / updateOne.
 */
userSchema.pre(['findOneAndUpdate', 'updateOne'], async function () {
    var update = this.getUpdate();
    var newRole = (update && update.$set && update.$set.role) || (update && update.role);
    if (newRole) {
        var perms = ROLE_PERMISSIONS[newRole];
        if (perms) {
            if (!update.$set) update.$set = {};
            Object.keys(perms).forEach(function(key) {
                update.$set['permissions.' + key] = perms[key];
            });
        }
    }
});

const User = mongoose.model('User', userSchema);

// Attach ROLE_PERMISSIONS so other modules can import it
User.ROLE_PERMISSIONS = ROLE_PERMISSIONS;

module.exports = User;
