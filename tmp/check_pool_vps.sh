#!/bin/bash
cd /home/admin/Scootware-Forum
node -e "
const dbModule = require('./lib/db/dist/index.js');
const pool = dbModule.pool;
if (!pool) {
  console.log('Pool is null');
} else {
  console.log('Pool constructor:', pool.constructor.name);
  console.log('Has query:', typeof pool.query);
  console.log('Has end:', typeof pool.end);
}
"
