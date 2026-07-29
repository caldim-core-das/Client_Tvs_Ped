// Normalizes plant/location strings for comparison — strips parenthetical
// codes ("Mysore (KA)" -> "mysore"), collapses whitespace, lowercases —
// so MHRequest.plantLocation (fixed enum) and Employee.plantLocation
// (free-text Employee Master field) can be compared meaningfully.
function normalizeLocation(str) {
    return (str || '')
        .replace(/\(.*?\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function sameLocation(a, b) {
    const na = normalizeLocation(a);
    const nb = normalizeLocation(b);
    return !!na && !!nb && na === nb;
}

module.exports = { normalizeLocation, sameLocation };
