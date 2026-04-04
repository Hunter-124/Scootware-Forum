

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Utility to load .env files (simple parser, ignores comments and blank lines)
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    
    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // CRITICAL: Always set DATABASE_URL from .env - never let it be empty in production
    const isCriticalVar = ['DATABASE_URL', 'PG_CONNECTION_STRING'].includes(key);
    const isValidValue = value && value !== '""' && value !== "''";
    
    if (isCriticalVar && isValidValue) {
      // Critical variables: always override with non-empty values from .env
      process.env[key] = value;
    } else if (!isCriticalVar && !(key in process.env)) {
      // Non-critical variables: only set if not already present
      process.env[key] = value;
    }
  }
}


// Set production mode by default (use development only for local testing)
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Force load the main environment file (which we've linked/copied to .env or .env.production)
loadEnvFile(path.resolve(dirname, '.env'));
loadEnvFile(path.resolve(dirname, '.env.production'));

// Only load extra configs if not in production
if (process.env.NODE_ENV !== 'production') {
  const envDir = path.resolve(dirname, 'config');
  loadEnvFile(path.join(envDir, 'crypto-payments.env'));
  loadEnvFile(path.join(envDir, 'sso-and-email.env'));
}

// Set production mode by default (use development only for local testing)
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Set NODE_PATH to include project root for module resolution
process.env.NODE_PATH = dirname;

console.log('--- Boot Loader Initializing ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CWD:', process.cwd());
console.log('Boot directory:', dirname);

// Fix paths: in production, the dist folder is built and serves as root
// Set FORUM_DIST_PATH for the API to find the static files
const forumDistPath = path.resolve(dirname, 'artifacts/forum/dist/public');
const forumDistExists = fs.existsSync(forumDistPath);
console.log('Forum static files path:', forumDistPath);
console.log('Forum static files exist:', forumDistExists);

if (!forumDistExists) {
  console.warn('⚠️  WARNING: Forum dist directory not found at', forumDistPath);
  console.warn('The frontend will not be served. Check your build output.');
}

process.env.FORUM_DIST_PATH = forumDistPath;

const backendPath = path.resolve(dirname, 'artifacts/api-server/dist/index.mjs');
console.log('Loading backend from:', backendPath);

if (!fs.existsSync(backendPath)) {
  console.error('❌ ERROR: Backend bundle not found at', backendPath);
  process.exit(1);
}

// Import the main bundle (from artifacts/api-server/dist)
// This starts the server automatically via app.listen()

let backendModule;
try {
  console.log('Starting backend...');
  backendModule = await import(pathToFileURL(backendPath).href);
  console.log('✅ Backend loaded successfully');
} catch (err) {
  console.error('❌ Failed to load backend:', err);
  process.exit(1);
}

// Graceful shutdown on SIGINT/SIGTERM
const shutdown = () => {
  console.log('\nReceived shutdown signal. Closing backend...');
  // If backend exports a close method, call it (Express server)
  if (backendModule && typeof backendModule.close === 'function') {
    backendModule.close(() => {
      console.log('Backend closed. Exiting.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
