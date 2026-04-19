#!/bin/bash
echo "=== Generating correct bcrypt hash ==="
cd /home/admin/Scootware-Forum
node -e "
const bcrypt = require('./node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt/bcrypt.js');
bcrypt.hash('TestPass123!', 12, (err, hash) => {
  if (err) { console.error('Error:', err); process.exit(1); }
  console.log('HASH=' + hash);
  process.exit(0);
});
" 2>&1
