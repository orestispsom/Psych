import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import App from "./App";

const PROFILE_STORAGE_KEY = "psychiatry-study-profiles-v1";

function renderApp() {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

async function createProfile(user, name) {
  const input = await screen.findByLabelText("Όνομα προφίλ");
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /Συνέχεια/ }));
  // Home renders once the profile is selected — its module row is the signal.
  await screen.findByText("Πολλαπλής Επιλογής");
}

function readProfileStore() {
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("golden path smoke tests", () => {
  it("boots to the profile screen", async () => {
    renderApp();
    expect(await screen.findByLabelText("Όνομα προφίλ")).toBeInTheDocument();
  });

  it("creates a profile and reaches Home with all four study sections", async () => {
    const user = userEvent.setup();
    renderApp();
    await createProfile(user, "Δοκιμαστικός");

    expect(screen.getByText("Πολλαπλής Επιλογής")).toBeInTheDocument();
    expect(screen.getByText("Προφορικά")).toBeInTheDocument();
    expect(screen.getByText("SOS")).toBeInTheDocument();
    expect(screen.getByText("Πινακάκια")).toBeInTheDocument();
  });

  // Regression guard for the cold-start bug: the whole app used to block on
  // "Προετοιμασία της τράπεζας ερωτήσεων…" (the ~2.5MB MCQ bank loading)
  // before showing ANY screen, even ones that don't need that data.
  it("SOS is reachable immediately, without waiting on the MCQ question bank", async () => {
    const user = userEvent.setup();
    renderApp();
    await createProfile(user, "ΔοκιμαστικόςSOS");

    await user.click(screen.getByText("SOS"));

    expect(
      screen.queryByText("Προετοιμασία της τράπεζας ερωτήσεων…")
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Κρίσιμα Θέματα")).toBeInTheDocument();
  });

  it("Πινακάκια is reachable immediately, without waiting on the MCQ question bank", async () => {
    const user = userEvent.setup();
    renderApp();
    await createProfile(user, "ΔοκιμαστικόςTables");

    await user.click(screen.getByText("Πινακάκια"));

    expect(
      screen.queryByText("Προετοιμασία της τράπεζας ερωτήσεων…")
    ).not.toBeInTheDocument();
  });

  it("the MCQ hub loads and lists its study modes", async () => {
    const user = userEvent.setup();
    renderApp();
    await createProfile(user, "ΔοκιμαστικόςMCQ");

    await user.click(screen.getByText("Πολλαπλής Επιλογής"));

    expect(await screen.findByText("Τυχαία Θέματα", {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText("Vignettes")).toBeInTheDocument();
    expect(screen.getByText("Αντιστοίχηση")).toBeInTheDocument();
  });

  // Regression guard for the closure-derived progress bug: marking an SOS
  // entry as mastered must show up in the persisted profile store.
  it("marking an SOS entry as mastered persists to the profile store", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await createProfile(user, "ΔοκιμαστικόςMastery");

    await user.click(screen.getByText("SOS"));
    await user.click(await screen.findByText("Κρίσιμα Θέματα"));

    const firstEntry = container.querySelector(".sos-list-open");
    expect(firstEntry).toBeTruthy();
    await user.click(firstEntry);

    const masteryToggle = await screen.findByRole("button", {
      name: /Σημείωσέ το ως κατακτημένο/,
    });
    await user.click(masteryToggle);

    expect(
      await screen.findByRole("button", { name: "Κατακτημένο" })
    ).toBeInTheDocument();

    await waitFor(() => {
      const store = readProfileStore();
      const profile = Object.values(store.profiles)[0];
      const mastered = profile.sosProgress?.mastered?.critical_topics || {};
      expect(Object.keys(mastered).length).toBeGreaterThan(0);
    });
  });
});
