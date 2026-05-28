/** PM2-Prozesskonfiguration für smarthome-backend (Raspberry Pi / Produktion). */
module.exports = {
  apps: [
    {
      name: "smarthome-backend",
      script: "dist/com/smarthome/backend/index.js",
      cwd: __dirname,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      /** Pi: 2 GB Swap (install_raspberry_pi.sh) – Heap 2048 MB; Override: NODE_HEAP_MB=… */
      node_args: `--max-old-space-size=${process.env.NODE_HEAP_MB ?? "2048"}`,
      max_memory_restart: process.env.PM2_MAX_MEMORY ?? "2200M"
    }
  ]
};
