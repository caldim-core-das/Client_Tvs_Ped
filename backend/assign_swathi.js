require('dotenv').config();
require('./config/db')().then(async () => {
    const { submitAction } = require('./services/workflowEngine');
    const MHRequest = require('./models/MHRequest');
    const req = await MHRequest.findOne({ mhRequestId: 'TVS/HSR/IT017' }).lean();
    if (req) {
        // Approve it and assign to Swathi
        const linkActor = { _id: null, employeeId: null, email: 'system-fix', role: 'L1 Approver' };
        await submitAction(req._id, {
            decision: 'Approved',
            actor: linkActor,
            payload: { assignEngineerId: '6a5f17a8be04df023235ddf9', comment: 'Assigned to Swathi programmatically.' },
            files: []
        });
        console.log('Successfully approved and assigned to Swathi.');
    } else {
        console.log('Request not found');
    }
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
