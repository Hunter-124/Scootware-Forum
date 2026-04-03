#!/usr/bin/env node
/**
 * Environment Configuration Manager
 * Helps verify the correct .env files are loaded based on NODE_ENV
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envCondition = process.env.NODE_ENV || 'development';

console.log(`\n${'='.repeat(60)}`);
console.log('  Environment Configuration Check');
console.log(`${'='.repeat(60)}\n`);

console.log(`📋 Current NODE_ENV: ${envCondition}`);

// Check which env files exist
const envLocal = path.join(__dirname, '.env.local');
const envProd = path.join(__dirname, '.env.production');
const envBase = path.join(__dirname, '.env');

const files = {
  '.env': fs.existsSync(envBase),
  '.env.local': fs.existsSync(envLocal),
  '.env.production': fs.existsSync(envProd),
};

console.log('\n📁 Environment Files:');
Object.entries(files).forEach(([file, exists]) => {
  const status = exists ? '✅' : '❌';
  console.log(`   ${status} ${file}`);
});

// Determine which files will be loaded
let loadOrder = ['.env'];
if (envCondition === 'development' || envCondition === 'local') {
  loadOrder.push('.env.local');
} else if (envCondition === 'production') {
  loadOrder.push('.env.production');
}

console.log(`\n🔄 Load Order for NODE_ENV="${envCondition}":`);
loadOrder.forEach((file, i) => {
  const exists = files[file];
  const status = exists ? '✅ Will load' : '⚠️  Missing!';
  console.log(`   ${i + 1}. ${file} ${status}`);
});

// Check DATABASE_URL
console.log('\n🗄️  Database Configuration:');

if (envCondition === 'development' || envCondition === 'local') {
  console.log('   Mode: LOCAL DEVELOPMENT');
  console.log('   Database: PGlite (in-memory)');
  console.log('   DATABASE_URL: Should be commented out');
  
  if (files['.env.local']) {
    const content = fs.readFileSync(envLocal, 'utf8');
    const hasDatabaseUrl = content.match(/^DATABASE_URL=/m);
    if (!hasDatabaseUrl) {
      console.log('   ✅ DATABASE_URL is commented out (correct!)');
    } else {
      console.log('   ⚠️  DATABASE_URL is set (may override PGlite!)');
    }
  }
} else if (envCondition === 'production') {
  console.log('   Mode: PRODUCTION (VPS)');
  console.log('   Database: PostgreSQL on [VPS_IP]');
  console.log('   DATABASE_URL: Should point to VPS');
  
  if (files['.env.production']) {
    const content = fs.readFileSync(envProd, 'utf8');
    const dbUrlMatch = content.match(/^DATABASE_URL=(.+)$/m);
    if (dbUrlMatch) {
      const url = dbUrlMatch[1];
      if (url.includes('[VPS_IP]')) {
        console.log('   ✅ DATABASE_URL points to VPS (correct!)');
      } else {
        console.log(`   ⚠️  DATABASE_URL does not point to VPS: ${url}`);
      }
    } else {
      console.log('   ⚠️  DATABASE_URL not found in .env.production!');
    }
  }
}

console.log(`\n${'='.repeat(60)}\n`);

// Exit with error if critical files missing
let hasErrors = false;
Object.entries(files).forEach(([file, exists]) => {
  if (!exists && (file === '.env' || file === '.env.local' || file === '.env.production')) {
    hasErrors = true;
  }
});

if (hasErrors) {
  console.log('❌ Missing critical environment files!');
  console.log('   Run: npm run setup:env');
  process.exit(1);
} else {
  console.log('✅ Environment configuration looks good!');
  process.exit(0);
}
