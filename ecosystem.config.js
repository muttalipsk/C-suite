module.exports = {
  apps: [
    {
      name: 'ask-expert-node',
      script: 'dist/index.js',
      cwd: '/home/digitaltwin/ask-the-expert',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        // IMPORTANT: Add your environment variables here
        // GEMINI_API_KEY: 'your-api-key-here',
        // DATABASE_URL: 'your-database-url-here',
        // SESSION_SECRET: 'your-session-secret-here'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/node-error.log',
      out_file: './logs/node-out.log',
      log_file: './logs/node-combined.log',
      time: true
    }
  ]
};
