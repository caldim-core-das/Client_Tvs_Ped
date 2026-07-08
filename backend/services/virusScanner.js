/**
 * virusScanner.js
 * 
 * Service that integrates with local ClamAV daemon to scan files for viruses.
 * Includes a fallback to mock scanning if ClamAV is not installed (e.g., local dev).
 */

const NodeClam = require('clamscan');

let clamscan = null;
let isMockScanner = false;

// Initialize ClamAV
async function initClamAV() {
    try {
        clamscan = await new NodeClam().init({
            removeInfected: false, // We'll handle removal in the middleware
            quarantineInfected: false,
            scanLog: null,
            debugMode: false,
            fileList: null,
            scanRecursively: true,
            clamdscan: {
                socket: false,
                host: '127.0.0.1',
                port: 3310,
                timeout: 60000,
                localFallback: true, // Use local clamscan binary if daemon isn't found
                path: '/usr/bin/clamdscan', // Path to clamdscan
                configFile: null,
                multiscan: true,
                reloadDb: false,
                active: true,
                bypassTest: false,
            },
            preference: 'clamdscan' // If clamdscan is found and active, it will be used by default
        });
        console.log('[VirusScanner] ClamAV successfully initialized.');
    } catch (err) {
        console.warn(`[VirusScanner] Failed to initialize ClamAV. Falling back to MOCK scanner. Error: ${err.message}`);
        isMockScanner = true;
    }
}

// Start initialization immediately
initClamAV();

/**
 * Scans a file path for viruses.
 * @param {string} filePath - Absolute path to the file to scan
 * @returns {Promise<{isClean: boolean, viruses: string[]}>}
 */
async function scanFile(filePath) {
    if (isMockScanner || !clamscan) {
        console.log(`[VirusScanner] Mock scan for: ${filePath}`);
        // Simulate EICAR detection if the file contains the EICAR string
        const fs = require('fs');
        const content = fs.readFileSync(filePath, 'utf8').substring(0, 70);
        if (content.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
            console.log(`[VirusScanner] MOCK DETECTED VIRUS: EICAR test string`);
            return { isClean: false, viruses: ['EICAR-Test-Signature'] };
        }
        return { isClean: true, viruses: [] };
    }

    try {
        const { isInfected, viruses } = await clamscan.isInfected(filePath);
        return { isClean: !isInfected, viruses: viruses || [] };
    } catch (err) {
        console.error(`[VirusScanner] Scan failed for ${filePath}:`, err);
        throw new Error('Virus scan failed: ' + err.message);
    }
}

module.exports = {
    scanFile
};
