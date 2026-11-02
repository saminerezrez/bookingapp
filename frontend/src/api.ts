const API_URL = import.meta.env.VITE_API_URL;

export type Slot = {
  startTime: string;
  available: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error("Could not reach the server. Please try again.");
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  if (response.status === 409) {
    throw new Error("That time was just booked. Please choose another time.");
  }

  const body = await response.json().catch(() => null);

  throw new Error(body?.error?.message ?? "Something went wrong. Please try again.");
}

export async function getAvailableSlots(date: string) {
  const data = await request<{ slots: Slot[] }>(
    `/available-slots?date=${encodeURIComponent(date)}`,
  );

  return data.slots;
}

export async function createBooking(
  name: string,
  date: string,
  startTime: string,
) {
  return await request("/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      date,
      startTime,
    }),
  });
}
