const { ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: 'There was an error executing this command!',
                    ephemeral: true
                });
            }
        } else if (interaction.isButton()) {
            if (interaction.customId === 'create_ticket') {
                await handleTicketCreate(interaction);
            } else if (interaction.customId === 'close_ticket') {
                await handleTicketClose(interaction);
            }
        }
    },
};

async function handleTicketCreate(interaction) {
    // Check if user already has an open ticket
    const existingChannel = interaction.guild.channels.cache.find(
        channel => 
            channel.name.startsWith(`ticket-${interaction.user.username}`) &&
            channel.type === ChannelType.GuildText
    );

    if (existingChannel) {
        return await interaction.reply({ 
            content: `❌ You already have an open ticket: ${existingChannel}`, 
            ephemeral: true 
        });
    }

    try {
        // Your specific category ID
        const TICKET_CATEGORY_ID = '1410068505117851739';
        // Support role IDs
        const SUPPORT_ROLE_ID = '1331801491069206608';
        const TRIAL_SUPPORT_ROLE_ID = '1421323232866340928';
        
        // Create ticket channel in your specific category
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                    ],
                },
                {
                    id: SUPPORT_ROLE_ID,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                    ],
                },
                {
                    id: TRIAL_SUPPORT_ROLE_ID,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                    ],
                },
                {
                    id: interaction.client.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ManageChannels,
                    ],
                },
            ],
        });

        // Send welcome message in ticket with role pings
        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket - ${interaction.user.tag}`)
            .setDescription('Support will be with you shortly. Please describe your issue.\n\nUse `/ticket close` or click the button below to close this ticket.')
            .setColor(0x00AE86)
            .setTimestamp();

        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

        await channel.send({ 
            content: `${interaction.user} Welcome to your ticket!\n<@&${SUPPORT_ROLE_ID}> <@&${TRIAL_SUPPORT_ROLE_ID}>`,
            embeds: [embed], 
            components: [closeButton] 
        });

        await interaction.reply({ 
            content: `✅ Ticket created: ${channel}`, 
            ephemeral: true 
        });

    } catch (error) {
        console.error('Error creating ticket:', error);
        await interaction.reply({ 
            content: '❌ Failed to create ticket. Please contact an administrator.', 
            ephemeral: true 
        });
    }
}

async function handleTicketClose(interaction) {
    if (!interaction.channel.name.startsWith('ticket-')) {
        return await interaction.reply({ content: '❌ This button only works in ticket channels.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎫 Closing Ticket')
        .setDescription('This ticket will be closed in 5 seconds...')
        .setColor(0xFF0000);

    await interaction.reply({ embeds: [embed] });

    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (error) {
            console.error('Error deleting ticket channel:', error);
        }
    }, 5000);
}