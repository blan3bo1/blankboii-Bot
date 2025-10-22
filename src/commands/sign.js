const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const signingService = require('../services/signingService');
const security = require('../utils/security');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sign')
        .setDescription('Sign an IPA file with P12 and mobile provision')
        .addAttachmentOption(option =>
            option.setName('ipa')
                .setDescription('The IPA file to sign')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('p12')
                .setDescription('P12 certificate file')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('provision')
                .setDescription('Mobile provision file')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('password')
                .setDescription('Password for P12 certificate')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get files from interaction
            const ipaAttachment = interaction.options.getAttachment('ipa');
            const p12Attachment = interaction.options.getAttachment('p12');
            const provisionAttachment = interaction.options.getAttachment('provision');
            const password = interaction.options.getString('password');

            // Validate file types
            if (!ipaAttachment.name.endsWith('.ipa')) {
                return await interaction.editReply({
                    content: '❌ Please provide a valid .ipa file.'
                });
            }

            if (!p12Attachment.name.endsWith('.p12')) {
                return await interaction.editReply({
                    content: '❌ Please provide a valid .p12 file.'
                });
            }

            if (!provisionAttachment.name.endsWith('.mobileprovision')) {
                return await interaction.editReply({
                    content: '❌ Please provide a valid .mobileprovision file.'
                });
            }

            // Check file sizes
            const maxSize = process.env.MAX_FILE_SIZE || 50 * 1024 * 1024;
            if (ipaAttachment.size > maxSize) {
                return await interaction.editReply({
                    content: `❌ IPA file is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`
                });
            }

            // Create unique session ID
            const sessionId = require('uuid').v4();
            const tempDir = path.join(__dirname, '../../temp', sessionId);
            const signedDir = path.join(__dirname, '../../signed', sessionId);

            await fs.ensureDir(tempDir);
            await fs.ensureDir(signedDir);

            // Download files
            await interaction.editReply({ content: '📥 Downloading files...' });

            const ipaPath = path.join(tempDir, 'app.ipa');
            const p12Path = path.join(tempDir, 'cert.p12');
            const provisionPath = path.join(tempDir, 'embedded.mobileprovision');

            await security.downloadFile(ipaAttachment.url, ipaPath);
            await security.downloadFile(p12Attachment.url, p12Path);
            await security.downloadFile(provisionAttachment.url, provisionPath);

            // Sign the IPA
            await interaction.editReply({ content: '🔐 Signing IPA file...' });

            const signedIpaPath = await signingService.signIpa(
                ipaPath,
                p12Path,
                provisionPath,
                password,
                signedDir
            );

            // Create attachment
            const signedFile = await fs.readFile(signedIpaPath);
            const attachment = new AttachmentBuilder(signedFile, { 
                name: `signed-${ipaAttachment.name}` 
            });

            // Send signed file
            await interaction.editReply({ 
                content: '✅ IPA signed successfully!',
                files: [attachment]
            });

            // Cleanup temporary files
            await security.cleanupSession(sessionId);

        } catch (error) {
            console.error('Signing error:', error);
            await interaction.editReply({
                content: `❌ Error signing IPA: ${error.message}`
            });
        }
    },
};
