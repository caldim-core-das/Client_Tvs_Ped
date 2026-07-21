require('dotenv').config();
const nodemailer = require('nodemailer');

const hosts = ['smtp.zoho.com', 'smtp.zoho.in', 'smtppro.zoho.com', 'smtppro.zoho.in'];
const ports = [465, 587];

(async () => {
    for (const host of hosts) {
        for (const port of ports) {
            try {
                const secure = port === 465;
                const t = nodemailer.createTransport({
                    host,
                    port,
                    secure,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                });
                await t.verify();
                console.log(`SUCCESS: ${host}:${port} secure=${secure}`);
            } catch(e) {
                console.log(`FAIL ${host}:${port} (secure=${port === 465}): ${e.message}`);
            }
        }
    }
    process.exit(0);
})();
