import { useEffect, useState } from "react";
import { createBooking, getAvailableSlots } from "./api";
import type { Slot } from "./api";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

function App() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startTime, setStartTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const freeSlots = slots.filter((slot) => slot.available);

  useEffect(() => {
    if (!date) {
      return;
    }

    // Ignores the answer if another date was picked while this one was loading.
    let ignore = false;

    async function loadSlots() {
      setLoading(true);
      setError("");

      try {
        const daySlots = await getAvailableSlots(date);

        if (!ignore) {
          setSlots(daySlots);
        }
      } catch (error) {
        if (!ignore) {
          setError(errorMessage(error));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadSlots();

    return () => {
      ignore = true;
    };
  }, [date]);

  function handleDateChange(value: string) {
    setDate(value);
    setSlots([]);
    setStartTime("");
    setLoading(false);
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim() || !date || !startTime) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await createBooking(name, date, startTime);

      setMessage(`Booked ${date} at ${startTime}`);
      setName("");
    } catch (error) {
      setError(errorMessage(error));
    }

    // Refreshed after a failed booking too, so a slot someone else took disappears.
    try {
      setStartTime("");
      setSlots(await getAvailableSlots(date));
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Booking App</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="date">Date</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(event) => handleDateChange(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="time">Available time</label>

          <select
            id="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            disabled={!date || loading}
          >
            <option value="">Choose a time</option>

            {freeSlots.map((slot) => (
              <option key={slot.startTime} value={slot.startTime}>
                {slot.startTime}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Book"}
        </button>
      </form>

      {date && !loading && !error && freeSlots.length === 0 && (
        <p>No free times on this date.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </main>
  );
}

export default App;
