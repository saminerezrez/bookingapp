import type { FastifyInstance } from "fastify";
import * as controllers from "./controllers";

async function routes(httpServer: FastifyInstance) {
  httpServer.route({
    method: "GET",
    url: "/bookings",
    handler: controllers.getBookings,
  });

  httpServer.route({
    method: "POST",
    url: "/bookings",
    schema: {
      body: {
        type: "object",
        required: ["name", "date", "startTime"],
        properties: {
          // \S rejects names that are only whitespace.
          name: { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" },
          date: { type: "string" },
          startTime: { type: "string" },
        },
      },
    },
    handler: controllers.createBooking,
  });

  httpServer.route({
    method: "GET",
    url: "/available-slots",
    schema: {
      querystring: {
        type: "object",
        required: ["date"],
        properties: {
          date: { type: "string" },
        },
      },
    },
    handler: controllers.getAvailableSlots,
  });

  httpServer.route({
    method: "GET",
    url: "/health/ready",
    handler: controllers.healthReady,
  });

  httpServer.route({
    method: "GET",
    url: "/version",
    handler: controllers.getVersion,
  });

  httpServer.route({
    method: "GET",
    url: "/metrics",
    handler: controllers.getMetrics,
  });
}

export default routes;
