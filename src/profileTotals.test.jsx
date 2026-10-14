import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import App from "./App";
import userEvent from "@testing-library/user-event";
import { mergeMcqProgressSnapshots } from "./lib/remoteProgress.mjs";
import { totalAnswers } from "./lib/answerTotals";

afterEach(() => { cleanup(); localStorage.clear(); });

it("counts repeated answers beyond the recent-history cap and retains lifetime totals", () => {
  expect(totalAnswers({ questions: { 1: { correctCount: 900, incorrectCount: 300 } }, attempts: Array(500) })).toBe(1200);
  expect(totalAnswers({ totalAnswers: 1201, questions: {}, attempts: [] })).toBe(1201);
});

it("pins Orestis first and shows each profile's own repeated-answer total", async () => {
  localStorage.setItem("psychiatry-study-profiles-v1", JSON.stringify({
    version: 1, activeProfileId: null, profiles: {
      alice: { id: "alice", name: "Alice", mcqProgress: { questions: { 1: { correctCount: 2, incorrectCount: 3 } } } },
      orestis: { id: "orestis", name: "orestis", mcqProgress: { totalAnswers: 1200 } },
    },
  }));
  window.history.pushState({}, "", "/");
  const { container } = render(<BrowserRouter><App /></BrowserRouter>);
  await screen.findByLabelText("Όνομα προφίλ");
  await waitFor(() => expect(container.querySelectorAll(".profile-btn")).toHaveLength(2));
  const cards = container.querySelectorAll(".profile-btn");
  expect(cards[0]).toHaveTextContent("orestis");
  expect(cards[0]).toHaveTextContent("admin");
  expect(cards[0]).toHaveTextContent("Συνολικές απαντήσεις 1.200");
  expect(cards[1]).toHaveTextContent("Συνολικές απαντήσεις 5");
});

it("keeps the lifetime counter when merging a newer smaller snapshot", () => {
  expect(mergeMcqProgressSnapshots(
    { totalAnswers: 1200, updatedAt: "2026-10-10T10:00:00Z" },
    { totalAnswers: 2, updatedAt: "2026-10-11T10:00:00Z" }
  ).totalAnswers).toBe(1200);
});

it("increases a lifetime total on an actual answer and shows it after switching profiles", async () => {
  const user = userEvent.setup();
  localStorage.setItem("psychiatry-study-profiles-v1", JSON.stringify({
    version: 1, activeProfileId: "alice", profiles: {
      alice: { id: "alice", name: "Alice", mcqProgress: { totalAnswers: 1200 } },
    },
  }));
  window.history.pushState({}, "", "/");
  const { container } = render(<BrowserRouter><App /></BrowserRouter>);
  await waitFor(() => expect(container.querySelector(".home-modules")).toBeTruthy());
  await user.click(container.querySelector(".home-modules").querySelector('button'));
  await user.click(await screen.findByRole("button", { name: /Mini-test/ }, { timeout: 10000 }));
  await user.click(screen.getByRole("button", { name: "10 ερωτήσεις" }));
  await waitFor(() => expect(container.querySelector(".option-btn:not([disabled])")).toBeTruthy());
  await user.click(container.querySelector(".option-btn:not([disabled])"));
  await user.click(screen.getByRole("button", { name: /Καταχώρηση/ }));
  await waitFor(() => {
    const store = JSON.parse(localStorage.getItem("psychiatry-study-profiles-v1"));
    expect(store.profiles.alice.mcqProgress.totalAnswers).toBe(1201);
  });
  await user.click(screen.getByRole("button", { name: "Αρχική", exact: true }));
  await user.click(screen.getByRole("button", { name: /Αλλαγή προφίλ. Τρέχον/ }));
  expect(await screen.findByText("Συνολικές απαντήσεις 1.201")).toBeInTheDocument();
});
