const Employee = require('../models/EmployeeModel');
const User = require('../models/UserModel');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const ExcelJS = require('exceljs');

// @desc    Get all employees with pagination
// @route   GET /api/employees
// @access  Private/Admin/Manager
const getAllEmployees = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filtering options
    const filter = {};
    if (req.query.department) filter.departmentName = req.query.department;
    if (req.query.location) filter.plantLocation = req.query.location;
    if (req.query.accessLevel) filter.accessLevel = req.query.accessLevel;
    if (req.query.status) filter.status = req.query.status;

    // Search functionality
    if (req.query.search) {
        filter.$or = [
            { employeeName: { $regex: req.query.search, $options: 'i' } },
            { employeeId: { $regex: req.query.search, $options: 'i' } },
            { mailId: { $regex: req.query.search, $options: 'i' } },
            { departmentName: { $regex: req.query.search, $options: 'i' } }
        ];
    }

    const employees = await Employee.find(filter)
        .sort({ sNo: 1 })
        .skip(skip)
        .limit(limit)
        .select('-__v');

    const total = await Employee.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
        success: true,
        count: employees.length,
        total,
        totalPages,
        currentPage: page,
        data: employees
    });
});

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private/Admin/Manager
const getEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    res.json({
        success: true,
        data: employee
    });
});

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private/Admin/SuperAdmin
// @desc    Create new employee
// @route   POST /api/employees
// @access  Private/Admin/SuperAdmin
const createEmployee = asyncHandler(async (req, res) => {
    console.log("REQ BODY:", req.body);

    const actorId = req.user?.id || null;

    let {
        employeeId,
        employeeName,
        departmentName,
        plantLocation,
        accessLevel,
        role,
        mailId,
        status,
        permissions,
        password
    } = req.body;

    // Check for duplicates immediately
    if (!employeeId || employeeId.trim() === '') {
        res.status(400);
        throw new Error('Employee ID is required');
    }

    // Check if employee already exists
    const existingEmployee = await Employee.findOne({
        $or: [{ employeeId }, { mailId }]
    });

    if (existingEmployee) {
        res.status(400);
        throw new Error('Employee ID or Email already exists');
    }

    // Determine the role for the Employee record
    const validRoles = ['Admin', 'Requester', 'L1 Approver', 'PED Engineer', 'Designer', 'Checker', 'Final Approver'];
    const employeeRole = (role && validRoles.includes(role)) ? role : 'Requester';

    const employee = await Employee.create({
        employeeId,
        employeeName,
        departmentName,
        plantLocation,
        accessLevel,
        role: employeeRole,
        mailId,
        status,
        permissions,
        createdBy: actorId,
        updatedBy: actorId
    });


    // Create corresponding User record so employee can login
    try {
        const passwordPlain = password || `Emp@${employeeId}123`;
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(passwordPlain, salt);

        // Determine user role: explicit role field takes precedence, then accessLevel mapping
        let userRole = employeeRole;
        if (!validRoles.includes(userRole)) {
            userRole = (accessLevel === 'Admin' || accessLevel === 'Super Admin') ? 'Admin' : 'Requester';
        }

        const userPayload = {
            userId: `USR${Date.now()}`,
            employeeId: employee._id,
            email: mailId,
            passwordHash: hashed,
            role: userRole,
            permissions: permissions || {},
            status: 'Active'
        };

        // If a user already exists for this email or employee, update instead
        let user = await User.findOne({ $or: [{ email: mailId }, { employeeId: employee._id }] });
        if (user) {
            user = await User.findByIdAndUpdate(user._id, userPayload, { new: true });
        } else {
            user = await User.create(userPayload);
        }
    } catch (err) {
        // Log but don't fail employee creation
        console.error('Error creating user for employee:', err.message);
    }

    res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: employee
    });
});

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private/Admin/SuperAdmin
const updateEmployee = asyncHandler(async (req, res) => {
    let employee = await Employee.findById(req.params.id);

    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    // Check if new email or ID already exists (excluding current employee)
    if (req.body.mailId && req.body.mailId !== employee.mailId) {
        const emailExists = await Employee.findOne({
            mailId: req.body.mailId,
            _id: { $ne: req.params.id }
        });
        if (emailExists) {
            res.status(400);
            throw new Error('Email already exists');
        }
    }

    if (req.body.employeeId && req.body.employeeId !== employee.employeeId) {
        const idExists = await Employee.findOne({
            employeeId: req.body.employeeId,
            _id: { $ne: req.params.id }
        });
        if (idExists) {
            res.status(400);
            throw new Error('Employee ID already exists');
        }
    }

    const actorId = req.user?.id || null;
    employee = await Employee.findByIdAndUpdate(
        req.params.id,
        {
            ...req.body,
            updatedBy: actorId,
            updatedAt: Date.now()
        },
        {
            new: true,
            runValidators: true
        }
    );

    // Update or create associated User record if permissions, mailId or password provided
    try {
        const { permissions, mailId, password, accessLevel, role: updatedRole } = req.body;
        let user = await User.findOne({ employeeId: employee._id });

        // Resolve the new user role
        const validRoles = ['Admin', 'Requester', 'L1 Approver', 'PED Engineer', 'Designer', 'Checker', 'Final Approver'];
        let resolvedUserRole = null;
        if (updatedRole && validRoles.includes(updatedRole)) {
            resolvedUserRole = updatedRole;
        } else if (accessLevel) {
            resolvedUserRole = (accessLevel === 'Admin' || accessLevel === 'Super Admin') ? 'Admin' : 'Requester';
        }

        if (user) {
            const update = {};
            if (permissions) update.permissions = permissions;
            if (mailId) update.email = mailId;
            if (resolvedUserRole) update.role = resolvedUserRole;
            if (password && !/^\*+$/.test(password)) {
                const salt = await bcrypt.genSalt(10);
                update.passwordHash = await bcrypt.hash(password, salt);
            }
            if (Object.keys(update).length > 0) {
                const userDoc = await User.findById(user._id);
                if (userDoc) {
                    if (update.email) userDoc.email = update.email;
                    if (update.role) userDoc.role = update.role;
                    if (update.passwordHash) userDoc.passwordHash = update.passwordHash;
                    if (update.permissions) {
                        Object.keys(update.permissions).forEach(key => {
                            userDoc.permissions[key] = update.permissions[key];
                        });
                        userDoc.markModified('permissions');
                    }
                    await userDoc.save();
                }
            }
        } else if (mailId) {
            // create user if not exists but email provided
            const pwd = password || `Emp@${employee.employeeId}123`;
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(pwd, salt);
            await User.create({
                userId: `USR${Date.now()}`,
                employeeId: employee._id,
                email: mailId,
                passwordHash: hashed,
                role: resolvedUserRole || 'Requester',
                permissions: permissions || {},
                status: 'Active'
            });
        }
    } catch (err) {
        console.error('Error syncing user for employee update:', err.message);
    }

    res.json({
        success: true,
        message: 'Employee updated successfully',
        data: employee
    });
});

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private/SuperAdmin
const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    // Check if employee is active
    if (employee.status === 'Active') {
        res.status(400);
        throw new Error('Cannot delete active employee. Set to inactive first.');
    }

    await employee.deleteOne();

    res.json({
        success: true,
        message: 'Employee deleted successfully',
        data: {}
    });
});

// @desc    Bulk upload employees from Excel
// @route   POST /api/employees/bulk-upload
// @access  Private/Admin/SuperAdmin
const bulkUpload = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('Please upload an Excel file');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.getWorksheet(1);

    const employees = [];
    const errors = [];
    let successCount = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const employeeData = {
            employeeId: row.getCell(1).value,
            employeeName: row.getCell(2).value,
            departmentName: row.getCell(3).value,
            plantLocation: row.getCell(4).value,
            accessLevel: row.getCell(5).value,
            mailId: row.getCell(6).value,
            status: row.getCell(7).value || 'Active'
        };

        // Validate required fields
        if (!employeeData.employeeId || !employeeData.employeeName || !employeeData.mailId) {
            errors.push(`Row ${rowNumber}: Missing required fields`);
            return;
        }

        employees.push(employeeData);
    });

    // Process employees
    for (const empData of employees) {
        try {
            // Check for duplicates
            const exists = await Employee.findOne({
                $or: [
                    { employeeId: empData.employeeId },
                    { mailId: empData.mailId }
                ]
            });

            if (!exists) {
                await Employee.create({
                    ...empData,
                    createdBy: req.user.id,
                    updatedBy: req.user.id
                });
                successCount++;
            } else {
                errors.push(`Duplicate: ${empData.employeeId} or ${empData.mailId}`);
            }
        } catch (error) {
            errors.push(`Error processing ${empData.employeeId}: ${error.message}`);
        }
    }

    res.json({
        success: true,
        message: 'Bulk upload completed',
        summary: {
            totalProcessed: employees.length,
            successCount,
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : undefined
        }
    });
});

// @desc    Export employees to Excel
// @route   POST /api/employees/export
// @access  Private/Admin/Manager
const exportEmployees = asyncHandler(async (req, res) => {
    const employees = await Employee.find({}).sort({ sNo: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');

    // Add headers (matching your table structure)
    worksheet.columns = [
        { header: 'Employee ID', key: 'employeeId', width: 15 },
        { header: 'Employee Name', key: 'employeeName', width: 25 },
        { header: 'Department Name', key: 'departmentName', width: 20 },
        { header: 'Plant Location', key: 'plantLocation', width: 15 },
        { header: 'Access level', key: 'accessLevel', width: 15 },
        { header: 'Mail ID', key: 'mailId', width: 25 },
        { header: 'Status', key: 'status', width: 10 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    employees.forEach(employee => {
        worksheet.addRow({
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            departmentName: employee.departmentName,
            plantLocation: employee.plantLocation,
            accessLevel: employee.accessLevel,
            mailId: employee.mailId,
            status: employee.status
        });
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
        column.width = column.header.length < 10 ? 10 : column.header.length + 5;
    });

    // Set response headers
    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
        'Content-Disposition',
        'attachment; filename=employees.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
});

// @desc    Filter employees by department
// @route   GET /api/employees/filter/by-department/:department
// @access  Private/Admin/Manager
const getEmployeesByDepartment = asyncHandler(async (req, res) => {
    const employees = await Employee.find({
        departmentName: req.params.department
    }).sort({ employeeName: 1 });

    res.json({
        success: true,
        count: employees.length,
        data: employees
    });
});

// @desc    Filter employees by location
// @route   GET /api/employees/filter/by-location/:location
// @access  Private/Admin/Manager
const getEmployeesByLocation = asyncHandler(async (req, res) => {
    const employees = await Employee.find({
        plantLocation: req.params.location
    }).sort({ employeeName: 1 });

    res.json({
        success: true,
        count: employees.length,
        data: employees
    });
});

// @desc    Filter employees by access level
// @route   GET /api/employees/filter/by-access/:accessLevel
// @access  Private/Admin/Manager
const getEmployeesByAccessLevel = asyncHandler(async (req, res) => {
    const employees = await Employee.find({
        accessLevel: req.params.accessLevel
    }).sort({ employeeName: 1 });

    res.json({
        success: true,
        count: employees.length,
        data: employees
    });
});

// @desc    Search employees
// @route   GET /api/employees/search/:keyword
// @access  Private/Admin/Manager
const searchEmployees = asyncHandler(async (req, res) => {
    const keyword = req.params.keyword;

    const employees = await Employee.find({
        $or: [
            { employeeName: { $regex: keyword, $options: 'i' } },
            { employeeId: { $regex: keyword, $options: 'i' } },
            { mailId: { $regex: keyword, $options: 'i' } },
            { departmentName: { $regex: keyword, $options: 'i' } },
            { plantLocation: { $regex: keyword, $options: 'i' } }
        ]
    }).sort({ employeeName: 1 }).limit(50);

    res.json({
        success: true,
        count: employees.length,
        data: employees
    });
});

// @desc    Get next employee ID
// @route   GET /api/employees/next-id
// @access  Private/Admin/Manager
const getNextEmployeeId = asyncHandler(async (req, res) => {
    const latestEmployee = await Employee.findOne().sort({ createdAt: -1 });

    let nextId = 'EMP001';
    if (latestEmployee && latestEmployee.employeeId) {
        const currentId = latestEmployee.employeeId;
        const numericPart = parseInt(currentId.replace('EMP', ''), 10);
        if (!isNaN(numericPart)) {
            nextId = `EMP${String(numericPart + 1).padStart(3, '0')}`;
        }
    }

    res.json({
        success: true,
        nextEmployeeId: nextId
    });
});



// @desc    Check if employee ID exists
// @route   POST /api/employees/check-id
// @access  Private
const checkEmployeeId = asyncHandler(async (req, res) => {
    const { employeeId } = req.body;
    if (!employeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    const employee = await Employee.findOne({ employeeId: { $regex: new RegExp(`^${employeeId}$`, 'i') } });
    res.json({
        success: true,
        exists: !!employee
    });
});

// @desc    Get all PED Engineers
// @route   GET /api/employees/ped-engineers
// @access  Private
const getPedEngineers = asyncHandler(async (req, res) => {
    const engineers = await Employee.find({ role: 'PED Engineer', status: 'Active' })
        .select('employeeId employeeName mailId departmentName plantLocation role')
        .sort({ employeeName: 1 });

    res.json({ success: true, count: engineers.length, data: engineers });
});

// @desc    Get all Approvers
// @route   GET /api/employees/approvers
// @access  Private
const getApprovers = asyncHandler(async (req, res) => {
    const filter = { role: 'L1 Approver', status: 'Active' };
    if (req.query.department) {
        filter.departmentName = req.query.department;
    }

    const approvers = await Employee.find(filter)
        .select('employeeId employeeName mailId departmentName plantLocation role')
        .sort({ employeeName: 1 });

    res.json({ success: true, count: approvers.length, data: approvers });
});

module.exports = {
    getAllEmployees,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    bulkUpload,
    exportEmployees,
    getEmployeesByDepartment,
    getEmployeesByLocation,
    getEmployeesByAccessLevel,
    searchEmployees,
    getNextEmployeeId,
    checkEmployeeId,
    getPedEngineers,
    getApprovers
};
