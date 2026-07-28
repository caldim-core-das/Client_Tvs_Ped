require('dotenv').config();
require('./config/db')().then(async () => {
    const User = require('./models/UserModel');
    const users = await User.find({ role: 'Final Approver' });
    for (let u of users) {
        let perms = u.permissions || {};
        perms.finalApproval = true;
        perms.finalApprovalQueue = true;
        await User.updateOne({ _id: u._id }, { $set: { permissions: perms } });
    }
    console.log('Fixed permissions for', users.length, 'users');
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
