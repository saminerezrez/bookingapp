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
    handler: controllers.createBooking,
  });

  httpServer.route({
    method: "GET",
    url: "/available-slots",
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
