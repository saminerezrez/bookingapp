import { sql } from "bun";
import type { FastifyReply, FastifyRequest } from "fastify";
import * as services from "../services";
import { config } from "../config";

export async function getBookings(req: FastifyRequest, res: FastifyReply) {
  const bookings = await services.getBookings();

  res.status(200).send({ bookings });
}

export async function healthReady(req: FastifyRequest, res: FastifyReply) {
  try {
    await sql`SELECT 1`;

    return res.status(200).send({
      status: "ok",
    });
  } catch {
    return res.status(503).send({
      status: "error",
    });
  }
}

export async function getVersion(req: FastifyRequest, res: FastifyReply) {
  return res.status(200).send({
    version: config.appVersion,
  });
}

export async function getMetrics(req: FastifyRequest, res: FastifyReply) {
  return res
    .status(200)
    .type("text/plain")
    .send(
      "# HELP bookingapp_up Shows if the backend is running\n" +
        "# TYPE bookingapp_up gauge\n" +
        "bookingapp_up 1\n",
    );
}
