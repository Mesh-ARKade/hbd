import { describe, it, expect } from "vitest";
import { generateMnemonic, validateMnemonic, mnemonicToSeed, deriveKeyPair } from "../src/identity/bip39.js";

/**
 * Tests for BIP39 mnemonic generation and recovery.
 * Written FIRST - these tests should FAIL until we implement the BIP39 service.
 */
describe("BIP39 identity service", () => {
  describe("generateMnemonic()", () => {
    it("should generate a 12-word mnemonic (128 bits)", () => {
      const mnemonic = generateMnemonic(128);
      const words = mnemonic.split(" ");
      expect(words.length).toBe(12);
    });

    it("should generate a 24-word mnemonic (256 bits)", () => {
      const mnemonic = generateMnemonic(256);
      const words = mnemonic.split(" ");
      expect(words.length).toBe(24);
    });

    it("should throw on invalid strength", () => {
      expect(() => generateMnemonic(64)).toThrow();
    });
  });

  describe("validateMnemonic()", () => {
    it("should return true for valid mnemonic", () => {
      const mnemonic = generateMnemonic(128);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    it("should return false for invalid phrase", () => {
      expect(validateMnemonic("invalid phrase")).toBe(false);
    });
  });

  describe("mnemonicToSeed()", () => {
    it("should derive seed from mnemonic", () => {
      const mnemonic = generateMnemonic(128);
      const seed = mnemonicToSeed(mnemonic);
      expect(seed).toBeDefined();
      expect(seed.length).toBeGreaterThan(0);
    });
  });

  describe("deriveKeyPair()", () => {
    it("should derive keypair from mnemonic", () => {
      const mnemonic = generateMnemonic(128);
      const keyPair = deriveKeyPair(mnemonic);
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
    });

    it("should derive same keypair from same mnemonic", () => {
      const mnemonic = generateMnemonic(128);
      const kp1 = deriveKeyPair(mnemonic);
      const kp2 = deriveKeyPair(mnemonic);
      expect(kp1.publicKey).toEqual(kp2.publicKey);
    });
  });
});