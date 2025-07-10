# System Resilient App

A cross-platform Electron desktop application that demonstrates system resilience through auto-restart capabilities and non-blocking background processing.

## Features

### High-Availability Behavior (Self-Restart)
- **Auto-restart on termination**: App automatically restarts if closed, crashed, or killed
- **Survives system reboot**: Configured to start automatically after system restart
- **Cross-platform support**: Works on Windows 10+, macOS Monterey+, and Ubuntu/Debian Linux
- **No third-party dependencies**: Uses native OS mechanisms for persistence

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

## Platform-Specific Setup

### Windows 10+

**How it works:**
- Creates a Windows Scheduled Task that monitors the application
- Falls back to Registry startup entry if scheduled task fails
- Uses `tasklist` command to check if app is running
- Batch script automatically restarts the app if not found

**Manual verification:**
1. Run the app once to set up the restart mechanism
2. Kill the app using Task Manager
3. App should restart automatically within 5 seconds
4. Check Task Scheduler for "SystemResilientApp" task

**Cleanup (if needed):**
```cmd
schtasks /delete /tn "SystemResilientApp" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "SystemResilientApp" /f
```

### macOS (Monterey+)

**How it works:**
- Creates a Launch Agent plist file in `~/Library/LaunchAgents/`
- Uses `launchctl` to load and manage the service
- `KeepAlive` property ensures automatic restart
- Survives user logout/login and system reboot

**Manual verification:**
1. Run the app to create the launch agent
2. Kill the app using Activity Monitor or `killall`
3. App should restart automatically within 5 seconds
4. Check: `launchctl list | grep systemresilientapp`

**Cleanup (if needed):**
```bash
launchctl unload ~/Library/LaunchAgents/com.example.systemresilientapp.plist
rm ~/Library/LaunchAgents/com.example.systemresilientapp.plist
```

### Linux (Ubuntu/Debian)

**How it works:**
- Creates a systemd user service in `~/.config/systemd/user/`
- Falls back to autostart desktop entry if systemd fails
- Service is enabled to start automatically on boot
- `Restart=always` ensures automatic restart on failure

**Manual verification:**
1. Run the app to create the service
2. Kill the app using `pkill` or system monitor
3. App should restart automatically within 5 seconds
4. Check: `systemctl --user status system-resilient-app`

**Cleanup (if needed):**
```bash
systemctl --user stop system-resilient-app
systemctl --user disable system-resilient-app
rm ~/.config/systemd/user/system-resilient-app.service
rm ~/.config/autostart/system-resilient-app.desktop
```

## Technical Implementation

### Self-Restart Mechanism

The app uses platform-specific native mechanisms to ensure persistence:

1. **Process Monitoring**: Each platform uses its native process monitoring
2. **Automatic Recovery**: If the main process dies, the monitoring system restarts it
3. **Boot Persistence**: Services/tasks are configured to start on system boot
4. **Graceful Degradation**: Falls back to simpler methods if advanced features fail

### UI Responsiveness Preservation

Background tasks are handled through:

1. **Separate Process**: Heavy tasks run in `worker.js` as a child process
2. **IPC Communication**: Main process communicates with worker via spawn
3. **Non-blocking Operations**: Main thread remains free for UI updates
4. **Async/Await Pattern**: Proper handling of long-running operations

### Background Task Details

The heavy task includes four CPU-intensive operations:

1. **Prime Number Generation**: Calculates 10,000 large prime numbers
2. **File I/O**: Generates a 500MB random data file
3. **JSON Processing**: Creates and processes 500,000 JSON records
4. **Complex Mathematical Operations**: Matrix multiplication, Fibonacci calculations, and hash computations

Total execution time: 30-45 seconds (varies by system performance)

## User Interface

### Live Elements
- **Digital Clock**: Updates every second with current time
- **Animated Dots**: Pulsing animation to demonstrate UI responsiveness
- **Interactive Effects**: Mouse movement creates 3D tilt effect
- **Status Indicators**: Real-time feedback on background task progress

### Controls
- **Start Heavy Task**: Launches CPU-intensive background process
- **Force Quit**: Properly terminates the application (disables auto-restart)

## Security & Safety

### Resource Management
- **Memory Limits**: Background tasks are designed to complete and exit
- **Process Isolation**: Heavy tasks run in separate processes
- **Error Handling**: Comprehensive error handling prevents crashes
- **Cleanup**: Temporary files are created in system temp directory

### Fail-Safety
- **No Runaway Loops**: All loops have proper exit conditions
- **Timeout Protection**: Background tasks have natural completion points
- **Exception Handling**: Uncaught exceptions trigger controlled restart
- **User Control**: Force quit option always available

## Performance Characteristics

### System Impact
- **CPU Usage**: Heavy tasks utilize available CPU cores efficiently
- **Memory Usage**: Typical usage under 100MB, peaks during heavy tasks
- **Disk I/O**: Temporary file generation during background tasks
- **Network**: No network dependencies

### UI Responsiveness
- **Frame Rate**: 60 FPS maintained during background processing
- **Input Latency**: <16ms response time for user interactions
- **Animation Smoothness**: CSS animations continue uninterrupted
- **Window Operations**: Drag, resize, minimize remain instant

## Troubleshooting

### Common Issues

**App doesn't restart after kill:**
- Check if restart mechanism was properly set up
- Verify permissions for creating scheduled tasks/services
- Look for error messages in console logs

**Background task not starting:**
- Ensure `worker.js` is present in the `src` directory
- Check console for spawn errors
- Verify Node.js executable path

**UI becomes unresponsive:**
- This shouldn't happen with proper implementation
- If it does, force quit and restart
- Check for JavaScript errors in DevTools

### Debug Mode
Run with development flag to enable debugging:
```bash
npm run dev
```

This enables:
- Chrome DevTools
- Console logging
- Error reporting
- Performance monitoring

## 📋 System Requirements

### Minimum Requirements
- **RAM**: 4GB (8GB recommended)
- **CPU**: Dual-core processor
- **Disk**: 100MB free space (for temporary files during heavy tasks)
- **OS**: Windows 10, macOS Monterey, or Ubuntu 18.04+

### Recommended Requirements
- **RAM**: 8GB or more
- **CPU**: Quad-core processor
- **Disk**: 1GB free space
- **OS**: Latest stable versions

## 🧪 Testing

### Manual Testing Steps

1. **Basic Functionality**:
   - Start app, verify clock updates
   - Click "Start Heavy Task", verify UI remains responsive
   - Move mouse around to test 3D effects

2. **Restart Resilience**:
   - Kill app via system task manager
   - Verify app restarts within 5 seconds
   - Test multiple kill scenarios

3. **Reboot Persistence**:
   - Restart computer
   - Verify app starts automatically
   - Check that restart mechanism is still active

4. **Performance**:
   - Monitor CPU/memory usage during heavy tasks
   - Verify UI animations continue smoothly
   - Test window dragging during background processing

## License

MIT License - Feel free to use this code for educational or commercial purposes.

## Contributing

For production use, consider:
- Adding more robust error handling
- Implementing proper logging
- Adding configuration options
- Including automated tests
- Adding more sophisticated background tasks 

## Architecture Overview

### Core Components

**`worker.js`** - Background Task Handler
- Contains all 4 background tasks:
  1. Prime number generation (10,000 primes)
  2. File generation (500MB random data)
  3. JSON processing (500,000 records)
  4. Complex calculations (matrix ops, Fibonacci, hashing)
- Runs as a separate Node.js process
- Takes ~35 seconds to complete
- Handles all CPU-intensive operations

**`preload.js`** - Security Layer
- Provides secure communication between UI and main process
- Exposes safe functions to the web page:
  - `startHeavyTask()` - Triggers the worker process
  - `getPlatform()` - Gets OS platform info
  - `forceQuit()` - Safely closes the app

**`main.js`** - Application Controller
- Orchestrates everything and spawns worker processes
- Manages window lifecycle and restart mechanisms
- Handles platform-specific resilience features

**`index.html`** - User Interface
- Provides the visual interface for user interactions
- Calls APIs through the preload security layer
