import type { FastifyReply, FastifyRequest } from "fastify";
import { sql } from "bun";
import * as services from "../services";
import { config } from "../config";
import type { CreateBookingInput } from "../repository/types";

export async function getBookings(req: FastifyRequest, res: FastifyReply) {
  const bookings = await services.getBookings();

  return res.status(200).send({ bookings });
}

export async function createBooking(
  req: FastifyRequest<{ Body: CreateBookingInput }>,
  res: FastifyReply,
) {
  const booking = await services.createBooking(req.body);

  return res.status(201).send({ booking });
}

export async function getAvailableSlots(
  req: FastifyRequest<{ Querystring: { date: string } }>,
  res: FastifyReply,
) {
  const { date } = req.query;
  const slots = await services.getAvailableSlots(date);

  return res.status(200).send({ date, slots });
}

export async function healthReady(req: FastifyRequest, res: FastifyReply) {
  try {
    await sql`SELECT 1`;

    return res.status(200).send({
      status: "ok",
      version: config.appVersion,
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
