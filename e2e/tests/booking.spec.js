const { test, expect } = require("@playwright/test");

test("user can create a booking", async ({ page }) => {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  const bookingDate = date.toLocaleDateString("sv-SE");

  await page.goto("/");

  await page.getByLabel("Name").fill("Sofie");
  await page.getByLabel("Date").fill(bookingDate);

  const timeSelect = page.getByLabel("Available time");

  await expect(timeSelect).toBeEnabled();

  const firstSlot = timeSelect.locator("option").nth(1);
  const startTime = await firstSlot.getAttribute("value");

  await timeSelect.selectOption(startTime);

  await page.getByRole("button", { name: "Book" }).click();

  await expect(page.getByRole("status")).toContainText("Booked");

  await expect(
    timeSelect.locator(`option[value="${startTime}"]`),
  ).toHaveCount(0);
});
