import { describe, expect, it } from "vitest";
import { parseAppPath, pathForScreen } from "./appRoutes.js";

describe("CYP450 SOS route", () => {
  it("maps the screen to its stable URL", () => {
    expect(pathForScreen("sos-cyp450")).toBe("/sos/cyp450");
  });

  it("parses the CYP450 SOS URL", () => {
    expect(parseAppPath("/sos/cyp450")).toMatchObject({
      valid: true,
      screen: "sos-cyp450",
      testMode: null,
    });
  });
});
