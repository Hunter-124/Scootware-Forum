import bcrypt from 'bcryptjs';

async function generateHashes() {
  const password1 = 'localadmin123';
  const password2 = 'testuser123';
  
  const hash1 = await bcrypt.hash(password1, 12);
  const hash2 = await bcrypt.hash(password2, 12);
  
  console.log('localadmin123 hash:', hash1);
  console.log('testuser123 hash:', hash2);
}

generateHashes();
