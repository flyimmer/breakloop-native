#!/bin/bash

# Phase F3.5 Testing Script
# Tests InterventionActivity launch and behavior

echo "============================================"
echo "Phase F3.5 - InterventionActivity Test"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Prerequisites:${NC}"
echo "1. Accessibility Service must be enabled:"
echo "   Settings > Accessibility > BreakLoop > Enable"
echo "2. App must be built and installed"
echo ""

# Check if device is connected
if ! adb devices | grep -q "device$"; then
    echo -e "${RED}❌ No device connected${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Device connected${NC}"
echo ""

# Function to monitor logs
monitor_logs() {
    echo -e "${YELLOW}Monitoring logs...${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    adb logcat | grep -E "ForegroundDetection|InterventionActivity" --color=auto
}

# Function to test monitored app launch
test_monitored_app() {
    local app_package=$1
    local app_name=$2
    
    echo -e "${YELLOW}Testing: $app_name ($app_package)${NC}"
    
    # Clear logcat
    adb logcat -c
    
    # Launch the app
    echo "Launching $app_name..."
    adb shell am start -n "$app_package/.MainActivity" 2>/dev/null || \
    adb shell monkey -p "$app_package" -c android.intent.category.LAUNCHER 1 2>/dev/null
    
    # Wait a moment
    sleep 2
    
    # Check logs
    echo "Checking logs..."
    local logs=$(adb logcat -d | grep -E "ForegroundDetection|InterventionActivity")
    
    if echo "$logs" | grep -q "MONITORED APP DETECTED"; then
        echo -e "${GREEN}✅ Monitored app detected${NC}"
    else
        echo -e "${RED}❌ Monitored app NOT detected${NC}"
    fi
    
    if echo "$logs" | grep -q "Launching InterventionActivity"; then
        echo -e "${GREEN}✅ InterventionActivity launched${NC}"
    else
        echo -e "${RED}❌ InterventionActivity NOT launched${NC}"
    fi
    
    if echo "$logs" | grep -q "InterventionActivity created"; then
        echo -e "${GREEN}✅ InterventionActivity created successfully${NC}"
    else
        echo -e "${RED}❌ InterventionActivity NOT created${NC}"
    fi
    
    echo ""
}

# Function to test non-monitored app
test_non_monitored_app() {
    local app_package=$1
    local app_name=$2
    
    echo -e "${YELLOW}Testing: $app_name (non-monitored)${NC}"
    
    # Clear logcat
    adb logcat -c
    
    # Launch the app
    echo "Launching $app_name..."
    adb shell am start -n "$app_package/.MainActivity" 2>/dev/null || \
    adb shell monkey -p "$app_package" -c android.intent.category.LAUNCHER 1 2>/dev/null
    
    # Wait a moment
    sleep 2
    
    # Check logs
    echo "Checking logs..."
    local logs=$(adb logcat -d | grep -E "ForegroundDetection")
    
    if echo "$logs" | grep -q "Not a monitored app, ignoring"; then
        echo -e "${GREEN}✅ Correctly ignored non-monitored app${NC}"
    else
        echo -e "${YELLOW}⚠️  Expected 'Not a monitored app' message${NC}"
    fi
    
    if echo "$logs" | grep -q "InterventionActivity"; then
        echo -e "${RED}❌ InterventionActivity should NOT launch for non-monitored app${NC}"
    else
        echo -e "${GREEN}✅ No intervention launched (correct)${NC}"
    fi
    
    echo ""
}

# Function to kill BreakLoop and test wake from killed state
test_wake_from_killed() {
    echo -e "${YELLOW}Testing: Wake from killed state${NC}"
    
    # Force stop BreakLoop
    echo "Force stopping BreakLoop..."
    adb shell am force-stop com.anonymous.breakloopnative
    sleep 1
    echo -e "${GREEN}✅ BreakLoop killed${NC}"
    
    # Clear logcat
    adb logcat -c
    
    # Launch Instagram
    echo "Launching Instagram..."
    adb shell am start -n com.instagram.android/.MainActivity 2>/dev/null || \
    adb shell monkey -p com.instagram.android -c android.intent.category.LAUNCHER 1 2>/dev/null
    
    # Wait for React Native to boot
    sleep 3
    
    # Check logs
    echo "Checking logs..."
    local logs=$(adb logcat -d | grep -E "ForegroundDetection|InterventionActivity|ReactNative")
    
    if echo "$logs" | grep -q "InterventionActivity created"; then
        echo -e "${GREEN}✅ Successfully woke from killed state${NC}"
    else
        echo -e "${RED}❌ Failed to wake from killed state${NC}"
    fi
    
    echo ""
}

# Function to check accessibility service status
check_accessibility_service() {
    echo -e "${YELLOW}Checking Accessibility Service status...${NC}"
    
    local service_status=$(adb shell settings get secure enabled_accessibility_services)
    
    if echo "$service_status" | grep -q "breakloopnative/.*ForegroundDetectionService"; then
        echo -e "${GREEN}✅ ForegroundDetectionService is enabled${NC}"
    else
        echo -e "${RED}❌ ForegroundDetectionService is NOT enabled${NC}"
        echo "   Please enable it in Settings > Accessibility > BreakLoop"
    fi
    
    echo ""
}

# Main menu
show_menu() {
    echo "============================================"
    echo "Test Options:"
    echo "============================================"
    echo "1. Check Accessibility Service status"
    echo "2. Test Instagram (monitored)"
    echo "3. Test TikTok (monitored)"
    echo "4. Test Twitter (monitored)"
    echo "5. Test Chrome (non-monitored)"
    echo "6. Test wake from killed state"
    echo "7. Monitor logs in real-time"
    echo "8. Run all tests"
    echo "9. Exit"
    echo ""
    read -p "Select option (1-9): " choice
    
    case $choice in
        1) check_accessibility_service ;;
        2) test_monitored_app "com.instagram.android" "Instagram" ;;
        3) test_monitored_app "com.zhiliaoapp.musically" "TikTok" ;;
        4) test_monitored_app "com.twitter.android" "Twitter" ;;
        5) test_non_monitored_app "com.android.chrome" "Chrome" ;;
        6) test_wake_from_killed ;;
        7) monitor_logs ;;
        8)
            echo -e "${YELLOW}Running all tests...${NC}"
            echo ""
            check_accessibility_service
            test_monitored_app "com.instagram.android" "Instagram"
            test_non_monitored_app "com.android.chrome" "Chrome"
            test_wake_from_killed
            ;;
        9) exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

# Start
check_accessibility_service
show_menu

