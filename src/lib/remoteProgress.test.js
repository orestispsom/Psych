import { describe, expect, it, vi } from "vitest";
import { fetchAllPages, mergeMcqProgressSnapshots, mergeOralProgressSnapshots } from "./remoteProgress.mjs";

describe("remote progress safeguards", () => {
  it("keeps a newer unchecked oral answer when an older device reconnects", () => {
    const older = { mastered: { Q1: true, Q2: true }, updatedAt: "2026-10-08T09:00:00Z" };
    const newer = { mastered: { Q1: false }, updatedAt: "2026-10-08T10:00:00Z" };
    expect(mergeOralProgressSnapshots(newer, older).mastered).toEqual({ Q1: false, Q2: true });
    expect(mergeOralProgressSnapshots(older, newer).mastered).toEqual({ Q1: false, Q2: true });
  });
  it("never drops remote question records when a smaller local snapshot is saved", () => {
    const remote = {
      updatedAt: "2026-09-03T09:00:00Z",
      questions: {
        1: { attempts: 2, updatedAt: "2026-09-01T09:00:00Z" },
        2: { attempts: 4, updatedAt: "2026-09-02T09:00:00Z" },
      },
    };
    const local = {
      updatedAt: "2026-09-03T10:00:00Z",
      questions: {
        2: { attempts: 5, updatedAt: "2026-09-03T10:00:00Z" },
      },
    };

    const merged = mergeMcqProgressSnapshots(remote, local);
    expect(Object.keys(merged.questions)).toEqual(["1", "2"]);
    expect(merged.questions[2].attempts).toBe(5);
  });

  it("loads every page instead of stopping at the API row cap", async () => {
    const source = Array.from({ length: 2319 }, (_, id) => ({ id }));
    const fetchPage = vi.fn(({ offset, limit }) => source.slice(offset, offset + limit));

    const rows = await fetchAllPages(fetchPage, 1000);

    expect(rows).toHaveLength(2319);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("preserves remote oral mastery when another device saves", () => {
    const merged = mergeOralProgressSnapshots(
      { mastered: { old: true }, updatedAt: "2026-09-01T10:00:00Z" },
      { mastered: { new: true }, updatedAt: "2026-09-03T10:00:00Z" }
    );

    expect(merged.mastered).toEqual({ old: true, new: true });
  });
});
