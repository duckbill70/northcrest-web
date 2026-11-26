import { expect, test, type Page } from "@playwright/test";

// Passenger journeys run on a schedule against the live sites. Real-user
// monitoring tags this traffic as synthetic (user_agent.synthetic.type =
// "test", from navigator.webdriver), and bookings use a reserved
// example.com address so they're easy to tell apart.

const BOOKING_URL = process.env.BOOKING_URL ?? "http://localhost:5173";
const STATUS_URL = process.env.STATUS_URL ?? "http://localhost:5174";

// Let RUM export before the page goes away.
async function flushTelemetry(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    // rum.ts listens on window, so the event must bubble up from document.
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  await page.waitForTimeout(1_000);
}

test("book a flight, find the booking and cancel it", async ({ page }) => {
  let pnr: string | undefined;
  let cancelled = false;
  // If the journey fails after booking, cancel through the API so failed
  // runs don't leave confirmed synthetic bookings behind.
  try {
    await page.goto(BOOKING_URL);
    await page.getByLabel("To", { exact: true }).selectOption("AMS");
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Departing").fill(tomorrow);
    await page.getByLabel("Passengers").selectOption("1");

    await test.step("search", async () => {
      await page.getByRole("button", { name: "Search flights" }).click();
      await expect(page.getByRole("button", { name: /^Select NC/ }).first()).toBeVisible();
    });

    pnr = await test.step("book", async () => {
      await page.getByRole("button", { name: /^Select NC/ }).first().click();
      await page.getByLabel("First name", { exact: true }).fill("Synthetic");
      await page.getByLabel("Last name", { exact: true }).fill("Journey");
      await page.getByLabel("Email", { exact: true }).fill("synthetic@example.com");
      await page.getByRole("button", { name: /^Book and pay/ }).click();
      const ref = page.getByTestId("pnr");
      await expect(ref).toHaveText(/^[A-Z0-9]{6}$/);
      return (await ref.textContent())!.trim();
    });

    await test.step("find and cancel", async () => {
      await page.getByRole("link", { name: "Manage this booking" }).click();
      await page.getByLabel("Last name", { exact: true }).fill("Journey");
      await page.getByRole("button", { name: "Find booking" }).click();
      await expect(page.getByText(pnr!).first()).toBeVisible();
      await page.getByRole("button", { name: "Cancel booking" }).click();
      await page.getByRole("button", { name: "Yes, cancel booking" }).click();
      await expect(page.getByTestId("booking-status")).toContainText("Cancelled");
      cancelled = true;
    });

    await flushTelemetry(page);
  } finally {
    if (pnr && !cancelled) {
      await page.request.post(`${BOOKING_URL}/api/bookings/${pnr}/cancel`, { data: { lastName: "Journey" } }).catch(() => {});
    }
  }
});

test("check the departures board and a single flight", async ({ page }) => {
  await page.goto(STATUS_URL);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("table").getByRole("row").nth(1)).toBeVisible();

  await page.getByRole("tab", { name: "Arrivals" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  await page.getByLabel("Flight number").fill("NC104");
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(page.getByLabel("Status of NC104")).toBeVisible();

  await flushTelemetry(page);
});
