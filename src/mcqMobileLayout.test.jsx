import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import App from "./App";

function renderApp() {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

async function createProfile(user, name, container) {
  const input = await screen.findByLabelText("Όνομα προφίλ");
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /Συνέχεια/ }));
  await waitFor(() => {
    expect(container.querySelector(".home-modules")).toBeTruthy();
  });
  return within(container.querySelector(".home-modules"));
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Mobile MCQ single-screen experience", () => {
  it("activates single-screen layout and unified header when in MCQ test mode", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const home = await createProfile(user, "MobileTester", container);

    // Navigate to MCQ hub
    await user.click(home.getByText("Πολλαπλής Επιλογής"));

    // Wait for MCQ hub to load
    const sprintBtn = await screen.findByText("Mini-test", {}, { timeout: 10000 });
    expect(sprintBtn).toBeInTheDocument();

    // Verify global topbar is initially visible on hub
    expect(container.querySelector(".topbar")).toBeTruthy();

    // Start Mini-test
    await user.click(sprintBtn);

    // Wait for the test container to render
    await waitFor(() => {
      expect(container.querySelector(".mcq-layout-wrap")).toBeTruthy();
    });

    // Verify .sheet-mcq-active is applied to .sheet
    const sheet = container.querySelector(".sheet");
    expect(sheet).toHaveClass("sheet-mcq-active");

    // Verify global topbar is hidden during test
    expect(container.querySelector(".topbar")).toBeNull();

    // Verify unified header elements exist
    const header = container.querySelector(".mcq-question-header");
    expect(header).toBeTruthy();

    const backBtn = header.querySelector(".mcq-header-back-btn");
    expect(backBtn).toBeTruthy();

    const qIndex = header.querySelector(".mcq-q-index");
    expect(qIndex).toBeTruthy();
    expect(qIndex.textContent).toContain("1");

    const timer = header.querySelector(".mcq-header-timer");
    expect(timer).toBeTruthy();

    const stats = header.querySelector(".mcq-header-stats");
    expect(stats).toBeTruthy();

    // Verify question stem and options exist
    const stem = container.querySelector(".question-stem");
    expect(stem).toBeTruthy();

    const options = container.querySelectorAll(".option-btn");
    expect(options.length).toBeGreaterThanOrEqual(4);

    // Select first option
    await user.click(options[0]);
    expect(options[0]).toHaveClass("selected");

    // Test returning back to MCQ hub via header back button
    await user.click(backBtn);

    // Verify we returned to MCQ hub
    await waitFor(() => {
      expect(screen.getByText("Mini-test")).toBeInTheDocument();
    });

    // Verify global topbar is restored and sheet-mcq-active is removed
    expect(container.querySelector(".topbar")).toBeTruthy();
    expect(container.querySelector(".sheet")).not.toHaveClass("sheet-mcq-active");
  }, 15000);

  it("opens the 1–100 navigator as a modal in written exam mode on mobile", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const home = await createProfile(user, "SimTester", container);

    // Navigate to MCQ hub
    await user.click(home.getByText("Πολλαπλής Επιλογής"));

    const writtenBtn = await screen.findByText("Προσομοίωση Εξετάσεων", {}, { timeout: 10000 });
    expect(writtenBtn).toBeInTheDocument();

    await user.click(writtenBtn);

    // Wait for the written test to render
    await waitFor(() => {
      expect(container.querySelector(".mcq-layout-wrap")).toBeTruthy();
    });

    const header = container.querySelector(".mcq-question-header");
    expect(header).toBeTruthy();

    // Verify 1-100 button exists in actions
    const navBtn = header.querySelector(".mobile-sim-tray-btn");
    expect(navBtn).toBeTruthy();

    // Click navigator button to open modal
    await user.click(navBtn);

    // Modal should now be open
    const modal = container.querySelector(".sim-tray-modal");
    expect(modal).toBeTruthy();
    expect(within(modal).getByText(/Πλοηγός 1–100/)).toBeInTheDocument();

    // Click question chip 15 inside modal
    const chip15 = within(modal).getByRole("button", { name: "15" });
    expect(chip15).toBeInTheDocument();
    await user.click(chip15);

    // Modal should close
    await waitFor(() => {
      expect(container.querySelector(".sim-tray-modal")).toBeNull();
    });

    // Header should now display Question 15
    const qIndex = header.querySelector(".mcq-q-index");
    expect(qIndex.textContent).toContain("15");
  }, 15000);
});
