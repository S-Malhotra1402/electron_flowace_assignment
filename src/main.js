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
    this.isHeadlessMode = false;
    
    // Clean up any existing intentional quit signal
    this.cleanupQuitSignal();
    
    this.setupApp();
  }

  setupApp() {
    // Handle single instance
    const gotTheLock = app.requestSingleInstanceLock();
    
    if (!gotTheLock) {
      app.quit();
      return;
    }

    // Prevents multiple instances of your app from running
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
      
      // Prevent any focus stealing when in monitor restart mode
      if (process.env.MONITOR_RESTART === '1') {
        app.dock?.hide(); // Hide from dock completely
      }
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
      // Don't respond to activate events if we're in monitor restart mode
      if (process.env.MONITOR_RESTART === '1') {
        console.log(' Ignoring activate event - monitor restart mode');
        return;
      }
      
      // On macOS, re-create window when dock icon is clicked
      if (this.isHeadlessMode || BrowserWindow.getAllWindows().length === 0) {
        // Either in headless mode or no windows exist - create a new normal window
        console.log(' Creating window from headless mode');
        delete process.env.MONITOR_RESTART; // Ensure it's treated as normal startup
        this.isHeadlessMode = false;
        
        // Show dock icon again
        if (app.dock) {
          app.dock.show();
        }
        
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
    const isMonitorRestart = process.env.MONITOR_RESTART === '1';
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Only show/focus if not started by monitor
      if (!isMonitorRestart) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
      return;
    }

    // If started by monitor, don't create any window at all - pure headless mode
    if (isMonitorRestart) {
      console.log(' App restarted by monitor (pure headless mode - no window)');
      console.log(' App running in background - click dock icon to show window');
      
      // Set a flag to indicate we're in headless mode
      this.isHeadlessMode = true;
      this.mainWindow = null; // No window at all
      
      // Hide from dock to prevent any visual indication
      if (app.dock) {
        app.dock.hide();
      }
      
      return;
    }

    // Normal startup - create regular window
    this.isHeadlessMode = false;
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: this.getAppIcon(),
      show: false,
      minimizable: true,
      resizable: true
    });

    this.mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Handle normal window showing
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // Show resilience status in dev mode
      if (this.isDev) {
        console.log(' Resilience mode: Active');
        console.log(' To truly quit: Use Force Quit button or kill process');
      }
    });

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

    if (this.isDev && !isMonitorRestart) {
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
    console.log('🔄 Setting up heartbeat-based restart mechanism (no Launch Agent)');
    
    // Start heartbeat system instead of Launch Agent
    this.startHeartbeat();
    
    console.log(' Heartbeat system enabled — app will restart if crashed/killed');
  }

  startHeartbeat() {
    const heartbeatFile = '/tmp/resilient_app_heartbeat';
    
    // Update heartbeat every 1 second
    this.heartbeatInterval = setInterval(() => {
      try {
        // Write current timestamp to heartbeat file
        fs.writeFileSync(heartbeatFile, Date.now().toString());
      } catch (error) {
        console.error('Failed to write heartbeat:', error);
      }
    }, 1000); // 1 second
    
    // Write initial heartbeat
    try {
      fs.writeFileSync(heartbeatFile, Date.now().toString());
      console.log(' Heartbeat started - updating every 1 second');
    } catch (error) {
      console.error('Failed to start heartbeat:', error);
    }
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      
      // Remove heartbeat file
      try {
        const heartbeatFile = '/tmp/resilient_app_heartbeat';
        if (fs.existsSync(heartbeatFile)) {
          fs.unlinkSync(heartbeatFile);
        }
        console.log(' Heartbeat stopped');
      } catch (error) {
        console.error('Failed to stop heartbeat:', error);
      }
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
        const workerPath = path.join(__dirname, 'worker.js');
        
        // Use Electron's node executable for consistency
        const worker = spawn(process.execPath, [workerPath], {
          stdio: 'pipe',
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
        });

        worker.stdout.on('data', (data) => {
          console.log('Worker output:', data.toString());
        });

        worker.stderr.on('data', (data) => {
          console.error('Worker error:', data.toString());
        });

        worker.on('close', (code) => {
          console.log(`Worker process exited with code ${code}`);
          resolve({ success: true, code });
        });

        worker.on('error', (error) => {
          console.error('Worker spawn error:', error);
          resolve({ success: false, error: error.message });
        });
      });
    });

    ipcMain.handle('get-platform', () => {
      return this.platform;
    });

    ipcMain.handle('force-quit', () => {
      this.isQuitting = true;
      
      // Stop heartbeat system
      this.stopHeartbeat();
      
      // Create a signal file to tell the monitor this is an intentional quit
      const signalFile = '/tmp/intentional_quit.signal';
      try {
        fs.writeFileSync(signalFile, Date.now().toString());
        console.log(' Intentional quit signaled - app will not auto-restart');
      } catch (error) {
        console.error('Failed to create quit signal:', error);
      }
      
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

  cleanupQuitSignal() {
    const signalFile = '/tmp/intentional_quit.signal';
    try {
      if (fs.existsSync(signalFile)) {
        fs.unlinkSync(signalFile);
        console.log('🧹 Cleaned up previous quit signal');
      }
    } catch (error) {
      console.error('Failed to cleanup quit signal:', error);
    }
  }
}

new SystemResilientApp(); 