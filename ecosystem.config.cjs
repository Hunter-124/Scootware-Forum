module.exports = {
  apps: [{
    name: 'scootware-api',
    script: '/home/admin/Scootware-Forum/boot.mjs',
    cwd: '/home/admin/Scootware-Forum',
    env: {
      FORUM_DIST_PATH: '/home/admin/Scootware-Forum/artifacts/forum/dist/public',
      NODE_ENV: 'production',
      PORT: '3000'
    },
    node_args: '--enable-source-maps'
  }]
}
