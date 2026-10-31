import { useEffect, useState } from "react";
import { createBooking, getAvailableSlots } from "./api";

function App() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }

    async function loadSlots() {
      setLoading(true);
      setError("");
      setStartTime("");

      try {
        const availableSlots = await getAvailableSlots(date);
        setSlots(availableSlots);
      } catch {
        setError("Could not load available slots");
      } finally {
        setLoading(false);
      }
    }

    loadSlots();
  }, [date]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name || !date || !startTime) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await createBooking(name, date, startTime);

      setMessage("Booking created");
      setName("");
      setStartTime("");

      const availableSlots = await getAvailableSlots(date);
      setSlots(availableSlots);
    } catch {
      setError("Could not create booking");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Booking App</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div>
          <label>Available time</label>

          <select
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            disabled={!date || loading}
          >
            <option value="">Choose a time</option>

            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Book"}
        </button>
      </form>

      {error && <p>{error}</p>}
      {message && <p>{message}</p>}
    </main>
  );
}

export default App;