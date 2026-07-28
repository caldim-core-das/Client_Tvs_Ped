require('dotenv').config();
require('./config/db')().then(async () => {
    const MHRequest = require('./models/MHRequest');
    const req = await MHRequest.findOneAndUpdate(
        { mhRequestId: 'TVS/HSR/IT017' },
        { 
            $set: { 
                workflowState: 'SUBMITTED', 
                currentNodeId: 'human-l1', 
                workflowStatus: 'Pending', 
                assignedEngineer: null, 
                assignedAt: null, 
                'stageFlags.l1ApprovedAt': null 
            },
            $pop: { history: 1, stageHistory: 1 }
        },
        { new: true }
    );
    // Since there are two history entries to pop, we pop once more
    await MHRequest.findOneAndUpdate(
        { mhRequestId: 'TVS/HSR/IT017' },
        { $pop: { history: 1, stageHistory: 1 } }
    );
    console.log('Reverted record:', req.mhRequestId);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
