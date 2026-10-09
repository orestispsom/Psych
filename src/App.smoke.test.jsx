import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import App from "./App";
import { loadStudyPosition, saveStudyPosition } from "./lib/studyPosition";

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

  it("shows the current profile in the mobile header and allows switching profiles", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await createProfile(user, "Δοκιμαστικός", container);

    const switchProfile = screen.getByRole("button", {
      name: "Αλλαγή προφίλ. Τρέχον προφίλ: Δοκιμαστικός",
    });
    expect(switchProfile).toBeInTheDocument();
    expect(within(switchProfile).getByText("Δοκιμαστικός")).toBeInTheDocument();

    await user.click(switchProfile);
    expect(await screen.findByLabelText("Όνομα προφίλ")).toBeInTheDocument();
    expect(screen.getByText("Υπάρχοντα προφίλ")).toBeInTheDocument();
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

  it("unifies oral sources by Greek chapters and preserves completion across reloads", async () => {
    const user = userEvent.setup();
    const { container, unmount } = renderApp();
    const home = await createProfile(user, "ΔοκιμαστικόςOral", container);
    await user.click(home.getByText("Προφορικά"));
    expect(await screen.findByText(/26 κεφάλαια/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Περιεχόμενα" })).toHaveAttribute("aria-expanded", "true");
    const chapters = screen.getByRole("navigation", { name: "Κεφάλαια προφορικών" });
    expect(within(chapters).getAllByRole("link")).toHaveLength(27);
    await user.click(within(chapters).getByRole("link", { name: /03\s*Αξιολόγηση/ }));
    expect(window.location.pathname).toBe("/oral/chapters/3");
    expect(screen.getByRole("navigation", { name: "Κεφάλαια προφορικών" })).toBeInTheDocument();
    const question = await screen.findByRole("link", { name: /Πώς προσεγγίζετε έναν νέο ψυχιατρικό ασθενή/ });
    await user.click(question);
    expect(screen.queryByRole("button", { name: "Εμφάνιση απάντησης" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Πρότυπη προφορική απάντηση" })).toBeInTheDocument();
    const check = screen.getByRole("button", { name: "Ολοκληρώθηκε" });
    await user.click(check);
    await waitFor(() => expect(Object.values(readProfileStore().profiles)[0].oralProgress.mastered.Q1).toBe(true));
    expect(window.location.pathname).toBe("/oral/chapters/3/questions/Q1");
    const path = window.location.pathname;
    unmount(); renderApp();
    expect(window.location.pathname).toBe(path);
    expect(await screen.findByRole("button", { name: "Ολοκληρώθηκε" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Ολοκληρώθηκε" }));
    await waitFor(() => expect(Object.values(readProfileStore().profiles)[0].oralProgress.mastered.Q1).toBe(false));
    await user.click(screen.getByRole("button", { name: /Αλλαγή προφίλ. Τρέχον/ }));
    const profile = await screen.findByRole("button", { name: /ΔοκιμαστικόςOral.*MCQs απαντημένα/ });
    expect(profile.textContent).toMatch(/0 MCQs απαντημένα.*0 για επανάληψη.*0 mastered/);
    expect(profile.textContent).not.toContain("Προφορικά");
  });

  it("keeps old exam bookmarks in the reading workspace without hidden source filters", async () => {
    const user = userEvent.setup();
    const { container, unmount } = renderApp();
    await createProfile(user, "ΠροφορικάΑνάγνωση", container);
    unmount();
    window.history.pushState({}, "", "/oral/simulator?chapter=3&mode=exam&source=past&filter=checked&question=Q1");
    renderApp();
    expect(await screen.findByRole("heading", { name: "Πρότυπη προφορική απάντηση" })).toBeInTheDocument();
    const workspace = within(document.querySelector(".oral-workspace"));
    expect(workspace.queryByText("Προφορική εξέταση")).not.toBeInTheDocument();
    expect(workspace.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(workspace.queryByRole("combobox")).not.toBeInTheDocument();
    expect(workspace.queryByText(/Απάντησε προφορικά/)).not.toBeInTheDocument();
    await user.click(workspace.getByRole("button", { name: "Ολοκληρώθηκε" }));
    await user.click(workspace.getByRole("link", { name: "Λίστα ερωτήσεων" }));
    expect(workspace.getByRole("link", { name: /Πώς προσεγγίζετε έναν νέο ψυχιατρικό ασθενή/ })).toHaveClass("is-checked");
    expect(window.location.pathname).toBe("/oral/chapters/3");
    expect(window.location.search).toBe("");
    await user.click(workspace.getByRole("button", { name: "Περιεχόμενα" }));
    expect(workspace.queryByRole("navigation", { name: "Κεφάλαια προφορικών" })).not.toBeInTheDocument();
    await user.click(workspace.getByRole("button", { name: "Περιεχόμενα" }));
    expect(workspace.getByRole("navigation", { name: "Κεφάλαια προφορικών" })).toBeInTheDocument();
  });

  it('keeps related model responses on their own pages instead of appending them to a narrow question', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await createProfile(user, 'ΣωστήΑπάντηση', first.container);
    first.unmount();
    window.history.pushState({}, '', '/oral/chapters/1/questions/1Aa2');
    renderApp();
    expect(await screen.findByRole('heading', { name: /Ποια τα συμπτώματα α΄ τάξης/ })).toBeInTheDocument();
    const related = await screen.findByRole('navigation', { name: 'Σχετικές ερωτήσεις' });
    expect(within(related).getAllByRole('link')).toHaveLength(1);
    expect(document.querySelector('.oral-reading-answer').textContent).toContain('Δεν είναι παθογνωμονικά');
    expect(screen.queryByRole('heading', { name: 'Πρότυπη προφορική απάντηση' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Πότε μπορεί ένας ασθενής να νοσηλευτεί ακούσια/ })).not.toBeInTheDocument();
    await user.click(within(related).getByRole('link', { name: 'Περιγράψτε την κλινική εικόνα και τη διάγνωση της σχιζοφρένειας.' }));
    expect(window.location.pathname).toBe('/oral/chapters/11/questions/Q12');
    expect(await screen.findByRole('heading', { name: 'Πρότυπη προφορική απάντηση' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Περιγράψτε την κλινική εικόνα και τη διάγνωση της σχιζοφρένειας.' })).toBeInTheDocument();
  });
  it('does not show a bipolar model response under a statistics question', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await createProfile(user, 'Στατιστική', first.container);
    first.unmount();
    window.history.pushState({}, '', '/oral/chapters/6/questions/5A4');
    renderApp();
    expect(await screen.findByRole('heading', { name: /Πώς διακρίνονται σχετικός κίνδυνος/ })).toBeInTheDocument();
    expect(document.querySelector('.oral-reading-answer').textContent).toContain('NNT');
    expect(screen.queryByRole('navigation', { name: 'Σχετικές ερωτήσεις' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Πρότυπη προφορική απάντηση' })).not.toBeInTheDocument();
    expect(document.querySelector('.oral-reading-answer').textContent).not.toContain('rapid cycling');
  });

  it('resumes a reclassified question in its new chapter while keeping its checkmark', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await createProfile(user, 'ΣωστόΚεφάλαιο', first.container);
    first.unmount();
    const store = readProfileStore();
    const profile = Object.values(store.profiles)[0];
    profile.oralProgress.mastered.jan2026_16 = true;
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store));
    saveStudyPosition(profile.id, { path: '/oral/chapters/1/questions/jan2026_16', title: 'Soft signs', section: 'Προφορικά' });
    renderApp();
    await user.click(await screen.findByRole('button', { name: /Συνέχεια:.*Soft signs/ }));
    expect(await screen.findByRole('heading', { name: /Τι είναι τα ήπια νευρολογικά σημεία/ })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/oral/chapters/11/questions/jan2026_16'));
    expect(screen.getByRole('heading', { name: '11. Σχιζοφρένεια' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ολοκληρώθηκε' })).toHaveAttribute('aria-pressed', 'true');
    expect(loadStudyPosition(profile.id).path).toBe('/oral/chapters/11/questions/jan2026_16');
    await user.click(screen.getByRole('link', { name: /^01\s*Σημεία και συμπτώματα/ }));
    expect(screen.queryByRole('link', { name: /Τι είναι τα ήπια νευρολογικά σημεία/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Πώς αναγνωρίζετε την κατατονία/ })).toBeInTheDocument();
  });

  it('resumes a retired saved question at its replacement without losing historical checks', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await createProfile(user, 'ΑπόσυρσηΠροφορικών', first.container);
    first.unmount();
    const store = readProfileStore();
    const profile = Object.values(store.profiles)[0];
    profile.oralProgress.mastered['oral_core_017_fu04'] = true;
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store));
    saveStudyPosition(profile.id, { path: '/oral/chapters/1/questions/oral_core_017_fu04', title: 'Παλιό θέμα', section: 'Προφορικά' });
    renderApp();
    await user.click(await screen.findByRole('button', { name: /Συνέχεια:.*Παλιό θέμα/ }));
    expect(await screen.findByRole('heading', { name: /Πώς αναγνωρίζετε την κατατονία/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/oral/chapters/1/questions/Q10');
    expect(screen.getByRole('button', { name: 'Ολοκληρώθηκε' })).toHaveAttribute('aria-pressed', 'false');
    expect(readProfileStore().profiles[profile.id].oralProgress.mastered['oral_core_017_fu04']).toBe(true);
    expect(loadStudyPosition(profile.id).path).toBe('/oral/chapters/1/questions/Q10');
    expect(screen.getByText(/Η ECT μπορεί να χρειαστεί επειγόντως/)).toBeInTheDocument();
  });
  it('redirects a legacy query bookmark for a retired challenge across chapters', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await createProfile(user, 'ΠαλιόςΣύνδεσμος', first.container);
    first.unmount();
    window.history.pushState({}, '', '/oral?chapter=3&question=oral_challenge_007');
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Πώς εκτιμάτε αν ένας ασθενής μπορεί να δώσει έγκυρη ενημερωμένη συναίνεση;' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/oral/chapters/4/questions/Q8');
    expect(window.location.search).toBe('');
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

  it("resumes category study at the saved position and can start that category over", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const home = await createProfile(user, "ΔοκιμαστικόςCategoryResume", container);

    await user.click(home.getByText("Πολλαπλής Επιλογής"));
    const categoryMode = await screen.findByRole("button", { name: /Ερωτήσεις ανά Κατηγορία/i }, { timeout: 10000 });
    await user.click(categoryMode);

    await waitFor(() => {
      expect(container.querySelector(".mcq-select .items .item:not([disabled])")).toBeTruthy();
    });
    const firstCategoryButton = container.querySelector(".mcq-select .items .item:not([disabled])");
    const topic = firstCategoryButton.querySelector(".item-title").textContent;
    await user.click(firstCategoryButton);

    await waitFor(() => expect(container.querySelector(".mcq-q-index")?.textContent).toMatch(/Ερώτηση 1\s*\//));
    await user.click(screen.getByRole("button", { name: "Επόμενη ερώτηση" }));
    await waitFor(() => expect(container.querySelector(".mcq-q-index")?.textContent).toMatch(/Ερώτηση 2\s*\//));

    await waitFor(() => {
      const store = readProfileStore();
      const profile = Object.values(store.profiles)[0];
      expect(profile.mcqProgress?.categoryDrafts?.[topic]?.currentIdx).toBe(1);
    });

    await user.click(screen.getByRole("button", { name: "Επιστροφή στο Μενού MCQ" }));
    await waitFor(() => {
      expect(container.querySelector(".mcq-select .items")).toBeTruthy();
    });
    const savedCategoryButton = [...container.querySelectorAll(".mcq-select .item")]
      .find(button => button.querySelector(".item-title")?.textContent === topic);
    await user.click(savedCategoryButton);

    expect(await screen.findByText("Υπάρχει αποθηκευμένη πρόοδος για αυτή την κατηγορία.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Συνέχεια από την ερώτηση 2/i }));
    await waitFor(() => expect(container.querySelector(".mcq-q-index")?.textContent).toMatch(/Ερώτηση 2\s*\//));

    await user.click(screen.getByRole("button", { name: "Επιστροφή στο Μενού MCQ" }));
    await waitFor(() => {
      expect(container.querySelector(".mcq-select .items")).toBeTruthy();
    });
    const categoryAgain = [...container.querySelectorAll(".mcq-select .item")]
      .find(button => button.querySelector(".item-title")?.textContent === topic);
    await user.click(categoryAgain);
    await user.click(await screen.findByRole("button", { name: /Νέα αρχή στην κατηγορία/i }));
    await waitFor(() => expect(container.querySelector(".mcq-q-index")?.textContent).toMatch(/Ερώτηση 1\s*\//));

    await waitFor(() => {
      const store = readProfileStore();
      const profile = Object.values(store.profiles)[0];
      expect(profile.mcqProgress?.categoryDrafts?.[topic]?.currentIdx).toBe(0);
    });
  }, 20000);

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
      name: /mastered/i,
    });
    await user.click(masteryToggle);

    expect(
      await screen.findByRole("button", { name: /mastered/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      const store = readProfileStore();
      const profile = Object.values(store.profiles)[0];
      const mastered = profile.sosProgress?.mastered?.critical_topics || {};
      expect(Object.keys(mastered).length).toBeGreaterThan(0);
    });
  });
});
