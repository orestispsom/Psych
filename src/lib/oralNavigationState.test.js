import { describe, expect, it } from "vitest";
import {
  getOralNavigationStorageKey,
  loadOralNavigationState,
  normalizeOralNavigationState,
  saveOralNavigationState,
} from "./oralNavigationState.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe("oralNavigationState", () => {
  it("uses separate keys per study profile", () => {
    expect(getOralNavigationStorageKey("orestis")).not.toBe(getOralNavigationStorageKey("guest"));
  });

  it("normalizes malformed persisted values", () => {
    expect(normalizeOralNavigationState({
      view: "unexpected",
      openBandId: "2",
      collapsedTopicIds: { "2:2A": true, "2:2B": false, "": true },
      scrollY: "381.6",
    })).toEqual({
      view: "bands",
      openBandId: 2,
      collapsedTopicIds: { "2:2A": true },
      scrollY: 382,
    });
  });

  it("merges partial updates without losing scroll or topic state", () => {
    const storage = createStorage();
    saveOralNavigationState("orestis", {
      view: "bands",
      openBandId: 1,
      collapsedTopicIds: { "1:1A": true },
      scrollY: 620,
    }, storage);

    saveOralNavigationState("orestis", { view: "all" }, storage);

    expect(loadOralNavigationState("orestis", storage)).toEqual({
      view: "all",
      openBandId: 1,
      collapsedTopicIds: { "1:1A": true },
      scrollY: 620,
    });
  });
});
