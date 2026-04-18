import { describe, it, expect } from "vitest";
import { greet, getVersion } from "../src/hello.js";

describe("Hello edge cases", () => {
  it("should handle empty string", () => {
    expect(greet("")).toBe("Hello, !");
  });

  it("should handle special characters", () => {
    expect(greet("José")).toBe("Hello, José!");
  });
});