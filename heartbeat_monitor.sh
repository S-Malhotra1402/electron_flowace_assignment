#!/bin/bash

# Heartbeat-based System Resilient App Monitor
# Uses file-based heartbeat to avoid process scanning redirection issues

APP_DIR="/Users/shubhammalhotra/Code/electron_flowace_assignment"
ELECTRON_PATH="$APP_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
MAIN_JS="$APP_DIR/src/main.js"
HEARTBEAT_FILE="/tmp/resilient_app_heartbeat"
QUIT_SIGNAL="/tmp/intentional_quit.signal"

echo "Starting Heartbeat-based App Monitor"
echo "App Directory: $APP_DIR"
echo "Electron Path: $ELECTRON_PATH"
echo "Main JS: $MAIN_JS"
echo "Heartbeat File: $HEARTBEAT_FILE"
echo "Check interval: 0.5 seconds (lightning-fast crash detection)"
echo ""

# Function to start app silently
start_app() {
    echo "Starting app silently..."
    cd "$APP_DIR"
    
    # Start app with maximum background flags to prevent any UI interaction
    nohup "$ELECTRON_PATH" "$MAIN_JS" \
        --no-sandbox \
        --disable-gpu \
        --disable-software-rasterizer \
        --disable-dev-shm-usage \
        --disable-background-timer-throttling \
        --disable-backgrounding-occluded-windows \
        --disable-renderer-backgrounding \
        --disable-features=TranslateUI,VizDisplayCompositor \
        --disable-default-apps \
        --disable-extensions \
        --disable-sync \
        --no-first-run \
        --no-default-browser-check \
        --silent \
        --background \
        --app-auto-launch-at-login=false \
        --disable-background-mode \
        > /tmp/resilient_app.log 2>&1 &
    
    local APP_PID=$!
    echo "App started with PID: $APP_PID (silent background mode)"
}

# Main monitoring loop
while true; do
    echo "Checking heartbeat... $(date '+%H:%M:%S')"
    
    # Check if this was an intentional quit
    if [ -f "$QUIT_SIGNAL" ]; then
        echo "Intentional quit detected - stopping monitor"
        echo "To restart monitoring: rm $QUIT_SIGNAL"
        exit 0
    fi
    
    # Check heartbeat age (app should update this file every 30 seconds)
    if [ -f "$HEARTBEAT_FILE" ]; then
        # Get file modification time in seconds since epoch
        if command -v stat >/dev/null 2>&1; then
            # macOS stat command
            HEARTBEAT_TIME=$(stat -f %m "$HEARTBEAT_FILE" 2>/dev/null || echo 0)
        else
            # Fallback
            HEARTBEAT_TIME=0
        fi
        
        CURRENT_TIME=$(date +%s)
        TIME_DIFF=$((CURRENT_TIME - HEARTBEAT_TIME))
        
        if [ $TIME_DIFF -lt 2 ]; then
            echo "App is alive (heartbeat $TIME_DIFF seconds ago)"
        else
            echo "Heartbeat stale ($TIME_DIFF seconds) - app may be dead"
            start_app
        fi
    else
        echo "No heartbeat file - starting app"
        start_app
    fi
    
    # Wait 0.5 seconds before next check (lightning-fast response to crashes)
    echo "Waiting 0.5 seconds..."
    sleep 0.5
done 