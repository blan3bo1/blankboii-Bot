const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

async function analyzeIPA(filePath) {
    try {
        console.log('🔍 Analyzing IPA file:', filePath);
        
        if (!fs.existsSync(filePath)) {
            throw new Error('IPA file not found');
        }

        // Check if it's actually an IPA file
        if (!filePath.toLowerCase().endsWith('.ipa')) {
            throw new Error('File is not an IPA file');
        }

        const tempDir = path.join(__dirname, '..', 'temp', `ipa_analysis_${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        // Extract IPA (which is just a ZIP file)
        const zip = new AdmZip(filePath);
        zip.extractAllTo(tempDir, true);

        // Look for .app bundle
        const payloadDir = path.join(tempDir, 'Payload');
        if (!fs.existsSync(payloadDir)) {
            throw new Error('Invalid IPA: No Payload directory found');
        }

        const appBundles = fs.readdirSync(payloadDir).filter(item => 
            item.endsWith('.app') && fs.statSync(path.join(payloadDir, item)).isDirectory()
        );

        if (appBundles.length === 0) {
            throw new Error('No .app bundle found in IPA');
        }

        const appBundle = appBundles[0];
        const appPath = path.join(payloadDir, appBundle);
        
        console.log('📱 Found app bundle:', appBundle);

        // Analyze the app bundle
        const analysis = await analyzeAppBundle(appPath, appBundle);
        
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        return analysis;

    } catch (error) {
        console.error('Error analyzing IPA:', error);
        throw error;
    }
}

async function analyzeAppBundle(appPath, appBundle) {
    const analysis = {
        appName: appBundle.replace('.app', ''),
        isSigned: false,
        signingInfo: null,
        entitlements: null,
        certificates: [],
        bundleInfo: null,
        architectures: [],
        fileSize: 0,
        embeddedFrameworks: 0,
        plugins: 0
    };

    try {
        // Get file size
        analysis.fileSize = getFolderSize(appPath);

        // Check if binary exists and get architectures
        const binaryPath = await findAppBinary(appPath, appBundle);
        if (binaryPath && fs.existsSync(binaryPath)) {
            analysis.architectures = await getBinaryArchitectures(binaryPath);
            analysis.isSigned = await checkCodeSignature(binaryPath);
            
            if (analysis.isSigned) {
                analysis.signingInfo = await getSigningInfo(binaryPath);
                analysis.certificates = await getCertificates(binaryPath);
                analysis.entitlements = await getEntitlements(binaryPath);
            }
        }

        // Get bundle info from Info.plist
        analysis.bundleInfo = await getBundleInfo(appPath);

        // Count embedded frameworks and plugins
        analysis.embeddedFrameworks = countFilesInDirectory(appPath, '.framework');
        analysis.plugins = countFilesInDirectory(appPath, '.appex');

        return analysis;

    } catch (error) {
        console.error('Error analyzing app bundle:', error);
        analysis.error = error.message;
        return analysis;
    }
}

async function findAppBinary(appPath, appBundle) {
    try {
        const files = fs.readdirSync(appPath);
        const binaryName = appBundle.replace('.app', '');
        
        // Look for the main executable
        for (const file of files) {
            const filePath = path.join(appPath, file);
            const stats = fs.statSync(filePath);
            
            if (!stats.isDirectory() && (file === binaryName || isExecutable(filePath))) {
                return filePath;
            }
        }
        
        // Fallback: look for any executable file
        for (const file of files) {
            const filePath = path.join(appPath, file);
            if (!fs.statSync(filePath).isDirectory() && isExecutable(filePath)) {
                return filePath;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error finding app binary:', error);
        return null;
    }
}

function isExecutable(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

async function checkCodeSignature(binaryPath) {
    try {
        // Use codesign to check signature
        execSync(`codesign -dv "${binaryPath}"`, { stdio: 'pipe' });
        return true;
    } catch (error) {
        return false;
    }
}

async function getSigningInfo(binaryPath) {
    try {
        const output = execSync(`codesign -dvvv "${binaryPath}" 2>&1 || true`, { encoding: 'utf8' });
        return parseSigningInfo(output);
    } catch (error) {
        return { error: error.message };
    }
}

function parseSigningInfo(output) {
    const info = {};
    const lines = output.split('\n');
    
    for (const line of lines) {
        if (line.includes('Authority=')) {
            const authority = line.split('Authority=')[1]?.trim();
            if (authority) {
                if (!info.authorities) info.authorities = [];
                info.authorities.push(authority);
            }
        } else if (line.includes('TeamIdentifier=')) {
            info.teamIdentifier = line.split('TeamIdentifier=')[1]?.trim();
        } else if (line.includes('Identifier=')) {
            info.bundleIdentifier = line.split('Identifier=')[1]?.trim();
        } else if (line.includes('Format=')) {
            info.format = line.split('Format=')[1]?.trim();
        } else if (line.includes('CodeDirectory')) {
            info.codeDirectory = line.trim();
        } else if (line.includes('Signature size=')) {
            info.signatureSize = line.split('Signature size=')[1]?.trim();
        }
    }
    
    return info;
}

async function getCertificates(binaryPath) {
    try {
        const output = execSync(`codesign -d --extract-certificates - "${binaryPath}" 2>/dev/null | openssl x509 -inform der -text -noout 2>/dev/null || true`, { encoding: 'utf8' });
        return parseCertificates(output);
    } catch (error) {
        return [{ error: error.message }];
    }
}

function parseCertificates(output) {
    const certificates = [];
    const certBlocks = output.split('Certificate:');
    
    for (const block of certBlocks.slice(1)) {
        const cert = {};
        const lines = block.split('\n');
        
        for (const line of lines) {
            if (line.includes('Subject:')) {
                cert.subject = line.split('Subject:')[1]?.trim();
            } else if (line.includes('Issuer:')) {
                cert.issuer = line.split('Issuer:')[1]?.trim();
            } else if (line.includes('Not Before:')) {
                cert.validFrom = line.split('Not Before:')[1]?.trim();
            } else if (line.includes('Not After :')) {
                cert.validTo = line.split('Not After :')[1]?.trim();
            } else if (line.includes('Subject Key Identifier:')) {
                cert.keyIdentifier = line.split('Subject Key Identifier:')[1]?.trim();
            }
        }
        
        if (Object.keys(cert).length > 0) {
            certificates.push(cert);
        }
    }
    
    return certificates;
}

async function getEntitlements(binaryPath) {
    try {
        const output = execSync(`codesign -d --entitlements :- "${binaryPath}" 2>/dev/null || true`, { encoding: 'utf8' });
        return output.trim() || null;
    } catch (error) {
        return null;
    }
}

async function getBinaryArchitectures(binaryPath) {
    try {
        const output = execSync(`lipo -info "${binaryPath}" 2>&1 || true`, { encoding: 'utf8' });
        const match = output.match(/Architectures in the fat file: [^ ]+ are: (.+)/);
        if (match) {
            return match[1].split(' ').filter(arch => arch.trim());
        }
        return ['unknown'];
    } catch (error) {
        return ['error'];
    }
}

async function getBundleInfo(appPath) {
    try {
        const plistPath = path.join(appPath, 'Info.plist');
        if (fs.existsSync(plistPath)) {
            // Simple plist parsing - for full parsing you'd need a plist library
            const plistContent = fs.readFileSync(plistPath, 'utf8');
            return {
                hasInfoPlist: true,
                // You could add specific plist parsing here
                rawSize: plistContent.length
            };
        }
        return { hasInfoPlist: false };
    } catch (error) {
        return { error: error.message };
    }
}

function getFolderSize(folderPath) {
    try {
        let size = 0;
        const items = fs.readdirSync(folderPath);
        
        for (const item of items) {
            const itemPath = path.join(folderPath, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                size += getFolderSize(itemPath);
            } else {
                size += stats.size;
            }
        }
        
        return size;
    } catch (error) {
        return 0;
    }
}

function countFilesInDirectory(dirPath, extension) {
    try {
        let count = 0;
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                if (item.endsWith(extension)) {
                    count++;
                }
                count += countFilesInDirectory(itemPath, extension);
            }
        }
        
        return count;
    } catch (error) {
        return 0;
    }
}

module.exports = { analyzeIPA };