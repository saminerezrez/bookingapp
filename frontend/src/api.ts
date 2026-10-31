const API_URL = import.meta.env.VITE_API_URL;

export async function getAvailableSlots(date: string) {
  const response = await fetch(
    `${API_URL}/available-slots?date=${encodeURIComponent(date)}`,
  );

  if (!response.ok) {
    throw new Error("Could not load available slots");
  }

  const data = await response.json();

  return data.slots as string[];
}

export async function createBooking(
  name: string,
  date: string,
  startTime: string,
) {
  const response = await fetch(`${API_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      date,
      start_time: startTime,
    }),
  });

  if (!response.ok) {
    throw new Error("Could not create booking");
  }

  return await response.json();
}
