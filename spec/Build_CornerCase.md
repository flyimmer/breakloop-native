# Build CornerCase
## Metro connection problem

Found the issue — it's a Metro connection problem, not a code bug.

The app is trying to download the bundle from 192.168.178.41:8081 (your LAN IP) instead of 10.0.2.2:8081 (which is the emulator's alias for localhost). The download fails with ProtocolException.

Fix: Run this to redirect the emulator's port:

adb reverse tcp:8081 tcp:8081
Then force-stop and reopen the app. This tells the emulator to forward port 8081 to your host machine's localhost where Metro is running.

Tap "http://10.0.2.2:8081" at the top under "DEVELOPMENT SERVERS" — that's the one that will work through the adb reverse we just set up. Don't tap the 192.168.178.41 one at the bottom (that was the old LAN address that was failing).