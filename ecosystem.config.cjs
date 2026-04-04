module.exports = {
  apps: [{
    name: 'scootware-api',
    script: '/home/admin/Scootware-Forum/boot.mjs',
    cwd: '/home/admin/Scootware-Forum',
    env: {
      FORUM_DIST_PATH: '/home/admin/Scootware-Forum/artifacts/forum/dist/public',
      NODE_ENV: 'production',
      PORT: '3000',
      DATABASE_URL: 'postgresql://postgres:[POSTGRES_PASSWORD]@127.0.0.1:5432/scootware'
    },
    node_args: '--enable-source-maps'
  }]
}
