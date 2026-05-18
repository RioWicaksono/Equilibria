@echo off
REM Quick test runner untuk Windows - pakai CMD bukan PowerShell
REM Set JAVA_HOME ke JDK 21 dan jalankan tests

echo Setting JAVA_HOME...
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo.
echo Java version:
java -version 2>&1 | findstr /i "version"
echo.

echo Starting emulator...
start /B "firebase-emulator" cmd /c "npx firebase-tools emulators:start --only firestore --project demo-test --quiet"

echo Waiting 15 seconds for emulator...
timeout /t 15 /nobreak

echo Checking if emulator is running...
curl -s http://127.0.0.1:8080 > nul 2>&1 && echo Emulator ready! || echo Emulator may not be ready yet.

echo Running tests...
node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit

echo.
echo Cleaning up...
taskkill /F /IM java.exe /T 2>nul
firebase emulators:stop 2>nul