const nodemailer = require('nodemailer');

/**
 * Email Service
 * Handles sending emails using nodemailer
 */

// Create transporter
const createTransporter = () => {
    // Check if SMTP credentials are configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('[Email Service] SMTP credentials not configured. Emails will not be sent.');
        return null;
    }

    console.log('[Email Service] Creating SMTP transporter for:', process.env.SMTP_HOST);

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false, // false for port 587
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false,
            ciphers: 'SSLv3'
        },
        requireTLS: true // Force TLS
    });
};

/**
 * Send report email to recipients
 * @param {Array<string>} recipients - Array of email addresses
 * @param {Object} reportData - Report data from reportGenerator
 * @param {string} htmlContent - HTML formatted report
 * @returns {Promise<Object>} Send result
 */
const sendReportEmail = async (recipients, reportData, htmlContent) => {
    try {
        console.log('[Email Service] Starting email send process');
        console.log('[Email Service] Recipients:', recipients);

        const transporter = createTransporter();

        if (!transporter) {
            console.log('[Email Service] Email service not configured. Skipping email send.');
            return {
                success: false,
                message: 'Email service not configured'
            };
        }

        const { reportType, generatedAt, summary } = reportData;

        // IMPORTANT: Use SMTP_USER as FROM address to avoid relay errors
        const mailOptions = {
            from: process.env.SMTP_USER, // Changed from SMTP_FROM to SMTP_USER
            to: recipients.join(', '),
            subject: `${reportType} - ${new Date(generatedAt).toLocaleDateString()}`,
            html: htmlContent,
            text: `${reportType}\n\nTotal Requests: ${summary.totalRequests}\n\nGenerated at: ${generatedAt}`
        };

        // Add attachments if any were passed
        // reportData.attachments should be an array of objects: { filename: 'file.xlsx', content: buffer }
        if (reportData.attachments && Array.isArray(reportData.attachments)) {
            mailOptions.attachments = reportData.attachments;
        }

        console.log('[Email Service] Sending email from:', mailOptions.from);
        console.log('[Email Service] To:', mailOptions.to);

        const info = await transporter.sendMail(mailOptions);

        console.log('[Email Service] Email sent successfully! Message ID:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
            recipients: recipients.length
        };
    } catch (error) {
        console.error('[Email Service] Error sending email:', error.message);
        console.error('[Email Service] Error code:', error.code);
        throw error;
    }
};

/**
 * Send test email to verify configuration
 * @param {string} recipient - Test recipient email
 * @returns {Promise<Object>} Send result
 */
const sendTestEmail = async (recipient) => {
    try {
        const transporter = createTransporter();

        if (!transporter) {
            return {
                success: false,
                message: 'Email service not configured'
            };
        }

        const mailOptions = {
            from: process.env.SMTP_USER, // Changed from SMTP_FROM to SMTP_USER
            to: recipient,
            subject: 'TVS Asset Management - Test Email',
            html: `
                <h2>Email Configuration Test</h2>
                <p>This is a test email from TVS Asset Management System.</p>
                <p>If you received this email, your email configuration is working correctly.</p>
                <p>Sent at: ${new Date().toLocaleString()}</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('Error sending test email:', error);
        throw error;
    }
};

module.exports = {
    sendReportEmail,
    sendTestEmail
};
