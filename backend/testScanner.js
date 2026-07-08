const { scanFile } = require('./services/virusScanner');
const fs = require('fs');
const path = require('path');

async function test() {
    const quarantinePath = path.join(__dirname, 'uploads/quarantine');
    if (!fs.existsSync(quarantinePath)) fs.mkdirSync(quarantinePath, { recursive: true });

    const safeFile = path.join(quarantinePath, 'safe.txt');
    const maliciousFile = path.join(quarantinePath, 'malicious.txt');

    fs.writeFileSync(safeFile, 'Hello world');
    fs.writeFileSync(maliciousFile, 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

    try {
        console.log('Testing Safe File...');
        const resSafe = await scanFile(safeFile);
        console.log(resSafe);

        console.log('Testing Malicious File...');
        const resMal = await scanFile(maliciousFile);
        console.log(resMal);
    } catch (err) {
        console.error(err);
    }
}

test();
