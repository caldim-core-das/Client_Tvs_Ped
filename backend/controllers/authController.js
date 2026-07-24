const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/UserModel');
const Employee = require('../models/EmployeeModel');
const UserActivity = require('../models/UserActivity');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Generate JWT (Access Token - 15 minutes)
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'tvs_secret_key_123', {
        expiresIn: '15m',
    });
};

// Generate Refresh Token (7 days)
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || 'tvs_refresh_secret_key_123', {
        expiresIn: '7d',
    });
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email }).populate('employeeId', 'employeeName departmentName plantLocation mailId employeeId');

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
        // Track Login Activity
        const now = new Date();
        const previousLoginAt = user.lastLoginAt ? user.lastLoginAt : user.previousLoginAt;

        const closePreviousSessionsPromise = UserActivity.find({
            userId: user._id,
            logoutAt: null
        }).then(async (previousSessions) => {
            await Promise.all(
                previousSessions.map(async (session) => {
                    session.logoutAt = now;
                    const duration = (now - session.loginAt) / 1000;
                    session.sessionDuration = Math.round(duration);
                    await session.save();
                })
            );
        }).catch((err) => {
            console.error('Error closing previous user sessions', err);
        });

        let userActivityId = null;
        try {
            const userActivity = await UserActivity.create({
                userId: user._id,
                loginAt: now,
                userAgent: req.headers['user-agent']
            });
            userActivityId = userActivity._id;
        } catch (err) {
            console.error('UserActivity creation failed', err);
        }

        const accessToken = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        
        await User.findByIdAndUpdate(user._id, {
            lastLoginAt: now,
            previousLoginAt: previousLoginAt,
            refreshToken: refreshToken
        });

        res.cookie('jwt_refresh', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            _id: user.userId,
            dbId: user._id,
            email: user.email,
            role: user.role,
            permissions: user.permissions,
            employeeId: user.employeeId ? user.employeeId.employeeId : null,
            name: user.employeeId ? user.employeeId.employeeName : (user.email ? user.email.split('@')[0] : 'Admin User'),
            department: user.employeeId ? user.employeeId.departmentName : 'System',
            location: user.employeeId ? user.employeeId.plantLocation : '',
            token: accessToken,
            sessionId: userActivityId,
            lastLoginAt: now,
            previousLoginAt: previousLoginAt
        });

        closePreviousSessionsPromise.catch(() => { });
    } else {
        res.status(401);
        throw new Error('Invalid credentials');
    }
});

// @desc    Logout user & record session end
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
    const { sessionId } = req.body;

    if (sessionId) {
        const activity = await UserActivity.findById(sessionId);
        if (activity) {
            activity.logoutAt = new Date();
            // Calculate duration in seconds
            const duration = (activity.logoutAt - activity.loginAt) / 1000;
            activity.sessionDuration = Math.round(duration);
            await activity.save();
        }
    }

    res.cookie('jwt_refresh', '', {
        httpOnly: true,
        expires: new Date(0)
    });

    res.status(200).json({ message: 'Logged out successfully' });
});

// @desc    Register a new user (Seed/Internal use)
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const {
        userId,
        employeeId,
        email,
        password,
        role,
        permissions
    } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Check if employee exists
    const employee = await Employee.findOne({ employeeId: employeeId });
    if (!employee) {
        res.status(400);
        throw new Error(`Employee with ID ${employeeId} not found`);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const assignedRole = role || 'Requester';

    // Create user — pre-save hook auto-sets permissions from role
    const user = await User.create({
        userId,
        employeeId: employee._id,
        email,
        passwordHash: hashedPassword,
        role: assignedRole,
        // Only use explicit permissions if provided AND role is Admin (custom overrides)
        ...(permissions && assignedRole === 'Admin' ? { permissions } : {}),
        status: 'Active'
    });

    // Sync the employee's role field to match
    const validRoles = ['Admin', 'Requester', 'L1 Approver', 'PED Engineer', 'Designer', 'Checker', 'Final Approver'];
    if (validRoles.includes(assignedRole)) {
        await Employee.findByIdAndUpdate(employee._id, { role: assignedRole });
    }

    if (user) {
        res.status(201).json({
            _id: user.id,
            userId: user.userId,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Get current user data
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).populate('employeeId', 'employeeName departmentName plantLocation mailId employeeId');

    if (user) {
        res.json({
            _id: user.userId,
            dbId: user._id,
            email: user.email,
            role: user.role,
            permissions: user.permissions,
            employeeId: user.employeeId ? user.employeeId.employeeId : null,
            name: user.employeeId ? user.employeeId.employeeName : (user.email ? user.email.split('@')[0] : 'Admin User'),
            department: user.employeeId ? user.employeeId.departmentName : 'System',
            location: user.employeeId ? user.employeeId.plantLocation : '',
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});



// @desc    Seed database (Auto-fix for empty DB)
// @route   GET /api/auth/seed
// @access  Public
const seedDatabase = asyncHandler(async (req, res) => {
    const userCount = await User.countDocuments();
    if (userCount > 0 && !req.query.force) {
        return res.json({ message: 'Database already initialized. Use ?force=true to reset.' });
    }

    if (req.query.force) {
        await User.deleteMany();
        await Employee.deleteMany();
    }

    // 1. Create Admin Employee
    const adminEmployee = await Employee.create({
        employeeId: 'EMP001',
        employeeName: 'System Admin',
        departmentName: 'IT',
        plantLocation: 'Madurai',
        mailId: 'admin@tvs.com',
        designation: 'Administrator',
        dateOfJoining: new Date(),
        accessLevel: 'Admin',
        permissions: {
            dashboard: true,
            mhRequest: true,
            allRequestsOverview: true,
            mhDevelopment: true,
            projectPlanTracking: true,
            l1ApprovalQueue: true,
            designQueue: true,
            checkerQueue: true,
            finalApproval: true,
            assetManagement: true,
            assetSummary: true,
            designLibrary: true,
            employeeMaster: true,
            vendorMaster: true,
            vendorScoring: true,
            vendorLoading: true,
            settings: true
        },
        status: 'Active'
    });

    // 2. Create Admin User
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    await User.create({
        userId: 'ADM001',
        employeeId: adminEmployee._id,
        email: 'admin@tvs.com',
        passwordHash: hashedPassword,
        role: 'Admin',
        permissions: {
            dashboard: true,
            mhRequest: true,
            allRequestsOverview: true,
            mhDevelopment: true,
            projectPlanTracking: true,
            l1ApprovalQueue: true,
            designQueue: true,
            checkerQueue: true,
            finalApproval: true,
            assetManagement: true,
            assetSummary: true,
            designLibrary: true,
            employeeMaster: true,
            vendorMaster: true,
            vendorScoring: true,
            vendorLoading: true,
            settings: true
        },
        status: 'Active'
    });

    res.status(201).json({ message: 'Database seeded successfully. You can now login with admin@tvs.com / admin123' });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshAccessToken = asyncHandler(async (req, res) => {
    const token = req.cookies.jwt_refresh;
    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no refresh token');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'tvs_refresh_secret_key_123');
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== token) {
            res.status(401);
            throw new Error('Not authorized, invalid refresh token');
        }

        const accessToken = generateToken(user._id);
        res.json({ token: accessToken });
    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, refresh token failed');
    }
});

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('There is no user with that email');
    }

    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expire (15 mins)
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    
    // Save to DB
    await user.save();

    // Create reset url (pointing to frontend)
    const origin = req.headers.origin || `http://localhost:5173`;
    const resetUrl = `${origin}/reset-password/${resetToken}`;

    // Send email
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: isSecure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: { rejectUnauthorized: false }
    });

    const message = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2 style="color: #d32f2f;">Password Reset Request</h2>
            <p>You are receiving this email because you (or someone else) has requested the reset of a password.</p>
            <p>Please click the button below to reset your password. This link is valid for 15 minutes.</p>
            <div style="margin: 20px 0;">
                <a href="${resetUrl}" style="background-color: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
            <p>Best regards,<br/>TVS Admin Team</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: user.email,
            subject: 'TVS Portal - Password Reset',
            html: message
        });
        res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
        console.error('Email send error:', err);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(500);
        throw new Error('Email could not be sent');
    }
});

// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
    // Get hashed token
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid token or token has expired');
    }

    // Check if password exists
    if(!req.body.password) {
        res.status(400);
        throw new Error('Please add a password');
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(req.body.password, salt);
    
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password reset successful'
    });
});

module.exports = {
    loginUser,
    registerUser,
    getMe,
    logoutUser,
    seedDatabase,
    refreshAccessToken,
    forgotPassword,
    resetPassword
};
