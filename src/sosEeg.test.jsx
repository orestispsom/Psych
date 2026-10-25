import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import App from "./App";

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

it("finds the EEG critical topic by Greek and English names, opens it, and saves mastery", async () => {
  const user = userEvent.setup();
  const { container } = render(<BrowserRouter><App /></BrowserRouter>);
  await user.type(await screen.findByLabelText("Όνομα προφίλ"), "EEG test");
  await user.click(screen.getByRole("button", { name: "Συνέχεια", exact: true }));
  await waitFor(() => expect(container.querySelector(".home-modules")).toBeTruthy());
  await user.click(within(container.querySelector(".home-modules")).getByRole("button", { name: "SOS", exact: true }));
  await user.click(await screen.findByText("Κρίσιμα Θέματα"));

  const search = await screen.findByRole("searchbox", { name: "Αναζήτηση σε Κρίσιμα Θέματα" });
  for (const term of ["EEG", "ΗΕΓ", "Ηλεκτροεγκεφαλογράφημα"]) {
    await user.clear(search);
    await user.type(search, term);
    expect(screen.getByRole("button", { name: /Ηλεκτροεγκεφαλογράφημα.*EEG/ })).toBeInTheDocument();
  }
  await user.click(screen.getByRole("button", { name: /Ηλεκτροεγκεφαλογράφημα.*EEG/ }));
  expect(await screen.findByRole("heading", { name: /Ηλεκτροεγκεφαλογράφημα/ })).toBeInTheDocument();
  expect(screen.getByText(/Φυσιολογικό routine EEG ΔΕΝ αποκλείει επιληψία/)).toBeInTheDocument();
  expect(screen.getByText(/extreme delta brush, δηλαδή/)).toBeInTheDocument();
  expect(screen.getByText(/Πηγές — έλεγχος/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Mark as mastered", exact: true }));
  await waitFor(() => {
    const store = JSON.parse(localStorage.getItem("psychiatry-study-profiles-v1"));
    const profile = Object.values(store.profiles)[0];
    expect(profile.sosProgress.mastered.critical_topics.critical_eeg).toBeTruthy();
  });
}, 15000);
