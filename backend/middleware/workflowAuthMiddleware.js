/**
 * workflowAuthMiddleware.js
 * Role-based authorization guards for enterprise workflow endpoints.
 * Works on top of the existing `protect` middleware (JWT validation).
 */

// ─── Valid workflow state transitions ─────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
    SUBMITTED:           ['L1_APPROVED', 'L1_REJECTED'],
    L1_APPROVED:         ['DESIGN_IN_PROGRESS'],
    L1_REJECTED:         [],                             // terminal
    DESIGN_IN_PROGRESS:  ['DESIGN_SUBMITTED', 'REVERTED'],
    DESIGN_SUBMITTED:    ['DESIGN_APPROVED', 'DESIGN_REJECTED'],
    DESIGN_APPROVED:     ['FINAL_APPROVED', 'FINAL_REJECTED'],
    DESIGN_REJECTED:     ['DESIGN_IN_PROGRESS'],         // back to designer
    FINAL_APPROVED:      ['IN_PRODUCTION'],
    FINAL_REJECTED:      ['L1_APPROVED'],                // back to L1 Approver
    IN_PRODUCTION:       ['IMPLEMENTATION'],
    IMPLEMENTATION:      ['COMPLETED'],
    COMPLETED:           [],                             // terminal
    CANCELLED:           [],                             // terminal
    REVERTED:            []                              // terminal
};

// ─── Roles allowed per transition ─────────────────────────────────────────────
const TRANSITION_ROLES = {
    L1_APPROVED:        ['L1 Approver', 'Admin'],
    L1_REJECTED:        ['L1 Approver', 'Admin'],
    DESIGN_IN_PROGRESS: ['L1 Approver', 'Admin'],           // assignment action
    DESIGN_SUBMITTED:   ['Designer', 'Admin'],
    DESIGN_APPROVED:    ['Checker', 'Admin'],
    DESIGN_REJECTED:    ['Checker', 'Admin'],
    FINAL_APPROVED:     ['Final Approver', 'Admin'],
    FINAL_REJECTED:     ['Final Approver', 'Admin'],
    IN_PRODUCTION:      ['PED Engineer', 'Admin'],
    IMPLEMENTATION:     ['PED Engineer', 'Admin'],
    COMPLETED:          ['PED Engineer', 'Admin'],
    REVERTED:           ['PED Engineer', 'Admin']
};

// ─── Stage number map ─────────────────────────────────────────────────────────
const STATE_TO_STAGE = {
    SUBMITTED:           1,
    L1_APPROVED:         2,
    L1_REJECTED:         2,
    DESIGN_IN_PROGRESS:  3,
    DESIGN_SUBMITTED:    3,
    DESIGN_APPROVED:     4,
    DESIGN_REJECTED:     4,
    FINAL_APPROVED:      5,
    FINAL_REJECTED:      5,
    IN_PRODUCTION:       6,
    IMPLEMENTATION:      7,
    COMPLETED:           7,
    CANCELLED:           0,
    REVERTED:            0
};

/**
 * Middleware: restrict endpoint to specific roles.
 * Admin bypasses all role checks.
 */
const requireWorkflowRole = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const userRole = (req.user.role || '').trim().toLowerCase();
    if (userRole === 'admin' || userRole === 'system admin' || userRole.includes('admin')) return next();
    const allowedLower = roles.map(r => r.toLowerCase());
    if (!allowedLower.includes(userRole)) {
        return res.status(403).json({
            message: `Role '${req.user.role}' is not permitted to perform this action. Required: ${roles.join(' or ')}`
        });
    }
    next();
};

/**
 * Validate that a state transition is legal.
 * Returns true if valid, false otherwise.
 */
const isValidTransition = (fromState, toState) => {
    if (!fromState || !ALLOWED_TRANSITIONS[fromState]) return false;
    return ALLOWED_TRANSITIONS[fromState].includes(toState);
};

/**
 * Get the stage number for a given state.
 */
const getStageForState = (state) => STATE_TO_STAGE[state] || null;

module.exports = {
    requireWorkflowRole,
    isValidTransition,
    getStageForState,
    ALLOWED_TRANSITIONS,
    TRANSITION_ROLES,
    STATE_TO_STAGE
};
