import { config } from "./config";
import { buildDependencies } from "./dependencies";
import { httpServer } from "./web/Server";
import * as cron from "node-cron";
const dependencies = buildDependencies(config);
import { addRetryToAxios } from "./utils";
(async () => {
  try {
    await dependencies.dbClient.init();
    addRetryToAxios();
    const server = httpServer(dependencies).listen(config.port, () => {
      console.log(`Express server started on port: ${config.port}`);
    });
    cron.schedule("*/10 * * * * *", async () => {
      console.log("Calculating APR");

      dependencies.getAPR();
    });
    process.on("SIGTERM", () => {
      console.log("Server stopping...");
      server.close(() => {
        process.exit(0);
      });
    });
  } catch (err) {
    console.error(err.message);
  }
})();
