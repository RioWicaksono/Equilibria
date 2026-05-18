#!/usr/bin/env node
/**
 * Test runner for Equilibria - Unit Tests Only
 * Runs domain tests without requiring Firestore emulator
 */
import { spawn } from 'node:child_process';

const JDK21_PATH = 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.9.10-hotspot';

async function main() {
  console.log('=== Equilibria Test Runner (Unit Tests) ===\n');

  // Set up environment
  const testEnv = {
    ...process.env,
    JAVA_HOME: JDK21_PATH,
  };

  console.log('Running domain unit tests...\n');

  // Run only unit tests (domain tests) - exclude firestore rules tests
  const jest = spawn('node', [
    '--experimental-vm-modules',
    'node_modules/jest/bin/jest.js',
    '--testPathPattern=domain',
    '--forceExit',
    '--testTimeout=30000'
  ], {
    env: testEnv,
    shell: true,
    stdio: 'inherit'
  });

  jest.on('close', (code) => {
    console.log('\n\nUnit tests completed with exit code:', code);
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});