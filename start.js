// start.js - Run bot
console.log('🚀 Starting IPA Signer Bot with Keep-Alive...');

// MANUALLY LOAD .env FILE
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
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
    console.log('✅ .env file loaded manually');
} else {
    console.log('❌ .env file not found at:', envPath);
}

// Start keep-alive server first
console.log('📡 Starting keep-alive server...');
require('./keep-alive');

// Auto-register commands then start bot
const initializeBot = async () => {
    try {
        console.log('📝 Attempting to register Discord commands...');
        const registerCommands = require('./deploy-commands');
        await registerCommands();
        
        console.log('✅ Command registration completed');
    } catch (error) {
        console.log('⚠️ Command registration failed, starting bot anyway...');
    }
    
    // Start the bot regardless of command registration
    console.log('🤖 Starting Discord bot...');
    require('./src/bot');
};

initializeBot();
