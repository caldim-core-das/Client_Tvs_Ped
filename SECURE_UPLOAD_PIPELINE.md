# Secure File Upload Pipeline Implementation

The file uploads (especially design documents like CAD files and PDFs) currently bypass security checks, posing a significant risk for a corporate intranet application. We have implemented a robust **5-Stage Security Pipeline** for all file uploads.

## How the Pipeline Works

To ensure maximum security, every uploaded file will pass through the following stages:

1. **Multer Limits & Basic Checks**: Restrict the maximum file size (e.g., 15MB for design documents) and reject obviously invalid extensions.
2. **Temporary Quarantine**: Files are initially saved to a secure `/quarantine` folder, preventing them from being served or executed while they are being inspected.
3. **Magic Number Validation (Mandatory)**: We use the `file-type` library to read the first few bytes (the "magic number") of the file. This ensures the file is truly a PDF/Image/CAD file and not a renamed executable (e.g., `malware.exe` renamed to `drawing.pdf`).
4. **ClamAV Scanning (Option 3)**: We pass the quarantined file to the local ClamAV daemon (`clamd`). ClamAV scans the file against its database of known virus signatures. If malicious content is detected, the upload is aborted and the file is permanently destroyed.
5. **Permanent Storage**: Only if the file passes *all* previous checks is it moved from the quarantine folder to the permanent `/uploads/DesignDocuments` directory, and its metadata saved to the database.

> [!TIP]
> **Why ClamAV?** Since this is an on-premise/intranet application dealing with sensitive CAD documents, keeping the virus scanning entirely local (via ClamAV) ensures your proprietary documents never leave your server, maintaining strict data privacy compared to Cloud APIs.

## Server Requirements

> [!WARNING]
> **Server Requirements**: ClamAV must be installed and running on the host server where Node.js is deployed (e.g., using `sudo apt install clamav clamav-daemon` on Linux). 
> For your local Windows environment during development, we will use a **mock/passthrough scanner** if ClamAV is not detected, ensuring your local development is not blocked!

## Architecture Changes

### Backend Dependencies
- Installed `file-type` for magic number validation.
- Installed `clamscan` for integrating with the ClamAV daemon.

### Middleware & Services
- **backend/services/virusScanner.js**: A dedicated service that orchestrates the ClamAV scan. It includes fallback logic for local development if the daemon is unreachable.
- **backend/middleware/secureUploadMiddleware.js**: A reusable Express middleware wrapper around Multer that implements the magic number validation, temporary quarantine logic, and integrates the `virusScanner.js` service before allowing the request to proceed to the controller.

### Controllers
- **backend/controllers/workflowController.js**: Updated the `submitDesign` endpoint to use the new `secureUploadMiddleware` instead of the raw `multer` instance. Ensure the controller only processes files that have been validated and moved to the permanent storage directory.
