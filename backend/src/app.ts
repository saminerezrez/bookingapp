import fastify from "fastify";
import type { FastifyError } from "fastify";
import cors from "@fastify/cors";
import routes from "./http/routes";
import { config } from "./config";

export function buildApp() {
  const httpServer = fastify({
    logger: true,
  });

  httpServer.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);

    const statusCode = error.statusCode ?? 500;

    return reply.code(statusCode).send({
      error: {
        message: error.message,
        code: error.code ?? "INTERNAL_ERROR",
      },
    });
  });

  httpServer.register(cors, {
    origin: config.corsOrigin,
  });

  httpServer.register(routes);

  return httpServer;
}
