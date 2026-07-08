const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/UserModel');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tvs_secret_key_123');

            // Get user from the token
            req.user = await User.findById(decoded.id).select('-passwordHash').populate('employeeId');

            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found');
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401);
            if (error.name === 'TokenExpiredError') {
                throw new Error('TOKEN_EXPIRED');
            }
            throw new Error('Not authorized, token failed');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

// Middleware to check for specific permissions
const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401);
            throw new Error('User not authenticated');
        }

        // Admin has access to everything
        if (req.user.role === 'Admin') {
            next();
            return;
        }

        // Check if user has specific permission
        if (req.user.permissions && req.user.permissions[permission]) {
            next();
        } else {
            res.status(403);
            throw new Error(`Not authorized to access ${permission}`);
        }
    };
};

module.exports = { protect, checkPermission };