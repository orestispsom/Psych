import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppShell from "./components/AppShell.jsx";

describe("AppShell usage disclaimer", () => {
  it("shows the personal-use and educational-purpose disclaimer", () => {
    render(
      <AppShell
        screen="home"
        title="Επανάληψη Ψυχιατρικής"
        profileName="Orestis"
        isAdmin={false}
        theme="light"
        onToggleTheme={() => {}}
        onNavigateSection={() => {}}
        onOpenSearch={() => {}}
        onOpenShortcuts={() => {}}
        onSwitchProfile={() => {}}
        onHome={() => {}}
      >
        <div>Αρχική</div>
      </AppShell>,
    );

    expect(
      screen.getByText("Αποκλειστικά για προσωπική χρήση και εκπαιδευτικούς σκοπούς."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Δεν αποτελεί ιατρική συμβουλή και δεν υποκαθιστά κλινική κρίση ή επίσημες πηγές."),
    ).toBeInTheDocument();
  });
});
