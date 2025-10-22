const fs = require('fs-extra');
const path = require('path');
const nodeCron = require('node-cron');

class FileCleanup {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        this.signedDir = path.join(__dirname, '../../signed');
        this.maxAge = 60 * 60 * 1000; // 1 hour
    }

    startCleanup() {
        // Run cleanup every hour
        nodeCron.schedule('0 * * * *', () => {
            this.cleanupOldFiles();
        });
    }

    async cleanupOldFiles() {
        try {
            await this.cleanupDirectory(this.tempDir);
            await this.cleanupDirectory(this.signedDir);
            console.log('Cleanup completed successfully');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    async cleanupDirectory(dirPath) {
        if (!await fs.pathExists(dirPath)) return;

        const items = await fs.readdir(dirPath);
        const now = Date.now();

        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = await fs.stat(itemPath);
            
            if (now - stat.ctimeMs > this.maxAge) {
                await fs.remove(itemPath);
                console.log(`Cleaned up: ${itemPath}`);
            }
        }
    }
}

module.exports = new FileCleanup();
