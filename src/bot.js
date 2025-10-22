// MANUALLY LOAD .env FILE
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) continue;
        const key = trimmed.substring(0, equalsIndex).trim();
        const value = trimmed.substring(equalsIndex + 1).trim();
        if (key && value) {
            process.env[key] = value;
        }
    }
}

// Try to import discord.js with error handling
let Client, GatewayIntentBits, Collection, ActivityType;
try {
    const discord = require('discord.js');
    Client = discord.Client;
    GatewayIntentBits = discord.GatewayIntentBits;
    Collection = discord.Collection;
    ActivityType = discord.ActivityType;
    
    console.log('✅ Discord.js loaded successfully');
} catch (error) {
    console.error('❌ Failed to load discord.js:', error);
    console.log('💡 Try running: npm install discord.js@14.14.1');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ],
    presence: {
        status: 'dnd',
        activities: [{
            name: 'Managing Server',
            type: ActivityType.Watching
        }]
    }
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('📁 Loading commands from:', commandsPath);
console.log('📋 Command files found:', commandFiles);

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    console.log(`🔧 Loading command: ${file}`);
    try {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Successfully loaded command: ${command.data.name}`);
        } else {
            console.log(`⚠️ Command ${file} is missing required "data" or "execute" property`);
        }
    } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error.message);
    }
}

console.log(`✅ Loaded ${client.commands.size} commands:`, [...client.commands.keys()]);

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

console.log('📁 Loading events from:', eventsPath);
console.log('📋 Event files found:', eventFiles);

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
            console.log(`✅ Registered once event: ${event.name}`);
        } else {
            client.on(event.name, (...args) => event.execute(...args));
            console.log(`✅ Registered event: ${event.name}`);
        }
    } catch (error) {
        console.error(`❌ Error loading event ${file}:`, error.message);
    }
}

// Initialize cleanup service
try {
    const cleanupService = require('./utils/fileCleanup');
    if (cleanupService && cleanupService.startCleanup) {
        cleanupService.startCleanup();
        console.log('✅ File cleanup service started');
    }
} catch (error) {
    console.log('⚠️ File cleanup service not found or failed to start');
}

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🏠 Serving ${client.guilds.cache.size} servers`);
    console.log(`🔴 Bot status: DND`);
    
    // Try to register commands on startup
    try {
        console.log('🔄 Checking command registration...');
        const registerCommands = require('../deploy-commands');
        registerCommands();
    } catch (error) {
        console.log('⚠️ Command registration check failed, but bot is running');
    }
});

// REMOVED ALL AUTOMATIC FILE CHECKING CODE
// Certificate checking is ONLY available via /certificate command

client.login(process.env.DISCORD_TOKEN);

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

module.exports = client;
