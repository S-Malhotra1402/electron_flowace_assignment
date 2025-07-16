const { app, BrowserWindow, ipcMain, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');

class SystemResilientApp {
  constructor() {
    this.mainWindow = null;
    this.isQuitting = false;
    this.isManualQuit = false; // Track manual vs external quits
    this.restartMechanismSetup = false;
    this.platform = os.platform();
    this.isDev = process.argv.includes('--dev');
    this.isHeadlessMode = false;
    this.isCreatingWindow = false;
    this.tray = null;
    
    // Log startup mode
    if (process.env.LAUNCH_AGENT_RESTART) {
      console.log('🌀 Started via LaunchAgent - headless mode');
    } else {
      console.log('🧑‍💻 Started manually - normal mode');
    }
    
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
      this.setupTray();
      this.createWindow();
      this.setupRestartMechanism();
      this.setupIPC();
      
      // Prevent any focus stealing when restarted by Launch Agent
      if (process.env.LAUNCH_AGENT_RESTART === '1') {
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
      // Don't respond to activate events if we're restarted by Launch Agent
      if (process.env.LAUNCH_AGENT_RESTART === '1') {
        console.log(' Ignoring activate event - Launch Agent restart mode');
        return;
      }
      
      // On macOS, re-create window when dock icon is clicked
      if (this.isHeadlessMode || BrowserWindow.getAllWindows().length === 0) {
        // Either in headless mode or no windows exist - create a new normal window
        console.log(' Creating window from headless mode');
        delete process.env.LAUNCH_AGENT_RESTART; // Ensure it's treated as normal startup
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
      // If Force Quit button was used, allow it
      if (this.isQuitting) {
        console.log('✅ Force Quit button used - allowing clean exit');
        this.isManualQuit = true; // Mark as manual quit
        return; // Allow quit
      }
      
      // For all other quit attempts (Cmd+Q, menu quit, etc.), prevent them
      console.log('🛡️ Quit attempt prevented - app is resilient. Use Force Quit button to exit');
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
    });

    // Handle will-quit to control LaunchAgent restart behavior via exit codes
    app.on('will-quit', (event) => {
      if (this.isManualQuit) {
        // Manual quit (Force Quit button) - exit with 0 so LaunchAgent doesn't restart
        console.log('🛑 Manual quit - LaunchAgent will NOT restart app');
        process.exit(0);
      } else {
        // External quit (Activity Monitor, crash, etc.) - exit with 1 so LaunchAgent restarts
        console.log('🔄 External quit detected - LaunchAgent will restart app');
        process.exit(1);
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

    // Handle signal to show UI
    process.on('SIGUSR1', () => {
      console.log('📱 Received signal to show UI');
      this.showUI();
    });

    // Handle SIGINT in dev mode (Ctrl+C) - but don't quit, be resilient
    process.on('SIGINT', () => {
      console.log('🛡️ Ctrl+C detected - app is resilient, staying alive. Use Force Quit button to exit.');
      // Don't quit - app should be resilient to Ctrl+C
      // Only the Force Quit button in UI should be able to exit
    });


  }

  createWindow() {
    const isLaunchAgentRestart = process.env.LAUNCH_AGENT_RESTART === '1';
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Only show/focus if not started by Launch Agent
      if (!isLaunchAgentRestart) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
      return;
    }

    // Set flag to prevent duplicate window creation
    this.isCreatingWindow = true;

    // Check if this is a restart after being killed (vs initial start)
    const wasKilledAndRestarted = this.checkIfRestartAfterKill();
    
    // If started by Launch Agent, check if we should show UI
    if (isLaunchAgentRestart) {
      if (wasKilledAndRestarted) {
        console.log('🔄 App restarted after being killed - showing UI automatically');
        // Proceed to create window normally
      } else {
        console.log(' App started by Launch Agent (pure headless mode - no window)');
        console.log(' App running in background - click dock icon to show window');
        
        // Mark that app is running (for restart detection)
        this.markAppAsRunning();
        
        // Set a flag to indicate we're in headless mode
        this.isHeadlessMode = true;
        this.mainWindow = null; // No window at all
        
        // Hide from dock to prevent any visual indication
        if (app.dock) {
          app.dock.hide();
        }
        
        // Clear the creation flag since no window is created
        this.isCreatingWindow = false;
        
        return;
      }
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
      
      // Clear the creation flag
      this.isCreatingWindow = false;
      
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
      this.isCreatingWindow = false; // Clear flag when window is destroyed
      if (!this.isQuitting) {
        console.log('Window was destroyed - recreating...');
        setTimeout(() => {
          this.createWindow();
        }, 1000);
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
    console.log('🔄 Setting up Launch Agent for system-level restart');
    
    // Optionally install to /Applications/ for production use
    // await this.installToApplications();
    
    // Create Launch Agent that monitors and restarts silently
    await this.createLaunchAgent();
    
    console.log(' Launch Agent enabled — app will restart if crashed/killed');
  }

  async createLaunchAgent() {
    // Check for app in /Applications/ first (production), then fall back to dist/ (development)
    const applicationsAppPath = '/Applications/System Resilient App.app/Contents/MacOS/System Resilient App';
    
    let appPath;
    if (fs.existsSync(applicationsAppPath)) {
      appPath = applicationsAppPath;
      console.log(`🎯 Using installed app from /Applications/`);
    } else {
      // Fall back to packaged app in dist/
      const projectRoot = path.dirname(__dirname);
      const arch = process.arch === 'arm64' ? 'mac-arm64' : 'mac';
      appPath = path.join(projectRoot, 'dist', arch, 'System Resilient App.app', 'Contents', 'MacOS', 'System Resilient App');
      
      if (!fs.existsSync(appPath)) {
        throw new Error(`Packaged app not found. Please run 'npm run build:mac' first, or install to /Applications/.`);
      }
      console.log(`🎯 Using packaged app from dist/`);
    }
    
    console.log(`📍 App path: ${appPath}`);
    
    const homedir = os.homedir();
    const launchAgentsDir = path.join(homedir, 'Library', 'LaunchAgents');
    const plistPath = path.join(launchAgentsDir, 'com.example.systemresilientapp.plist');

    // Ensure LaunchAgents directory exists
    if (!fs.existsSync(launchAgentsDir)) {
      fs.mkdirSync(launchAgentsDir, { recursive: true });
    }

    // Create LaunchAgent plist with RunAtLoad and KeepAlive
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
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
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>5</integer>

    <key>StandardOutPath</key>
    <string>/tmp/resilient_app.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/resilient_app_error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>LAUNCH_AGENT_RESTART</key>
        <string>1</string>
    </dict>
</dict>
</plist>`;

    try {
      fs.writeFileSync(plistPath, plistContent);
      console.log('✅ LaunchAgent plist created (will auto-relaunch on exit)');

      // Load the LaunchAgent into launchd
      return new Promise((resolve, reject) => {
        exec(`launchctl load "${plistPath}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('⚠️ Failed to load LaunchAgent:', error);
            reject(error);
          } else {
            console.log('✅ LaunchAgent loaded successfully');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('⚠️ Error creating LaunchAgent plist:', error);
      throw error;
    }
  }

  async installToApplications() {
    const projectRoot = path.dirname(__dirname);
    const arch = process.arch === 'arm64' ? 'mac-arm64' : 'mac';
    const sourceAppPath = path.join(projectRoot, 'dist', arch, 'System Resilient App.app');
    const targetAppPath = '/Applications/System Resilient App.app';
    
    try {
      // Check if app already exists in Applications
      if (fs.existsSync(targetAppPath)) {
        console.log('📁 App already exists in /Applications/');
        return targetAppPath;
      }
      
      // Copy the app to /Applications/
      console.log('📁 Installing app to /Applications/...');
      await new Promise((resolve, reject) => {
        exec(`cp -R "${sourceAppPath}" "/Applications/"`, (error) => {
          if (error) {
            reject(error);
          } else {
            console.log('✅ App installed to /Applications/System Resilient App.app');
            resolve();
          }
        });
      });
      
      return targetAppPath;
    } catch (error) {
      console.error('⚠️ Failed to install app to /Applications/:', error);
      throw error;
    }
  }

  unloadLaunchAgent() {
    const homedir = os.homedir();
    const plistPath = path.join(homedir, 'Library', 'LaunchAgents', 'com.example.systemresilientapp.plist');
    
    if (fs.existsSync(plistPath)) {
      exec(`launchctl unload "${plistPath}"`, (error) => {
        if (error) {
          console.error('⚠️ Failed to unload LaunchAgent:', error);
        } else {
          console.log('✅ LaunchAgent unloaded successfully');
          // Also remove the plist file
          try {
            fs.unlinkSync(plistPath);
            console.log('✅ LaunchAgent plist file removed');
          } catch (removeError) {
            console.error('⚠️ Failed to remove plist file:', removeError);
          }
        }
      });
    }
  }

  setupTray() {
    try {
      // Try different icon formats and paths
      let iconPath = path.join(__dirname, 'assets', 'icon.png');
      
      // Validate if the icon file is actually a valid image
      if (fs.existsSync(iconPath)) {
        try {
          const fileBuffer = fs.readFileSync(iconPath);
          // Check if it's actually a PNG by looking at the magic bytes
          if (fileBuffer.length < 8 || !fileBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
            console.log('⚠️ Icon file exists but is not a valid PNG');
            iconPath = null;
          }
        } catch (error) {
          console.log('⚠️ Could not validate icon file');
          iconPath = null;
        }
      }
      
      if (!iconPath || !fs.existsSync(iconPath)) {
        // Try other formats
        const alternatives = [
          path.join(__dirname, 'assets', 'icon.ico'),
          path.join(__dirname, 'assets', 'icon.icns'),
          // Fallback to a simple text-based approach for now
          null
        ];
        
        iconPath = alternatives.find(p => p && fs.existsSync(p));
        
                 if (!iconPath) {
           console.log('⚠️ No valid tray icon found');
           console.log('📍 Tray disabled - continuing without tray icon');
           return;
         }
      }

      console.log(`📍 Using tray icon: ${iconPath}`);
      this.tray = new Tray(iconPath);
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show App',
          click: () => {
            this.showUI();
          }
        },
        {
          label: 'Hide App',
          click: () => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.hide();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Force Quit',
          click: () => {
            this.isQuitting = true;
            this.isManualQuit = true; // Mark as manual quit for proper exit code
            console.log('🛑 Force quit via tray');
            app.quit();
          }
        }
      ]);

      this.tray.setToolTip('System Resilient App');
      this.tray.setContextMenu(contextMenu);
      
      // Double-click to show app
      this.tray.on('double-click', () => {
        this.showUI();
      });

      console.log('✅ Tray icon created');
    } catch (error) {
      console.error('⚠️ Failed to create tray icon:', error.message);
      console.log('📍 Continuing without tray - app functionality not affected');
    }
  }

  showUI() {
    console.log('📱 Showing UI...');
    
    // Exit headless mode
    this.isHeadlessMode = false;
    delete process.env.LAUNCH_AGENT_RESTART;
    
    // Show dock icon
    if (app.dock) {
      app.dock.show();
    }
    
    // Create or show window
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      // Prevent multiple simultaneous window creation
      if (this.isCreatingWindow) {
        console.log('⏳ Window creation already in progress...');
        return;
      }
      this.createWindow();
    } else {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
    
    console.log('✅ UI should now be visible');
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
      this.isManualQuit = true; // Mark as manual quit for proper exit code
      console.log('🛑 Force quit initiated via UI button - ONLY way to exit app');
      app.quit(); // This is the ONLY way the app should exit
    });
  }

  // Clean up running marker
  cleanupRunningMarker() {
    const runningMarker = '/tmp/resilient_app_running.marker';
    try {
      if (fs.existsSync(runningMarker)) {
        fs.unlinkSync(runningMarker);
        console.log('🧹 Cleaned up running marker');
      }
    } catch (error) {
      console.log('⚠️ Could not cleanup running marker:', error.message);
    }
  }

  restartApp() {
    setTimeout(() => {
      app.relaunch();
      this.isQuitting = true;
      app.exit(0);
    }, 1000);
  }

  // Check if this is a restart after being killed
  checkIfRestartAfterKill() {
    const runningMarker = '/tmp/resilient_app_running.marker';
    const exists = fs.existsSync(runningMarker);
    if (exists) {
      console.log('📍 Detected restart after kill - UI will be shown');
      // Clean up the marker
      try {
        fs.unlinkSync(runningMarker);
      } catch (error) {
        console.log('⚠️ Could not remove restart marker:', error.message);
      }
    }
    return exists;
  }

  // Mark that the app is currently running
  markAppAsRunning() {
    const runningMarker = '/tmp/resilient_app_running.marker';
    try {
      fs.writeFileSync(runningMarker, Date.now().toString());
    } catch (error) {
      console.log('⚠️ Could not create running marker:', error.message);
    }
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