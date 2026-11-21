import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { app } from "./app.js";

const server = app.listen(env.PORT, () => {
  console.log(`OpsPulse API running at http://localhost:${env.PORT}`);
  console.log(`Health endpoint: http://localhost:${env.PORT}/api/v1/health`);
  console.log(
    `Readiness endpoint: http://localhost:${env.PORT}/api/v1/health/ready`,
  );
});

let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down OpsPulse API...`);

  server.close((error) => {
    void (async () => {
      try {
        await prisma.$disconnect();
        console.log("Prisma disconnected successfully.");
      } catch (disconnectError) {
        console.error("Error disconnecting Prisma:", disconnectError);
        process.exitCode = 1;
      }

      if (error) {
        console.error("Error during server shutdown:", error);
        process.exitCode = 1;
      }

      console.log("OpsPulse API shut down.");
    })();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
