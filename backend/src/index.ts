import fastify from "fastify";
import routes from "./http/routes";

const httpServer = fastify();

await httpServer.register(routes);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "localhost";

await httpServer.listen({
  port,
  host,
});

console.log(`Server running on http://${host}:${port}`);
