require('dotenv').config();
require('./config/db')().then(async () => {
    const WorkflowDefinition = require('./models/WorkflowDefinition');
    
    // Find all versions of MH_REQUEST workflow and update the node
    const defs = await WorkflowDefinition.find({ processKey: 'MH_REQUEST' });
    
    for (let def of defs) {
        const nodeIndex = def.nodes.findIndex(n => n.id === 'human-design-submit');
        if (nodeIndex !== -1) {
            def.nodes[nodeIndex].config.allowedRoles = ['Designer', 'Admin'];
            def.markModified('nodes');
            await def.save();
            console.log(`Updated node human-design-submit in workflow v${def.version} (isDraft: ${def.isDraft})`);
        }
    }
    
    console.log('Finished updating workflow definitions.');
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
