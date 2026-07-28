/**
 * sopScoringService.js
 * Checker SOP checklist scoring — extracted from the old checkDesign controller
 * so it can be invoked independently as a workflow ACTION node handler
 * (see backend/services/workflowEngine.js, actionKey: 'SOP_SCORING').
 */

const SOP_TOTAL = 10;
const SOP_THRESHOLD = 7; // configurable default — 7 out of 10 rules must pass

/**
 * @param {Array<{ruleIndex:number, answer:'yes'|'no'}>} sopAnswers
 * @param {number} [threshold]
 * @param {number} [total]
 * @returns {{answers, score, threshold, passed, complete}}
 */
function scoreSopAnswers(sopAnswers = [], threshold = SOP_THRESHOLD, total = SOP_TOTAL) {
    const validAnswers = Array.isArray(sopAnswers)
        ? sopAnswers.filter(a =>
            typeof a.ruleIndex === 'number' &&
            a.ruleIndex >= 0 && a.ruleIndex < total &&
            ['yes', 'no'].includes(a.answer)
        )
        : [];

    const score = validAnswers.filter(a => a.answer === 'yes').length;
    const passed = score >= threshold;
    const complete = validAnswers.length >= total;

    return { answers: validAnswers, score, threshold, passed, complete };
}

module.exports = { scoreSopAnswers, SOP_TOTAL, SOP_THRESHOLD };
