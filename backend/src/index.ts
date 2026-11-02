import { buildApp } from "./app";
import { config } from "./config";

const httpServer = buildApp();

await httpServer.listen({
  port: config.port,
  host: config.host,
});

console.log(`Server running on http://${config.host}:${config.port}`);
