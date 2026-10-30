import { sql } from "bun";
import type { FastifyReply, FastifyRequest } from "fastify";
import * as services from "../services";
import { config } from "../config";
import type { CreateBookingInput } from "../repository/types";
import {
  isValidBookingName,
  isValidBookingDate,
  isValidBookingTime,
} from "../validation";

export async function getBookings(req: FastifyRequest, res: FastifyReply) {
  const bookings = await services.getBookings();

  return res.status(200).send({ bookings });
}

export async function createBooking(
  req: FastifyRequest<{ Body: CreateBookingInput }>,
  res: FastifyReply,
) {
  const { name, date, start_time } = req.body;

  if (
    typeof name !== "string" ||
    typeof date !== "string" ||
    typeof start_time !== "string" ||
    !isValidBookingName(name) ||
    !isValidBookingDate(date) ||
    !isValidBookingTime(start_time)
  ) {
    return res.status(400).send({
      error: {
        message: "Invalid booking data",
        code: "INVALID_BOOKING",
      },
    });
  }

  try {
    const booking = await services.createBooking(req.body);

    return res.status(201).send({ booking });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("bookings_slot_unique")
    ) {
      return res.status(409).send({
        error: {
          message: "This time slot is already booked",
          code: "BOOKING_CONFLICT",
        },
      });
    }

    throw error;
  }
}

export async function getAvailableSlots(
  req: FastifyRequest<{ Querystring: { date: string } }>,
  res: FastifyReply,
) {
  const { date } = req.query;

  if (typeof date !== "string" || date.trim().length === 0) {
    return res.status(400).send({
      error: {
        message: "Date is required",
        code: "INVALID_DATE",
      },
    });
  }

  const slots = await services.getAvailableSlots(date);

  return res.status(200).send({ slots });
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
