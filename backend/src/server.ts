import { app } from "./app.js";

const PORT = Number(process.env.PORT) || 4000;

const server = app.listen(PORT, () => {
  console.log(`OpsPulse API running at http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/v1/health`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received. Shutting down OpsPulse API...`);

  server.close((error) => {
    if (error) {
      console.error("Error during server shutdown:", error);
      process.exit(1);
    }

    console.log("OpsPulse API shut down successfully.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
