module.exports = {
  apps: [{
    name: 'scootware-api',
    script: '/home/admin/Scootware-Forum/boot.mjs',
    cwd: '/home/admin/Scootware-Forum',
    env: {
      FORUM_DIST_PATH: '/home/admin/Scootware-Forum/artifacts/forum/dist/public',
      NODE_ENV: 'production',
      PORT: '3000',
      DATABASE_URL: process.env.DATABASE_URL
    },
    node_args: '--enable-source-maps'
  }]
}
