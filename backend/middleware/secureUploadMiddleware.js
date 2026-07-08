const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fileType = require('file-type');
const { scanFile } = require('../services/virusScanner');

const QUARANTINE_DIR = path.join(__dirname, '../uploads/quarantine');
const PERMANENT_DIR = path.join(__dirname, '../uploads/DesignDocuments');

if (!fs.existsSync(QUARANTINE_DIR)) fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
if (!fs.existsSync(PERMANENT_DIR)) fs.mkdirSync(PERMANENT_DIR, { recursive: true });

// Basic Multer config (save to quarantine first)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, QUARANTINE_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage, 
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

/**
 * Secure upload middleware wrapper.
 * Expects single file upload with fieldName.
 */
function secureUpload(fieldName) {
    return (req, res, next) => {
        const uploadMiddleware = upload.single(fieldName);

        uploadMiddleware(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ message: 'File upload error: ' + err.message });
            }
            if (!req.file) {
                return next(); // No file uploaded, proceed
            }

            const quarantinePath = req.file.path;
            
            try {
                // 1. Magic Number Validation
                const type = await fileType.fromFile(quarantinePath);
                
                // Note: CAD files (like STEP/IGES) sometimes don't have standard magic numbers recognized by file-type.
                // We do a soft validation: if file-type detects something malicious (like an exe), block it.
                if (type) {
                    if (type.mime.startsWith('application/x-msdownload') || type.mime.startsWith('application/x-executable')) {
                        throw new Error('Executable files are strictly prohibited.');
                    }
                } else {
                    // Fallback to extension check for obscure CAD formats
                    const ext = path.extname(req.file.originalname).toLowerCase();
                    const validExts = ['.pdf', '.dwg', '.dxf', '.stp', '.step', '.igs', '.iges', '.png', '.jpg', '.jpeg'];
                    if (!validExts.includes(ext)) {
                        throw new Error('Invalid or unrecognized file type.');
                    }
                }

                // 2. ClamAV Virus Scanning
                const { isClean, viruses } = await scanFile(quarantinePath);
                
                if (!isClean) {
                    throw new Error(`Malicious content detected: ${viruses.join(', ')}`);
                }

                // 3. Move to Permanent Storage
                const permanentPath = path.join(PERMANENT_DIR, req.file.filename);
                fs.renameSync(quarantinePath, permanentPath);
                
                // Update req.file so downstream controllers use the correct path
                req.file.path = permanentPath;
                req.file.destination = PERMANENT_DIR;

                next();

            } catch (validationErr) {
                // Cleanup quarantined file on failure
                if (fs.existsSync(quarantinePath)) {
                    fs.unlinkSync(quarantinePath);
                }
                return res.status(400).json({ message: `Security Validation Failed: ${validationErr.message}` });
            }
        });
    };
}

// Similar wrapper for multiple files
function secureUploadMultiple(fieldName, maxCount = 5) {
    return (req, res, next) => {
        const uploadMiddleware = upload.array(fieldName, maxCount);

        uploadMiddleware(req, res, async (err) => {
            if (err) return res.status(400).json({ message: 'File upload error: ' + err.message });
            if (!req.files || req.files.length === 0) return next();

            try {
                for (let file of req.files) {
                    const quarantinePath = file.path;
                    
                    // Magic Number Validation
                    const type = await fileType.fromFile(quarantinePath);
                    if (type) {
                        if (type.mime.startsWith('application/x-msdownload') || type.mime.startsWith('application/x-executable')) {
                            throw new Error('Executable files are strictly prohibited.');
                        }
                    }

                    // Virus Scan
                    const { isClean, viruses } = await scanFile(quarantinePath);
                    if (!isClean) throw new Error(`Malicious content detected: ${viruses.join(', ')}`);

                    // Move to Permanent Storage
                    const permanentPath = path.join(PERMANENT_DIR, file.filename);
                    fs.renameSync(quarantinePath, permanentPath);
                    file.path = permanentPath;
                    file.destination = PERMANENT_DIR;
                }
                next();
            } catch (validationErr) {
                // Cleanup all quarantined files
                for (let file of req.files) {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                }
                return res.status(400).json({ message: `Security Validation Failed: ${validationErr.message}` });
            }
        });
    };
}

module.exports = {
    secureUpload,
    secureUploadMultiple
};
