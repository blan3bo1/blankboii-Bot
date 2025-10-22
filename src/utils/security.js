const fs = require('fs-extra');
const path = require('path');
const https = require('https');

class Security {
    hasPermission(member) {
        return true; // Everyone can use
    }

    async downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filePath);
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download file: ${response.statusCode}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(filePath, () => reject(err));
            });
        });
    }

    async cleanupSession(sessionId) {
        const tempDir = path.join(__dirname, '../../temp', sessionId);
        const signedDir = path.join(__dirname, '../../signed', sessionId);

        try {
            await fs.remove(tempDir);
            await fs.remove(signedDir);
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}

module.exports = new Security();
