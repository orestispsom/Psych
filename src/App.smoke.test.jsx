import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

async function createProfile(user, name, container) {
  const input = await screen.findByLabelText("Όνομα προφίλ");
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /Συνέχεια/ }));
  // Home renders once the profile is selected — its module grid is the signal.
  return within(await waitForHomeModules(container));
}

async function waitForHomeModules(container) {
  await waitFor(() => {
    expect(container.querySelector(".home-modules")).toBeTruthy();
  });
  return container.querySelector(".home-modules");
}

function readProfileStore() {
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  window.localStorage.clear();
  // jsdom's window.location/history persists across tests within a file;
  // reset it so each fresh render starts at "/" instead of wherever the
  // previous test's BrowserRouter navigation left off.
  window.history.pushState({}, "", "/");
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
    const { container } = renderApp();
    const home = await createProfile(user, "Δοκιμαστικός", container);

    expect(home.getByText("Πολλαπλής Επιλογής")).toBeInTheDocument();
    expect(home.getByText("Προφορικά")).toBeInTheDocument();
    expect(home.getByText("SOS")).toBeInTheDocument();
    expect(home.getByText("Πινακάκια")).toBeInTheDocument();
  });

  // Regression guard for the cold-start bug: the whole app used to block on
  // "Προετοιμασία της τράπεζας ερωτήσεων…" (the ~2.5MB MCQ bank loading)
  // before showing ANY screen, even ones that don't need that data.
  it("SOS is reachable immediately, without waiting on the MCQ question bank", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const home = await createProfile(user, "ΔοκιμαστικόςSOS", container);

    await user.click(home.getByText("SOS"));

    expect(
      screen.queryByText("Προετοιμασία της τράπεζας ερωτήσεων…")
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Κρίσιμα Θέματα")).toBeInTheDocument();
  });

  it("Πινακάκια is reachable immediately, without waiting on the MCQ question bank", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const home = await createProfile(user, "ΔοκιμαστικόςTables", container);

    await user.click(home.getByText("Πινακάκια"));

    expect(
      screen.queryByText("Προετοιμασία της τράπεζας ερωτήσεων…")
    ).not.toBeInTheDocument();
  });

  it("the MCQ hub loads and lists its study modes", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const home = await createProfile(user, "ΔοκιμαστικόςMCQ", container);

    await user.click(home.getByText("Πολλαπλής Επιλογής"));

    expect(await screen.findByText("Τυχαία Θέματα", {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText("Vignettes")).toBeInTheDocument();
    expect(screen.getByText("Αντιστοίχηση")).toBeInTheDocument();
  });

  // Regression guard for the closure-derived progress bug: marking an SOS
  // entry as mastered must show up in the persisted profile store.
  it("marking an SOS entry as mastered persists to the profile store", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const home = await createProfile(user, "ΔοκιμαστικόςMastery", container);

    await user.click(home.getByText("SOS"));
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
