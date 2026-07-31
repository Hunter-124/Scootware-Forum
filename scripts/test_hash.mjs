import bcrypt from 'bcryptjs';

const hash = '$2a$12$WQjhMhiu4blIVAnZx1bYZu8N8zb8zXdW1sFGuJDU9zZ4jHH8Xcxcu';
const password = 'localadmin123';

bcrypt.compare(password, hash).then(match => {
  console.log('Hash matches password:', match);
  if (!match) {
    console.log('\nHash is INCORRECT. Generating correct hash...');
    return bcrypt.hash(password, 12);
  }
}).then(correctHash => {
  if (correctHash) {
    console.log('Correct hash would be:', correctHash);
  }
}).catch(e => console.error('Error:', e));
