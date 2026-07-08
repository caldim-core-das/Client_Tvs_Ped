require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/UserModel');
const Employee = require('./models/EmployeeModel');

const run = async () => {
    try {
        await mongoose.connect(process.env.ATLAS_URI, { dbName: 'tvs-ped' });
        const users = await User.find({});
        console.log('Users:', users.map(u => u.email));
        
        if (users.length > 0) {
            const user = await User.findOne({ email: users[0].email }).populate('employeeId', 'employeeName departmentName plantLocation mailId employeeId');
            console.log('Trying to save user:', user.email);
            const now = new Date();
            user.lastLoginAt = now;
            await user.save();
            console.log('Save 1 success');
            user.refreshToken = 'fake_token';
            await user.save();
            console.log('Save 2 success');
        }

    } catch (e) {
        console.error('Error occurred:', e);
    } finally {
        mongoose.disconnect();
    }
};

run();
