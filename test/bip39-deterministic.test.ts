import { describe, it, expect } from "vitest";
import { deriveKeyPair } from "../src/identity/bip39.js";
import { isOk } from "../src/core/result.js";

/**
 * Tests for BIP39 deterministic key derivation.
 * Updated to use Result-based async interface.
 */
describe("deriveKeyPair deterministic derivation (Result-based)", () => {
  it("should derive the SAME public key from the same generated mnemonic every time", async () => {
    const genResult = await import("../src/identity/bip39.js").then(m => m.generateMnemonic(128));
    const mnemonic = genResult.value;
    
    const result1 = await deriveKeyPair(mnemonic);
    const result2 = await deriveKeyPair(mnemonic);
    const result3 = await deriveKeyPair(mnemonic);
    
    expect(isOk(result1)).toBe(true);
    expect(result1.value.publicKey.toString("hex")).toBe(result2.value.publicKey.toString("hex"));
    expect(result2.value.publicKey.toString("hex")).toBe(result3.value.publicKey.toString("hex"));
  });

  it("should derive DIFFERENT keys from 128-bit vs 256-bit entropy", async () => {
    // Use different entropy sizes for different keys
    const gen1 = await import("../src/identity/bip39.js").then(m => m.generateMnemonic(128));
    const gen2 = await import("../src/identity/bip39.js").then(m => m.generateMnemonic(256));
    
    const result1 = await deriveKeyPair(gen1.value);
    const result2 = await deriveKeyPair(gen2.value);
    
    expect(isOk(result1)).toBe(true);
    expect(isOk(result2)).toBe(true);
    expect(result1.value.publicKey.toString("hex")).not.toBe(result2.value.publicKey.toString("hex"));
  });

  it("should produce a valid 32-byte public key", async () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const result = await deriveKeyPair(mnemonic);
    
    expect(isOk(result)).toBe(true);
    // Ed25519 public key should be 32 bytes
    expect(result.value.publicKey.length).toBe(32);
  });

  it("should produce a valid 32-byte private key", async () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const result = await deriveKeyPair(mnemonic);
    
    expect(isOk(result)).toBe(true);
    // Ed25519 private key should be 32 bytes
    expect(result.value.privateKey.length).toBe(32);
  });
});