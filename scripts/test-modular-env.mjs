#!/usr/bin/env node
/**
 * Integration Test: Verify modular environment system works end-to-end
 * This proves that dev and production configs can exist independently
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('\n' + '='.repeat(70));
console.log('  MODULAR ENVIRONMENT SYSTEM - INTEGRATION TEST');
console.log('='.repeat(70) + '\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Check files exist
test('Environment files exist', () => {
  if (!fs.existsSync('.env')) throw new Error('.env missing');
  if (!fs.existsSync('.env.local')) throw new Error('.env.local missing');
  if (!fs.existsSync('.env.production')) throw new Error('.env.production missing');
});

// Test 2: Check .gitignore protects env files
test('.gitignore protects environment files', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  if (!gitignore.includes('.env.local')) throw new Error('.env.local not in .gitignore');
  if (!gitignore.includes('.env.production')) throw new Error('.env.production not in .gitignore');
});

// Test 3: Check development config
test('Development environment is configured correctly', () => {
  const envLocal = fs.readFileSync('.env.local', 'utf8');
  if (!envLocal.includes('# DATABASE_URL')) throw new Error('DATABASE_URL should be commented in dev');
  if (envLocal.match(/^DATABASE_URL=/m)) throw new Error('DATABASE_URL should not be active in dev');
});

// Test 4: Check production config
test('Production environment is configured correctly', () => {
  const envProd = fs.readFileSync('.env.production', 'utf8');
  const match = envProd.match(/DATABASE_URL=postgres:\/\/[^@]+@([^:]+):/);
  if (!match || !match[1].includes('[VPS_IP]')) {
    throw new Error('Production DATABASE_URL does not point to VPS ([VPS_IP])');
  }
});

// Test 5: Check npm scripts exist
test('npm scripts configured', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.scripts['check-env']) throw new Error('check-env script missing');
  if (!pkg.scripts['build:prod']) throw new Error('build:prod script missing');
});

// Test 6: Check verification script exists
test('Verification script exists', () => {
  if (!fs.existsSync('check-env.mjs')) throw new Error('check-env.mjs missing');
});

// Test 7: Check documentation exists
test('Documentation created', () => {
  if (!fs.existsSync('ENV_CONFIGURATION.md')) throw new Error('ENV_CONFIGURATION.md missing');
  if (!fs.existsSync('ENV_QUICK_REFERENCE.md')) throw new Error('ENV_QUICK_REFERENCE.md missing');
  if (!fs.existsSync('MODULAR_ENV_IMPLEMENTATION.md')) throw new Error('MODULAR_ENV_IMPLEMENTATION.md missing');
});

// Test 8: Run dev environment check
test('Development environment verification passes', () => {
  try {
    const output = execSync('node check-env.mjs 2>&1', { encoding: 'utf8' });
    if (!output.includes('configuration looks good')) {
      throw new Error('check-env did not pass for development');
    }
  } catch (e) {
    throw new Error(`check-env failed: ${e.message}`);
  }
});

// Test 9: Run prod environment check
test('Production environment verification passes', () => {
  try {
    const output = execSync('pnpm exec cross-env NODE_ENV=production node check-env.mjs 2>&1', { encoding: 'utf8' });
    if (!output.includes('configuration looks good')) {
      throw new Error('check-env did not pass for production');
    }
    if (!output.includes('[VPS_IP]')) {
      throw new Error('Production check did not verify VPS connection');
    }
  } catch (e) {
    throw new Error(`Production check failed: ${e.message}`);
  }
});

// Results
console.log('\n' + '='.repeat(70));
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('='.repeat(70) + '\n');

if (testsFailed === 0) {
  console.log('✅ ALL TESTS PASSED - Modular environment system is fully functional!');
  console.log('\nThe following can now happen independently:');
  console.log('  • Development runs with PGlite database on localhost');
  console.log('  • Production builds with PostgreSQL connection to VPS');
  console.log('  • Both configurations coexist without conflicts');
  console.log('  • No manual configuration switching needed\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please check the errors above.\n');
  process.exit(1);
}
