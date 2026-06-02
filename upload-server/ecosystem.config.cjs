module.exports = {
  apps: [
    {
      name: "isolde-upload",
      script: "server.js",
      watch: false,
      autorestart: true,
    },
    {
      name: "isolde-backup",
      script: "backup.js",
      cron_restart: "0 0 * * *",   // elke nacht om middernacht
      autorestart: false,           // niet herstarten na afsluiten
      watch: false,
    },
  ],
};
