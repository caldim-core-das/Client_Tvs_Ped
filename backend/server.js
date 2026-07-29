require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 5000;
const employeeRoutes = require('./routes/employeeRoutes');
const { initializeScheduler } = require('./jobs/reportScheduler');

// Connect Database
const dbPromise = connectDB();

// Initialize Report Scheduler
dbPromise.then(() => {
    initializeScheduler();
    const { initializeAlertScheduler } = require('./jobs/alertCron');
    initializeAlertScheduler();
    const { initializeWorkflowEscalationCron } = require('./jobs/workflowEscalationCron');
    initializeWorkflowEscalationCron();
    const { initializeWorkflowNotificationCron } = require('./jobs/workflowNotificationCron');
    initializeWorkflowNotificationCron();
    const { initializeFileCleanupCron } = require('./jobs/fileCleanupCron');
    initializeFileCleanupCron();
}).catch(err => console.error('Database connection failed:', err));

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like server-to-server, curl, or same-origin proxying)
        if (!origin) return callback(null, true);

        // Allow localhost, local network, and production domains
        if (
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            origin.includes('caldimproducts.com') ||
            (process.env.FRONTEND_URL && origin.startsWith(process.env.FRONTEND_URL))
        ) {
            return callback(null, true);
        }

        // Default allow for configured origins
        return callback(null, true);
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/vendor-scoring', require('./routes/vendorScoringRoutes'));
app.use('/api/vendor-loading', require('./routes/vendorLoadingRoutes'));
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/email', require('./routes/emailRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/asset-request', require('./routes/assetRequestRoutes'));
app.use('/api/asset-management', require('./routes/assetManagementRoutes'));
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/user-activity', require('./routes/userActivityRoutes'));
app.use('/api/report-settings', require('./routes/reportSettingsRoutes'));
app.use('/api/mh-development-tracker', require('./routes/mhDevelopmentTrackerRoutes'));
app.use('/api/project-plan', require('./routes/projectPlanRoutes'));
app.use('/api/kpi-settings', require('./routes/kpiSettingsRoutes'));

// Enterprise Workflow v2 routes
app.use('/api/workflow',             require('./routes/workflowRoutes'));
app.use('/api/workflow-definitions', require('./routes/workflowDefinitionRoutes'));
app.use('/api/design-library',       require('./routes/designLibraryRoutes'));


// Public routes (no auth required — for landing page)
app.use('/api/public', require('./routes/publicRoutes'));


// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error Middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

// Export app for Vercel
module.exports = app;

// Only listen if not running in Vercel (or similar environment where module.exports is used)
if (require.main === module) {
  dbPromise.then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  });
}