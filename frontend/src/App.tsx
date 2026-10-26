function App() {
  return (
    <main>
      <h1>Booking App</h1>

      <form>
        <div>
          <label>Name</label>
          <input type="text" />
        </div>

        <div>
          <label>Date</label>
          <input type="date" />
        </div>

        <div>
          <label>Time</label>
          <input type="time" />
        </div>

        <button type="submit">Book</button>
      </form>
    </main>
  );
}

export default App;