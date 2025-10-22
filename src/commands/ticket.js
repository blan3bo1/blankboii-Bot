const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage the ticket system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the ticket system')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel where ticket panel will be sent')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Close the current ticket')
        ),
    
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'setup') {
            await setupTicketSystem(interaction);
        } else if (interaction.options.getSubcommand() === 'close') {
            await closeTicket(interaction);
        }
    },
};

async function setupTicketSystem(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({ content: '❌ You need administrator permissions to set up the ticket system.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    
    if (channel.type !== ChannelType.GuildText) {
        return await interaction.reply({ content: '❌ Please select a text channel.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎫 Support Ticket System')
        .setDescription('Click the button below to create a support ticket!')
        .setColor(0x00AE86)
        .addFields(
            { name: 'How it works', value: '• Click "Create Ticket" to open a private channel\n• Describe your issue in the ticket\n• Support team will be notified automatically\n• Use `/ticket close` or the close button to close the ticket' },
            { name: 'Support Team', value: '<@&1331801491069206608> <@&1421323232866340928>' }
        )
        .setFooter({ text: 'Support Team' });

    const button = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

    try {
        await channel.send({ embeds: [embed], components: [button] });
        await interaction.reply({ content: `✅ Ticket system setup complete in ${channel}!`, ephemeral: true });
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: '❌ Failed to set up ticket system. Check bot permissions.', ephemeral: true });
    }
}

async function closeTicket(interaction) {
    if (!interaction.channel.name.startsWith('ticket-')) {
        return await interaction.reply({ content: '❌ This command can only be used in ticket channels.', ephemeral: true });
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