import { describe, it, expect } from "vitest";
import { greet } from "../src/hello.js";

describe("greet() additional edge cases", () => {
  it("should handle single character", () => {
    expect(greet("A")).toBe("Hello, A!");
  });

  it("should handle unicode characters", () => {
    expect(greet("日本語")).toBe("Hello, 日本語!");
  });
});