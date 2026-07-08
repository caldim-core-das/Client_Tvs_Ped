require('dotenv').config();
const mongoose = require('mongoose');
const { loginUser } = require('./controllers/authController');

const mockReq = {
    body: {
        email: 'admin@tvs.com',
        password: 'admin' // The seeded password was admin123, let's use that if admin fails.
    },
    headers: {
        'user-agent': 'test-agent'
    }
};

const mockRes = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        console.log('RESPONSE JSON:', data);
        return this;
    },
    cookie: function (name, value, options) {
        console.log(`SET COOKIE: ${name}=${value}`);
        return this;
    }
};

const run = async () => {
    try {
        await mongoose.connect(process.env.ATLAS_URI, { dbName: 'tvs-ped' });
        
        mockReq.body.password = 'admin123';
        
        await loginUser(mockReq, mockRes, (err) => {
            if (err) {
                console.error('NEXT CALLED WITH ERROR:', err);
            } else {
                console.log('NEXT CALLED SUCCESSFULLY');
            }
        });
        
    } catch (e) {
        console.error('UNHANDLED EXCEPTION:', e);
    } finally {
        setTimeout(() => mongoose.disconnect(), 2000);
    }
};

run();
