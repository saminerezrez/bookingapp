import type { FastifyInstance } from "fastify";
import * as controllers from "./controllers";

async function routes(httpServer: FastifyInstance) {
  httpServer.route({
    method: "GET",
    url: "/bookings",
    handler: controllers.getBookings,
  });
}

export default routes;
