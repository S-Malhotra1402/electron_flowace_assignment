#!/usr/bin/env node

// Cleanup script to remove restart mechanisms
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const platform = os.platform();

console.log(`Cleaning up restart mechanisms for ${platform}...`);

async function cleanup() {
  try {
    switch (platform) {
      case 'win32':
        await cleanupWindows();
        break;
      case 'darwin':
        await cleanupMacOS();
        break;
      case 'linux':
        await cleanupLinux();
        break;
      default:
        console.log('Unknown platform:', platform);
    }
    console.log('Cleanup completed successfully!');
  } catch (error) {
    console.error('Cleanup failed:', error.message);
  }
}

function cleanupWindows() {
  return new Promise((resolve) => {
    // Remove scheduled task
    exec('schtasks /delete /tn "SystemResilientApp" /f', (error) => {
      if (error) {
        console.log('No scheduled task found or failed to remove');
      } else {
        console.log('Removed scheduled task');
      }
      
      // Remove registry entry
      exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "SystemResilientApp" /f', (error) => {
        if (error) {
          console.log('No registry entry found or failed to remove');
        } else {
          console.log('Removed registry entry');
        }
        resolve();
      });
    });
  });
}

function cleanupMacOS() {
  return new Promise((resolve) => {
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.example.systemresilientapp.plist');
    
    // Unload launch agent
    exec(`launchctl unload ${plistPath}`, (error) => {
      if (error) {
        console.log('Launch agent not loaded or failed to unload');
      } else {
        console.log('Unloaded launch agent');
      }
      
      // Remove plist file
      try {
        if (fs.existsSync(plistPath)) {
          fs.unlinkSync(plistPath);
          console.log('Removed plist file');
        } else {
          console.log('No plist file found');
        }
      } catch (error) {
        console.log('Failed to remove plist file:', error.message);
      }
      
      resolve();
    });
  });
}

function cleanupLinux() {
  return new Promise((resolve) => {
    // Stop and disable systemd service
    exec('systemctl --user stop system-resilient-app && systemctl --user disable system-resilient-app', (error) => {
      if (error) {
        console.log('Systemd service not found or failed to stop');
      } else {
        console.log('Stopped and disabled systemd service');
      }
      
      // Remove service file
      const servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', 'system-resilient-app.service');
      try {
        if (fs.existsSync(servicePath)) {
          fs.unlinkSync(servicePath);
          console.log('Removed systemd service file');
        } else {
          console.log('No systemd service file found');
        }
      } catch (error) {
        console.log('Failed to remove service file:', error.message);
      }
      
      // Remove autostart desktop entry
      const desktopPath = path.join(os.homedir(), '.config', 'autostart', 'system-resilient-app.desktop');
      try {
        if (fs.existsSync(desktopPath)) {
          fs.unlinkSync(desktopPath);
          console.log('Removed autostart desktop entry');
        } else {
          console.log('No autostart desktop entry found');
        }
      } catch (error) {
        console.log('Failed to remove desktop entry:', error.message);
      }
      
      resolve();
    });
  });
}

// Run cleanup
cleanup(); 