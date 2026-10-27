import type { FastifyReply, FastifyRequest } from "fastify";
import * as services from "../services";

export async function getBookings(req: FastifyRequest, res: FastifyReply) {
  const bookings = await services.getBookings();

  res.status(200).send({ bookings });
}
