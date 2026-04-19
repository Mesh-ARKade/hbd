import { describe, it, expect } from "vitest";
import { generateMnemonic, validateMnemonic, mnemonicToSeed, deriveKeyPair } from "../src/identity/bip39.js";
import { isOk } from "../src/core/result.js";

/**
 * Tests for BIP39 mnemonic generation and recovery.
 * Updated to use Result-based async interface.
 */
describe("BIP39 identity service (Result-based)", () => {
  describe("generateMnemonic()", () => {
    it("should generate a 12-word mnemonic (128 bits)", async () => {
      const result = await generateMnemonic(128);
      expect(isOk(result)).toBe(true);
      const words = result.value.split(" ");
      expect(words.length).toBe(12);
    });

    it("should generate a 24-word mnemonic (256 bits)", async () => {
      const result = await generateMnemonic(256);
      expect(isOk(result)).toBe(true);
      const words = result.value.split(" ");
      expect(words.length).toBe(24);
    });

    it("should return error on invalid strength", async () => {
      const result = await generateMnemonic(64 as any);
      expect(result.ok).toBe(false);
    });
  });

  describe("validateMnemonic()", () => {
    it("should return true for valid mnemonic", async () => {
      const genResult = await generateMnemonic(128);
      const result = await validateMnemonic(genResult.value);
      expect(isOk(result)).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should return false for invalid phrase", async () => {
      const result = await validateMnemonic("invalid phrase");
      expect(isOk(result)).toBe(true);
      expect(result.value).toBe(false);
    });
  });

  describe("mnemonicToSeed()", () => {
    it("should derive seed from mnemonic", async () => {
      const genResult = await generateMnemonic(128);
      const result = await mnemonicToSeed(genResult.value);
      expect(isOk(result)).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.length).toBeGreaterThan(0);
    });
  });

  describe("deriveKeyPair()", () => {
    it("should derive keypair from mnemonic", async () => {
      const genResult = await generateMnemonic(128);
      const result = await deriveKeyPair(genResult.value);
      expect(isOk(result)).toBe(true);
      expect(result.value.publicKey).toBeDefined();
      expect(result.value.privateKey).toBeDefined();
    });

    it("should derive same keypair from same mnemonic", async () => {
      const genResult = await generateMnemonic(128);
      const kp1 = await deriveKeyPair(genResult.value);
      const kp2 = await deriveKeyPair(genResult.value);
      expect(kp1.value.publicKey.equals(kp2.value.publicKey)).toBe(true);
    });
  });
});