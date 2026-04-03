# Database Credentials

Here is an auto-generated secure password for your PostgreSQL database:

**Password**: `[POSTGRES_PASSWORD]`

### How to set this password on your VPS

If you have never set a database password, you will need to open the Postgres shell on your VPS to assign this password to your user (typically `postgres` or `admin`).

1. Log into your VPS SSH console.
2. Open the postgres shell by running:
   ```bash
   sudo -u postgres psql
   ```
3. Run the following command inside `psql` to update the password for the `postgres` user:
   ```sql
   ALTER USER postgres WITH PASSWORD '[POSTGRES_PASSWORD]';
   ```
4. Type `\q` to exit the postgres shell.

### Update your `.env`

Now, you can update your `.env` file on your VPS (`/home/admin/Scootware-Forum/.env`) to use this generated password:

```env
DATABASE_URL="postgresql://postgres:[POSTGRES_PASSWORD]@127.0.0.1:5432/scootware"
```

*(If you created a different PostgreSQL database username or database name, be sure to swap `postgres` and `scootware` with those names!)*
