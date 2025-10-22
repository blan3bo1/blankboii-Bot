const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { analyzeIPA } = require('../utils/ipaAnalyzer.js');
const fs = require('fs');
// Remove: const fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analyze')
        .setDescription('Analyze an IPA file to check if it\'s signed and get detailed information')
        .addAttachmentOption(option =>
            option.setName('ipa')
                .setDescription('The IPA file to analyze')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        const ipaAttachment = interaction.options.getAttachment('ipa');
        
        if (!ipaAttachment.name.toLowerCase().endsWith('.ipa')) {
            return await interaction.editReply('❌ Please upload a valid .ipa file.');
        }

        try {
            // Download the IPA file using built-in fetch (Node.js 18+)
            const response = await fetch(ipaAttachment.url);
            const buffer = await response.arrayBuffer();
            
            const tempDir = './temp';
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const filePath = `${tempDir}/analysis_${Date.now()}.ipa`;
            fs.writeFileSync(filePath, Buffer.from(buffer));
            
            // Analyze the IPA
            const analysis = await analyzeIPA(filePath);
            
            // Create embed with results
            const embed = new EmbedBuilder()
                .setTitle(`📱 IPA Analysis: ${analysis.appName}`)
                .setColor(analysis.isSigned ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { 
                        name: '🔐 Signing Status', 
                        value: analysis.isSigned ? '✅ **SIGNED**' : '❌ **NOT SIGNED**', 
                        inline: true 
                    },
                    { 
                        name: '📊 File Size', 
                        value: `${(analysis.fileSize / 1024 / 1024).toFixed(2)} MB`, 
                        inline: true 
                    },
                    { 
                        name: '🏗️ Architectures', 
                        value: analysis.architectures.join(', ') || 'Unknown', 
                        inline: true 
                    },
                    { 
                        name: '🔧 Frameworks', 
                        value: analysis.embeddedFrameworks.toString(), 
                        inline: true 
                    },
                    { 
                        name: '🧩 Plugins', 
                        value: analysis.plugins.toString(), 
                        inline: true 
                    }
                );

            // Add signing details if signed
            if (analysis.isSigned && analysis.signingInfo) {
                if (analysis.signingInfo.bundleIdentifier) {
                    embed.addFields({ 
                        name: '📦 Bundle ID', 
                        value: `\`${analysis.signingInfo.bundleIdentifier}\``, 
                        inline: true 
                    });
                }
                if (analysis.signingInfo.teamIdentifier) {
                    embed.addFields({ 
                        name: '👥 Team ID', 
                        value: `\`${analysis.signingInfo.teamIdentifier}\``, 
                        inline: true 
                    });
                }
                if (analysis.signingInfo.authorities) {
                    const authoritiesText = analysis.signingInfo.authorities.map(a => `• ${a}`).join('\n').substring(0, 1024);
                    embed.addFields({ 
                        name: '📜 Signing Authorities', 
                        value: authoritiesText, 
                        inline: false 
                    });
                }
            }

            // Cleanup
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (cleanupError) {
                console.log('Cleanup warning:', cleanupError.message);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error analyzing IPA:', error);
            await interaction.editReply(`❌ Error analyzing IPA: ${error.message}`);
        }
    },
};