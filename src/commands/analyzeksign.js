const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const forge = require('node-forge');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analyzeksign')
        .setDescription('Analyze a .ksign file structure and extract certificates')
        .addAttachmentOption(option =>
            option.setName('ksign')
                .setDescription('.ksign file to analyze')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const ksignAttachment = interaction.options.getAttachment('ksign');
            
            if (!ksignAttachment.name.endsWith('.ksign')) {
                return await interaction.editReply({
                    content: '❌ Please provide a valid .ksign file.'
                });
            }

            // Check file size
            const maxSize = process.env.MAX_FILE_SIZE || 50 * 1024 * 1024;
            if (ksignAttachment.size > maxSize) {
                return await interaction.editReply({
                    content: `❌ Ksign file is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`
                });
            }

            await interaction.editReply({ content: '📥 Downloading ksign file...' });

            // Create temporary directory
            const sessionId = require('uuid').v4();
            const tempDir = path.join(__dirname, '../../temp', sessionId);
            await fs.ensureDir(tempDir);

            const ksignPath = path.join(tempDir, 'file.ksign');
            
            // Download file
            const https = require('https');
            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(ksignPath);
                https.get(ksignAttachment.url, (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });

            await interaction.editReply({ content: '🔍 Analyzing ksign file structure...' });

            // Analyze the file
            const analysis = await this.analyzeKsign(ksignPath);
            
            // Create embed response
            const embed = {
                color: 0x0099ff,
                title: '🔍 Ksign File Analysis',
                fields: [
                    {
                        name: '📁 File Size',
                        value: `${analysis.fileSize}`,
                        inline: true
                    },
                    {
                        name: '🔤 File Type',
                        value: analysis.fileType,
                        inline: true
                    },
                    {
                        name: '📝 Format',
                        value: analysis.format,
                        inline: true
                    }
                ],
                timestamp: new Date()
            };

            // Add certificates if found
            if (analysis.certificates && analysis.certificates.length > 0) {
                analysis.certificates.forEach((cert, index) => {
                    embed.fields.push({
                        name: `📜 Certificate ${index + 1}`,
                        value: `**Subject:** ${cert.subject}\n**Issuer:** ${cert.issuer}\n**Valid:** ${cert.validFrom} to ${cert.validUntil}\n**Status:** ${cert.isValid ? '✅ Valid' : '❌ Expired'}`,
                        inline: false
                    });
                });
            }

            // Add private key info if found
            if (analysis.privateKey) {
                embed.fields.push({
                    name: '🔐 Private Key',
                    value: `**Type:** ${analysis.privateKey.type}\n**Bits:** ${analysis.privateKey.bits}`,
                    inline: true
                });
            }

            // Add hex preview
            if (analysis.hexPreview) {
                embed.fields.push({
                    name: '🔍 Hex Preview',
                    value: `\`\`\`${analysis.hexPreview}\`\`\``,
                    inline: false
                });
            }

            await interaction.editReply({ 
                content: null,
                embeds: [embed]
            });

            // Cleanup
            await fs.remove(tempDir);

        } catch (error) {
            console.error('Ksign analysis error:', error);
            await interaction.editReply({
                content: `❌ Error analyzing ksign file: ${error.message}`
            });
        }
    },

    async analyzeKsign(filePath) {
        const stats = await fs.stat(filePath);
        const buffer = await fs.readFile(filePath);
        const fileSize = `${(stats.size / 1024).toFixed(2)} KB`;
        
        let analysis = {
            fileSize,
            fileType: 'Unknown',
            format: 'Binary',
            certificates: [],
            privateKey: null,
            hexPreview: buffer.slice(0, 100).toString('hex')
        };

        const fileContent = buffer.toString('binary');
        
        // Check for PEM format (certificates/keys)
        if (fileContent.includes('-----BEGIN')) {
            analysis.format = 'PEM';
            
            // Extract all PEM blocks
            const pemBlocks = this.extractPemBlocks(fileContent);
            
            for (const block of pemBlocks) {
                try {
                    if (block.includes('CERTIFICATE')) {
                        const cert = forge.pki.certificateFromPem(block);
                        const now = new Date();
                        const validFrom = new Date(cert.validity.notBefore);
                        const validUntil = new Date(cert.validity.notAfter);
                        
                        analysis.certificates.push({
                            subject: this.getCommonName(cert.subject),
                            issuer: this.getCommonName(cert.issuer),
                            validFrom: validFrom.toLocaleDateString(),
                            validUntil: validUntil.toLocaleDateString(),
                            isValid: now >= validFrom && now <= validUntil,
                            serialNumber: cert.serialNumber
                        });
                    } else if (block.includes('PRIVATE KEY')) {
                        try {
                            const privateKey = forge.pki.privateKeyFromPem(block);
                            analysis.privateKey = {
                                type: privateKey.toString().includes('RSA') ? 'RSA' : 'Unknown',
                                bits: privateKey.n.bitLength()
                            };
                        } catch (e) {
                            analysis.privateKey = { type: 'Encrypted/Unknown', bits: 'N/A' };
                        }
                    }
                } catch (e) {
                    // Skip invalid PEM blocks
                }
            }
            
            if (analysis.certificates.length > 0) {
                analysis.fileType = 'Certificate Bundle';
            } else if (analysis.privateKey) {
                analysis.fileType = 'Private Key';
            }
        }
        
        // Check for ZIP/PK archive
        if (buffer.includes(Buffer.from('PK'))) {
            analysis.format = 'ZIP Archive';
            analysis.fileType = 'Archive File';
        }
        
        // Check for plist format (common in iOS)
        if (fileContent.includes('<?plist') || fileContent.includes('bplist')) {
            analysis.format = 'Property List';
            analysis.fileType = 'Configuration File';
        }
        
        // Check for raw DER certificate
        if (this.isLikelyDerCertificate(buffer)) {
            analysis.format = 'DER';
            analysis.fileType = 'Binary Certificate';
            
            try {
                const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(fileContent));
                const now = new Date();
                const validFrom = new Date(cert.validity.notBefore);
                const validUntil = new Date(cert.validity.notAfter);
                
                analysis.certificates.push({
                    subject: this.getCommonName(cert.subject),
                    issuer: this.getCommonName(cert.issuer),
                    validFrom: validFrom.toLocaleDateString(),
                    validUntil: validUntil.toLocaleDateString(),
                    isValid: now >= validFrom && now <= validUntil,
                    serialNumber: cert.serialNumber
                });
            } catch (e) {
                // Not a DER certificate
            }
        }

        return analysis;
    },

    extractPemBlocks(content) {
        const pemRegex = /-----BEGIN [A-Z ]+-----[^-]*-----END [A-Z ]+-----/g;
        return content.match(pemRegex) || [];
    },

    getCommonName(attributes) {
        for (let i = 0; i < attributes.length; i++) {
            if (attributes[i].name === 'commonName') {
                return attributes[i].value;
            }
        }
        return 'Unknown';
    },

    isLikelyDerCertificate(buffer) {
        // Basic check for DER certificate structure
        if (buffer.length < 10) return false;
        
        // DER certificates often start with specific sequences
        const firstBytes = buffer.slice(0, 4);
        return firstBytes[0] === 0x30; // SEQUENCE tag in DER
    }
};
