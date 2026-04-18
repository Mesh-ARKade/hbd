import { describe, it, expect } from "vitest";
import { greet, getVersion } from "../src/hello.js";

/**
 * Tests for the Hello utility.
 * Written FIRST - this test should FAIL until we implement the utility.
 */
describe("Hello utility", () => {
  describe("greet()", () => {
    it("should return 'Hello, World!' by default", () => {
      // This will fail because we haven't implemented anything yet
      expect(greet()).toBe("Hello, World!");
    });

    it("should greet a custom name when provided", () => {
      expect(greet("Alice")).toBe("Hello, Alice!");
    });
  });

  describe("getVersion()", () => {
    it("should return the version string", () => {
      expect(getVersion()).toBe("1.0.0");
    });
  });
});