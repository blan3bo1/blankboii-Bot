// deploy-commands.js - WITH MANUAL .env LOADING
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// MANUALLY LOAD .env FILE
console.log('🔧 Loading .env file manually...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log('✅ .env file found at:', envPath);
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) continue;
        
        const key = trimmed.substring(0, equalsIndex).trim();
        const value = trimmed.substring(equalsIndex + 1).trim();
        
        if (key && value) {
            process.env[key] = value;
            console.log(`   Loaded: ${key}`);
        }
    }
    console.log('✅ .env file loaded successfully');
} else {
    console.log('❌ .env file NOT found at:', envPath);
    console.log('Current directory files:');
    try {
        const files = fs.readdirSync(__dirname);
        console.log(files);
    } catch (e) {
        console.log('Cannot read directory');
    }
}

const commands = [
  {
    name: 'sign',
    description: 'Sign an IPA file with P12 and mobile provision',
    options: [
      {
        name: 'ipa',
        type: 11,
        description: 'The IPA file to sign',
        required: true
      },
      {
        name: 'p12',
        type: 11,
        description: 'P12 certificate file',
        required: true
      },
      {
        name: 'provision',
        type: 11,
        description: 'Mobile provision file',
        required: true
      },
      {
        name: 'password',
        type: 3,
        description: 'Password for P12 certificate',
        required: true
      }
    ]
  },
  {
    name: 'ticket',
    description: 'Manage the ticket system',
    options: [
        {
            type: 1, // SUB_COMMAND
            name: 'setup',
            description: 'Set up the ticket system',
            options: [
                {
                    type: 7, // CHANNEL
                    name: 'channel',
                    description: 'Channel where ticket panel will be sent',
                    required: true,
                    channel_types: [0] // GUILD_TEXT
                }
            ]
        },
        {
            type: 1, // SUB_COMMAND
            name: 'close',
            description: 'Close the current ticket'
        }
    ]
  },
  {
    name: 'ipaanalyze',
    description: 'Analyze an IPA file to check if it\'s signed and get detailed information',
    options: [
        {
            name: 'ipa',
            type: 11, // ATTACHMENT
            description: 'The IPA file to analyze',
            required: true
        }
    ]
  },
{
  name: 'certificate',
  description: 'Check Apple certificate status using API',
  options: [
    {
      name: 'mobileprovision',
      type: 11, // ATTACHMENT
      description: '.mobileprovision file to check',
      required: true
    },
    {
      name: 'p12',
      type: 11, // ATTACHMENT
      description: 'P12 certificate file (optional)',
      required: false
    },
    {
      name: 'password',
      type: 3, // STRING
      description: 'Password for P12 file (if provided)',
      required: false
    }
  ]
}
];

// Debug: Check if environment variables are loaded
console.log('\n🔧 DEBUG: Checking environment variables...');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'LOADED' : 'MISSING');
console.log('DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? 'LOADED' : 'MISSING');
console.log('GUILD_ID:', process.env.GUILD_ID ? 'LOADED' : 'MISSING');

if (!process.env.DISCORD_TOKEN) {
    console.log('\n❌ ERROR: DISCORD_TOKEN is still not set!');
    console.log('Available environment variables:');
    Object.keys(process.env).forEach(key => {
        if (key.includes('DISCORD') || key.includes('GUILD')) {
            console.log(`   ${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
        }
    });
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        console.log('\n📝 Registering Discord commands...');
        
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('✅ Commands registered successfully!');
        console.log('📋 Available commands:');
        console.log('   /sign - Sign IPA files');
        console.log('   /certificate - Check mobileprovision certificate status');
        console.log('   /analyzeksign - Analyze ksign files');
        console.log('   /ticket - Manage ticket system');
        console.log('   /ipaanalyze - Analyze IPA files');
        
        return data;
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        throw error;
    }
}

// Auto-run if this file is executed directly
if (require.main === module) {
    registerCommands();
}

module.exports = registerCommands;