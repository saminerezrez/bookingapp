import fastify from "fastify";
import type { FastifyError } from "fastify";
import cors from "@fastify/cors";
import routes from "./http/routes";
import { config } from "./config";

export function buildApp() {
  const httpServer = fastify({
    logger: { level: config.logLevel },
  });

  httpServer.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);

    const statusCode = error.statusCode ?? 500;

    // Unexpected errors can contain SQL details, so they never reach the client.
    if (statusCode >= 500) {
      return reply.code(statusCode).send({
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      });
    }

    return reply.code(statusCode).send({
      error: {
        message: error.message,
        code: error.code ?? "BAD_REQUEST",
      },
    });
  });

  httpServer.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: {
        message: "Route not found",
        code: "NOT_FOUND",
      },
    });
  });

  // An array, because a plain string is sent to every origin.
  httpServer.register(cors, {
    origin: [config.corsOrigin],
  });

  httpServer.register(routes);

  return httpServer;
}
