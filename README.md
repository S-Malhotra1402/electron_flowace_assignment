# System Resilient App

A cross-platform Electron desktop application that demonstrates system resilience through intelligent auto-restart capabilities and non-blocking background processing.

## Features

### Intelligent Auto-Restart System
- **Smart restart logic**: Uses exit codes to distinguish between manual exits and crashes
- **Activity Monitor resilience**: Automatically restarts with UI when force-killed
- **LaunchAgent integration**: Native macOS system-level process management
- **Crash recovery**: Automatic restart on unexpected termination
- **Throttle protection**: 5-second delay between restart attempts prevents rapid cycling
- **Cross-platform support**: Works on Windows 10+, macOS 10.10+, and Ubuntu/Debian Linux

### Non-Blocking Background Processing
- **CPU-intensive tasks**: Runs heavy computations without blocking UI
- **Live UI updates**: Clock and animations continue running during background tasks
- **Responsive interactions**: Window dragging, button clicks remain instant
- **Multi-threaded processing**: Background tasks run in separate processes

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation & Running

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/S-Malhotra1402/electron_flowace_assignment.git
   cd system-resilient-app
   npm install
   ```

2. **Development mode:**
   ```bash
   npm run dev
   ```

3. **Production mode:**
   ```bash
   npm start
   ```

4. **Build distributables:**
   ```bash
   npm run build
   ```

## Platform-Specific Implementation

### macOS (Recommended Platform)

**How it works:**
- Creates a LaunchAgent plist file in `~/Library/LaunchAgents/`
- Uses intelligent exit code pattern for restart control
- **Exit Code 0**: Force Quit button - no restart
- **Exit Code 1**: External kills (Activity Monitor) - automatic restart with UI
- Enhanced KeepAlive configuration: `SuccessfulExit: false`
- 5-second throttle interval between restart attempts

**LaunchAgent Configuration:**
```xml
<key>KeepAlive</key>
<dict>
    <key>SuccessfulExit</key>
    <false/>           <!-- Only restart on non-zero exit codes -->
</dict>
<key>ThrottleInterval</key>
<integer>5</integer>   <!-- 5-second restart delay -->
```

**Testing Auto-Restart:**
1. **Activity Monitor Force Kill:**
   - Open Activity Monitor (Cmd+Space → "Activity Monitor")
   - Find "System Resilient App"
   - Click Force Quit
   - App restarts automatically with UI visible

2. **Terminal Force Kill:**
   ```bash
   pkill -f "System Resilient App"
   # App restarts automatically within 5 seconds
   ```

3. **Show UI manually (if needed):**
   ```bash
   kill -SIGUSR1 [PID]
   # Triggers UI display for headless instances
   ```

**Verify LaunchAgent Status:**
```bash
launchctl list | grep systemresilientapp
```

**Cleanup (if needed):**
```bash
npm run cleanup
```

### Windows 10+

**How it works:**
- Creates a Windows Scheduled Task that monitors the application
- Falls back to Registry startup entry if scheduled task fails
- Uses `tasklist` command to check if app is running
- Automatic restart on process termination

**Testing:**
1. Run the app once to set up the restart mechanism
2. Kill the app using Task Manager
3. App should restart automatically within 5 seconds

**Cleanup:**
```cmd
schtasks /delete /tn "SystemResilientApp" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "SystemResilientApp" /f
```

### Linux (Ubuntu/Debian)

**How it works:**
- Creates a systemd user service in `~/.config/systemd/user/`
- Falls back to autostart desktop entry if systemd fails
- `Restart=always` ensures automatic restart on failure

**Testing:**
1. Run the app to create the service
2. Kill the app using `pkill` or system monitor
3. Check status: `systemctl --user status system-resilient-app`

**Cleanup:**
```bash
systemctl --user stop system-resilient-app
systemctl --user disable system-resilient-app
rm ~/.config/systemd/user/system-resilient-app.service
```

## Technical Architecture

### Exit Code Pattern Implementation

The app uses a sophisticated exit code pattern to communicate with the LaunchAgent:

```javascript
// Manual quit (Force Quit button)
app.on('before-quit', (event) => {
  if (this.isQuitting) {
    this.isManualQuit = true; // Will exit with code 0
    return;
  }
  event.preventDefault(); // Prevent all other quit attempts
});

// Exit code control
app.on('will-quit', (event) => {
  if (this.isManualQuit) {
    process.exit(0); // No restart
  } else {
    process.exit(1); // Restart required
  }
});
```

### Behavior Matrix

| Action | Exit Code | LaunchAgent Response | UI State |
|--------|-----------|---------------------|----------|
| Force Quit Button | 0 (success) | No restart | App exits |
| Activity Monitor Kill | 1 (failure) | Auto-restart | UI shows automatically |
| Ctrl+C/Cmd+Q | Prevented | Stay alive | Window hides |
| App crash | 1 (failure) | Auto-restart | UI shows automatically |

### Background Task Processing

Background tasks are handled through:

1. **Separate Process**: Heavy tasks run in `worker.js` as a child process
2. **IPC Communication**: Main process communicates with worker via spawn
3. **Non-blocking Operations**: Main thread remains free for UI updates
4. **Async/Await Pattern**: Proper handling of long-running operations

### Background Task Components

The heavy task includes four CPU-intensive operations:

1. **Prime Number Generation**: Calculates 10,000 large prime numbers
2. **File I/O**: Generates a 500MB random data file
3. **JSON Processing**: Creates and processes 500,000 JSON records
4. **Mathematical Operations**: Matrix multiplication, Fibonacci calculations

Total execution time: 30-45 seconds (varies by system performance)

## User Interface

### Interactive Elements
- **Digital Clock**: Updates every second with current time
- **Animated Dots**: Pulsing animation demonstrating UI responsiveness
- **3D Tilt Effects**: Mouse movement creates interactive visual effects
- **Status Indicators**: Real-time feedback on background task progress

### Controls
- **Start Heavy Task**: Launches CPU-intensive background process
- **Force Quit**: Properly terminates application without restart

## Recent Updates (v1.0.0)

### Architecture Improvements
- **Simplified quit handling**: Replaced complex logic with clean exit code pattern
- **Removed obsolete monitoring**: Eliminated redundant signal file monitoring
- **Cleaner LaunchAgent**: Updated to use `SuccessfulExit: false` configuration
- **Auto-UI restart**: Activity Monitor kills now automatically show UI after restart

### Files Removed
- `resilient_wrapper.sh` - Obsolete wrapper script
- `show_ui.js` - Replaced by built-in SIGUSR1 signal handling
- Signal file monitoring - Replaced by direct signal handling
- Undefined variable references - Fixed `isMonitorRestart` issues

### Code Cleanup
- Removed redundant monitoring mechanisms
- Simplified quit prevention logic
- Updated npm scripts to remove obsolete commands
- Cleaned up temporary files and logs

## Performance & Security

### Resource Management
- **Memory Usage**: Typical usage under 100MB
- **CPU Efficiency**: Heavy tasks utilize available cores efficiently
- **Process Isolation**: Background tasks run in separate processes
- **Cleanup**: Automatic cleanup of temporary files

### Security Features
- **Sandboxed preload**: Secure communication between UI and main process
- **Process separation**: Heavy tasks isolated from main UI thread
- **Error boundaries**: Comprehensive error handling prevents crashes
- **User control**: Force quit always available

## Troubleshooting

### Common Issues

**App doesn't restart after Activity Monitor kill:**
- Verify LaunchAgent is loaded: `launchctl list | grep systemresilientapp`
- Check logs: `tail -f /tmp/resilient_app.log`
- Wait 5-10 seconds for throttling delay

**Force Quit button doesn't work:**
- Check console for error messages
- Verify UI is properly loaded
- Use Activity Monitor as alternative

**Background task not starting:**
- Ensure `worker.js` exists in `src/` directory
- Check DevTools console for spawn errors
- Verify Node.js executable path

### Debug Information

**Enable development mode:**
```bash
npm run dev
```

**Check LaunchAgent logs:**
```bash
tail -f /tmp/resilient_app.log
tail -f /tmp/resilient_app_error.log
```

**Expected console output:**
```
Launch Agent enabled — app will restart if crashed/killed
App restarted after being killed - showing UI automatically
Force quit initiated via UI button - ONLY way to exit app
```

## Testing Scenarios

### Auto-Restart Testing
1. **Activity Monitor Kill**: Should restart with UI visible
2. **Terminal Kill**: `kill -9 [PID]` should restart automatically
3. **Force Quit Button**: Should exit without restart
4. **Ctrl+C/Cmd+Q**: Should hide window, stay alive

### UI Responsiveness Testing
1. Start heavy task, verify UI animations continue
2. Move mouse around during background processing
3. Test window dragging and resizing
4. Verify clock updates throughout

### System Integration Testing
1. Restart computer, verify app auto-starts
2. Test multiple force kills in succession
3. Verify LaunchAgent persistence across sessions

## System Requirements

### Minimum Requirements
- **RAM**: 4GB (8GB recommended)
- **CPU**: Dual-core processor
- **Disk**: 100MB free space
- **OS**: Windows 10, macOS 10.10+, or Ubuntu 18.04+

### Recommended
- **RAM**: 8GB or more
- **CPU**: Quad-core processor
- **Disk**: 1GB free space for temporary files

## Project Structure

```
src/
├── main.js          # Application controller with LaunchAgent integration
├── index.html       # User interface
├── preload.js       # Secure IPC communication layer
├── worker.js        # Background task processor
└── assets/
    └── icon.png     # Application icon

~/Library/LaunchAgents/
└── com.example.systemresilientapp.plist  # macOS LaunchAgent configuration

/tmp/
├── resilient_app.log        # Application logs
└── resilient_app_error.log  # Error logs
```

## License

MIT License - Free for educational and commercial use.

## Contributing

For production deployment, consider:
- Enhanced error logging and monitoring
- Configuration file support
- Automated testing suite
- Additional platform-specific optimizations
- Performance metrics collection
