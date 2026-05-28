/** PM2-Prozesskonfiguration für smarthome-backend (Raspberry Pi / Produktion). */
module.exports = {
  apps: [
    {
      name: "smarthome-backend",
      script: "dist/com/smarthome/backend/index.js",
      cwd: __dirname,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      /** Node.js-V8-Heap: bis 1 GB. */
      node_args: "--max-old-space-size=1024",
      /** PM2 startet den Prozess neu, wenn der RSS-Speicher 1 GB überschreitet. */
      max_memory_restart: "1G"
    }
  ]
};
