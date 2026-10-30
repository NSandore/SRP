module.exports = {
  apps: [
    {
      name: 'srp-api-dev',
      script: '/home/nick/services/srp-server/srp/deploy/run-api.sh',
      args: 'development',
      interpreter: '/usr/bin/bash',
      cwd: '/home/nick/services/srp-server/srp',
      autorestart: true,
      watch: false,
      env: {
        SRP_DEV_ENV_FILE: '/home/nick/.config/srp/development.env',
        SRP_DEV_API_LISTEN: '127.0.0.1:3004',
      },
    },
    {
      name: 'srp-api-production',
      script: '/home/nick/services/srp-server/srp/deploy/run-api.sh',
      args: 'production',
      interpreter: '/usr/bin/bash',
      cwd: '/home/nick/.local/share/srp-deployment',
      autorestart: true,
      watch: false,
      env: {
        SRP_PRODUCTION_CURRENT: '/home/nick/.local/share/srp-deployment/current',
        SRP_PRODUCTION_ENV_FILE: '/home/nick/.config/srp/production.env',
        SRP_PRODUCTION_API_LISTEN: '127.0.0.1:3003',
      },
    },
  ],
};
