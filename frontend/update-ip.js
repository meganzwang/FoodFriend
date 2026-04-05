#!/usr/bin/env node

/**
 * Auto-update script for FoodFriend API URL
 *
 * This script automatically detects your current local IP address and updates
 * the EXPO_PUBLIC_API_URL in the .env file. This is useful when switching between
 * different WiFi networks or when your IP address changes.
 *
 * Usage:
 *   npm run update-ip
 *   or
 *   node update-ip.js
 *
 * After running, restart your Expo app to pick up the new IP address.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const interface = interfaces[interfaceName];
    for (const address of interface) {
      // Look for IPv4 addresses that are not internal (not 127.0.0.1)
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}

function updateEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const ip = getLocalIP();

  if (!ip) {
    console.error('Could not detect local IP address');
    process.exit(1);
  }

  const apiUrl = `http://${ip}:3001`;
  const envContent = `EXPO_PUBLIC_API_URL=${apiUrl}\n`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env file with API_URL: ${apiUrl}`);
    console.log('Restart your Expo app to pick up the new IP address.');
  } catch (error) {
    console.error('Error updating .env file:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  updateEnvFile();
}

module.exports = { updateEnvFile, getLocalIP };