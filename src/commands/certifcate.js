const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('certificate')
        .setDescription('Check Apple certificate status using API')
        .addAttachmentOption(option =>
            option
                .setName('mobileprovision')
                .setDescription('.mobileprovision file to check')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName('p12')
                .setDescription('P12 certificate file (optional)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('password')
                .setDescription('Password for P12 file (if provided)')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        try {
            const mobileprovisionAttachment = interaction.options.getAttachment('mobileprovision');
            const p12Attachment = interaction.options.getAttachment('p12');
            const password = interaction.options.getString('password');
            
            // Validate mobileprovision file type
            if (!mobileprovisionAttachment.name || !mobileprovisionAttachment.name.endsWith('.mobileprovision')) {
                return await interaction.reply({
                    content: '❌ Please upload a valid .mobileprovision file',
                    ephemeral: true
                });
            }

            await interaction.deferReply();
            console.log(`🔍 Checking certificate via API: ${mobileprovisionAttachment.name}`);
            
            // Download mobileprovision file
            const mpResponse = await fetch(mobileprovisionAttachment.url);
            if (!mpResponse.ok) {
                throw new Error(`Failed to download mobileprovision file: ${mpResponse.status}`);
            }
            const mpBuffer = await mpResponse.buffer();
            
            // Create FormData for API request
            const form = new FormData();
            form.append('mobileprovision', mpBuffer, {
                filename: 'cert.mobileprovision',
                contentType: 'application/octet-stream'
            });
            
            // Add P12 and password if provided
            if (p12Attachment && password) {
                // Download P12 file
                const p12Response = await fetch(p12Attachment.url);
                if (!p12Response.ok) {
                    throw new Error(`Failed to download P12 file: ${p12Response.status}`);
                }
                const p12Buffer = await p12Response.buffer();
                
                form.append('p12', p12Buffer, {
                    filename: 'cert.p12',
                    contentType: 'application/octet-stream'
                });
                form.append('password', password);
            }
            
            // Make API request to NezuShub
            console.log('🚀 Sending to NezuShub API...');
            const apiResponse = await fetch('https://tools.nezushub.vip/cert-ios-checker/check', {
                method: 'POST',
                body: form,
                headers: {
                    ...form.getHeaders()
                }
            });
            
            if (!apiResponse.ok) {
                const errorText = await apiResponse.text();
                throw new Error(`API error: ${apiResponse.status} - ${errorText}`);
            }
            
            const result = await apiResponse.json();
            console.log('✅ API Response:', result);
            
            // Create embed from API response
            const embed = this.createEmbedFromAPI(result, mobileprovisionAttachment.name, p12Attachment);
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Certificate API check failed:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    },
    
    createEmbedFromAPI(apiResult, mpFileName, p12Attachment) {
        // Determine status and color
        let status = 'Unknown';
        let statusEmoji = '⚠️';
        let color = 0xFFFF00; // Yellow
        
        if (apiResult.status === 'valid') {
            status = 'Valid';
            statusEmoji = '✅';
            color = 0x00FF00; // Green
        } else if (apiResult.status === 'revoked') {
            status = 'Revoked';
            statusEmoji = '❌';
            color = 0xFF0000; // Red
        } else if (apiResult.status === 'expired') {
            status = 'Expired';
            statusEmoji = '⏰';
            color = 0xFFA500; // Orange
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📱 Certificate Check Results')
            .setColor(color)
            .setTimestamp()
            .setFooter({ text: 'NezuShub API • ' + new Date().toLocaleDateString() });
        
        // Status
        embed.addFields({
            name: `${statusEmoji} Overall Status`,
            value: `**${status}**`,
            inline: true
        });
        
        // Certificate Info
        let certInfo = '';
        if (apiResult.certificate_name) {
            certInfo += `**Certificate:** ${apiResult.certificate_name}\n`;
        }
        if (apiResult.team_name) {
            certInfo += `**Team:** ${apiResult.team_name}\n`;
        }
        if (apiResult.team_id) {
            certInfo += `**Team ID:** ${apiResult.team_id}\n`;
        }
        
        if (certInfo) {
            embed.addFields({
                name: '📄 Certificate Info',
                value: certInfo,
                inline: false
            });
        }
        
        // App Info
        let appInfo = '';
        if (apiResult.bundle_id) {
            appInfo += `**Bundle ID:** ${apiResult.bundle_id}\n`;
        }
        if (apiResult.app_id) {
            appInfo += `**App ID:** ${apiResult.app_id}\n`;
        }
        
        if (appInfo) {
            embed.addFields({
                name: '📱 Application',
                value: appInfo,
                inline: false
            });
        }
        
        // Dates
        let datesInfo = '';
        if (apiResult.creation_date) {
            datesInfo += `**Created:** ${new Date(apiResult.creation_date).toLocaleString()}\n`;
        }
        if (apiResult.expiration_date) {
            const expires = new Date(apiResult.expiration_date);
            const isExpired = new Date() > expires;
            datesInfo += `**Expires:** ${expires.toLocaleString()} ${isExpired ? '❌' : '✅'}\n`;
        }
        
        if (datesInfo) {
            embed.addFields({
                name: '📅 Dates',
                value: datesInfo,
                inline: true
            });
        }
        
        // Platform & Type
        let techInfo = '';
        if (apiResult.platform) {
            techInfo += `**Platform:** ${apiResult.platform}\n`;
        }
        if (apiResult.profile_type) {
            techInfo += `**Type:** ${apiResult.profile_type}\n`;
        }
        if (apiResult.devices && apiResult.devices.length > 0) {
            techInfo += `**Devices:** ${apiResult.devices.length}\n`;
        }
        
        if (techInfo) {
            embed.addFields({
                name: '⚙️ Technical',
                value: techInfo,
                inline: true
            });
        }
        
        // Files used
        let filesInfo = `**MobileProvision:** ${mpFileName}\n`;
        if (p12Attachment) {
            filesInfo += `**P12:** ${p12Attachment.name}\n`;
            filesInfo += `**Password:** ${password ? '✓ Provided' : '✗ Missing'}\n`;
        } else {
            filesInfo += `**P12:** Not provided\n`;
        }
        
        embed.addFields({
            name: '📎 Files',
            value: filesInfo,
            inline: false
        });
        
        // Additional API info
        if (apiResult.message) {
            embed.addFields({
                name: '💡 API Message',
                value: apiResult.message,
                inline: false
            });
        }
        
        // Capabilities if available
        if (apiResult.entitlements && Object.keys(apiResult.entitlements).length > 0) {
            const capabilities = Object.keys(apiResult.entitlements).slice(0, 5).join(', ');
            embed.addFields({
                name: '🔧 Capabilities',
                value: capabilities + (Object.keys(apiResult.entitlements).length > 5 ? '...' : ''),
                inline: false
            });
        }
        
        return embed;
    }
};
