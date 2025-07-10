const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');

class SystemResilientApp {
  constructor() {
    this.mainWindow = null;
    this.isQuitting = false;
    this.restartMechanismSetup = false;
    this.platform = os.platform();
    this.isDev = process.argv.includes('--dev');
    
    this.setupApp();
  }

  setupApp() {
    // Handle single instance
    const gotTheLock = app.requestSingleInstanceLock();
    
    if (!gotTheLock) {
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      this.createWindow();
      this.setupRestartMechanism();
      this.setupIPC();
    });

    app.on('window-all-closed', () => {
      // On macOS, keep app running even when all windows are closed
      if (process.platform !== 'darwin') {
        if (!this.isQuitting) {
          // On Windows/Linux, recreate window immediately
          setTimeout(() => {
            this.createWindow();
          }, 1000);
        }
      }
      // On macOS, app stays running in dock
    });

    app.on('activate', () => {
      // On macOS, re-create window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      } else if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Show existing window if it's hidden
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    // Handle app quit attempts
    app.on('before-quit', (event) => {
      if (!this.isQuitting) {
        console.log('App quit prevented - resilience mode active');
        event.preventDefault();
        
        // Hide window instead of quitting
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.hide();
        }
        
        // On non-macOS systems, recreate window after a delay
        if (process.platform !== 'darwin') {
          setTimeout(() => {
            this.createWindow();
          }, 2000);
        }
      }
    });

    // Handle crash recovery
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.restartApp();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.restartApp();
    });
  }

  createWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show();
      this.mainWindow.focus();
      return;
    }

    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: this.getAppIcon()
    });

    this.mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Handle window close button
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        console.log('Window close prevented - resilience mode active');
        event.preventDefault();
        
        if (process.platform === 'darwin') {
          // On macOS, hide window (app stays in dock)
          this.mainWindow.hide();
        } else {
          // On Windows/Linux, hide and recreate after delay
          this.mainWindow.hide();
          setTimeout(() => {
            if (!this.isQuitting) {
              this.createWindow();
            }
          }, 2000);
        }
      }
    });

    // Handle window destruction
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      if (!this.isQuitting) {
        console.log('Window was destroyed - recreating...');
        setTimeout(() => {
          this.createWindow();
        }, 1000);
      }
    });

    // Add resilience notification
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // Show resilience status in dev mode
      if (this.isDev) {
        console.log('🛡️ Resilience mode: Active');
        console.log('💡 To truly quit: Use Force Quit button or kill process');
      }
    });

    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
    }
  }

  getAppIcon() {
    const iconPath = path.join(__dirname, 'assets', 'icon');
    if (this.platform === 'win32') {
      return iconPath + '.ico';
    } else if (this.platform === 'darwin') {
      return iconPath + '.icns';
    } else {
      return iconPath + '.png';
    }
  }

  async setupRestartMechanism() {
    if (this.restartMechanismSetup) return;
    
    try {
      switch (this.platform) {
        case 'win32':
          await this.setupWindowsRestart();
          break;
        case 'darwin':
          await this.setupMacOSRestart();
          break;
        case 'linux':
          await this.setupLinuxRestart();
          break;
      }
      this.restartMechanismSetup = true;
    } catch (error) {
      console.error('Failed to setup restart mechanism:', error);
    }
  }

  async setupWindowsRestart() {
    const appPath = process.execPath;
    const taskName = 'SystemResilientApp';
    
    // Create a batch script that checks if app is running and starts it if not
    const batchScript = `
@echo off
:loop
tasklist /FI "IMAGENAME eq ${path.basename(appPath)}" 2>NUL | find /I /N "${path.basename(appPath)}">NUL
if "%ERRORLEVEL%"=="0" (
  timeout /t 5 /nobreak >nul
  goto loop
) else (
  start "" "${appPath}"
  timeout /t 5 /nobreak >nul
  goto loop
)
`;

    const scriptPath = path.join(os.tmpdir(), 'restart_app.bat');
    fs.writeFileSync(scriptPath, batchScript);

    // Create scheduled task
    const taskCmd = `schtasks /create /tn "${taskName}" /tr "${scriptPath}" /sc onstart /ru SYSTEM /f`;
    
    exec(taskCmd, (error) => {
      if (error) {
        console.error('Failed to create Windows scheduled task:', error);
        // Fallback: use registry startup
        this.setupWindowsRegistryStartup();
      }
    });
  }

  setupWindowsRegistryStartup() {
    const appPath = process.execPath;
    const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "SystemResilientApp" /t REG_SZ /d "${appPath}" /f`;
    
    exec(regCmd, (error) => {
      if (error) {
        console.error('Failed to add to Windows registry:', error);
      }
    });
  }

  async setupMacOSRestart() {
    const appPath = process.execPath;
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.example.systemresilientapp</string>
    <key>ProgramArguments</key>
    <array>
        <string>${appPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/tmp/systemresilientapp.err</string>
    <key>StandardOutPath</key>
    <string>/tmp/systemresilientapp.out</string>
</dict>
</plist>`;

    const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plistPath = path.join(launchAgentsDir, 'com.example.systemresilientapp.plist');

    try {
      if (!fs.existsSync(launchAgentsDir)) {
        fs.mkdirSync(launchAgentsDir, { recursive: true });
      }
      
      fs.writeFileSync(plistPath, plistContent);
      
      // Load the launch agent
      exec(`launchctl load ${plistPath}`, (error) => {
        if (error) {
          console.error('Failed to load macOS launch agent:', error);
        }
      });
    } catch (error) {
      console.error('Failed to setup macOS restart mechanism:', error);
    }
  }

  async setupLinuxRestart() {
    const appPath = process.execPath;
    const serviceName = 'system-resilient-app';
    
    // Create systemd user service
    const serviceContent = `[Unit]
Description=System Resilient App
After=graphical-session.target

[Service]
Type=simple
ExecStart=${appPath}
Restart=always
RestartSec=5
Environment=DISPLAY=:0

[Install]
WantedBy=default.target`;

    const systemdDir = path.join(os.homedir(), '.config', 'systemd', 'user');
    const servicePath = path.join(systemdDir, `${serviceName}.service`);

    try {
      if (!fs.existsSync(systemdDir)) {
        fs.mkdirSync(systemdDir, { recursive: true });
      }
      
      fs.writeFileSync(servicePath, serviceContent);
      
      // Enable and start the service
      exec(`systemctl --user daemon-reload && systemctl --user enable ${serviceName} && systemctl --user start ${serviceName}`, (error) => {
        if (error) {
          console.error('Failed to setup Linux systemd service:', error);
          // Fallback to autostart desktop entry
          this.setupLinuxAutostart();
        }
      });
    } catch (error) {
      console.error('Failed to setup Linux restart mechanism:', error);
      this.setupLinuxAutostart();
    }
  }

  setupLinuxAutostart() {
    const appPath = process.execPath;
    const desktopEntry = `[Desktop Entry]
Type=Application
Name=System Resilient App
Exec=${appPath}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true`;

    const autostartDir = path.join(os.homedir(), '.config', 'autostart');
    const desktopPath = path.join(autostartDir, 'system-resilient-app.desktop');

    try {
      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true });
      }
      
      fs.writeFileSync(desktopPath, desktopEntry);
    } catch (error) {
      console.error('Failed to setup Linux autostart:', error);
    }
  }

  setupIPC() {
    ipcMain.handle('start-heavy-task', async () => {
      return new Promise((resolve) => {
        // Start CPU-intensive task in a separate process
        const worker = spawn(process.execPath, [path.join(__dirname, 'worker.js')], {
          stdio: 'pipe'
        });

        worker.on('close', (code) => {
          resolve({ success: true, code });
        });

        worker.on('error', (error) => {
          resolve({ success: false, error: error.message });
        });
      });
    });

    ipcMain.handle('get-platform', () => {
      return this.platform;
    });

    ipcMain.handle('force-quit', () => {
      this.isQuitting = true;
      app.quit();
    });
  }

  restartApp() {
    setTimeout(() => {
      app.relaunch();
      this.isQuitting = true;
      app.exit(0);
    }, 1000);
  }
}

new SystemResilientApp(); 