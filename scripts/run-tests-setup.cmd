@echo off
REM Setup script to run tests with correct JDK 21
REM Usage: run-tests-setup.cmd

echo Setting up Java environment...

REM Set JAVA_HOME to JDK 21
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM Verify Java version
echo Using Java:
java -version 2>&1 | findstr /i "version"

echo.
echo Starting tests...
echo.

REM Run the tests
node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit
