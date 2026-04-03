import pg from "pg";

const pool = new pg.Pool({
  connectionString: "postgres://scootadmin:${POSTGRES_PASSWORD}@localhost:5432/scootware"
});

async function main() {
  try {
    const res = await pool.query(
      `UPDATE users SET role = 'admin' WHERE username = $1 RETURNING username, role;`,
      ['[TEST_USERNAME]']
    );
    if (res.rows.length > 0) {
      console.log('Successfully updated user:', res.rows[0]);
    } else {
      console.log('User not found.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
