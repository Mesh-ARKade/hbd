import { describe, it, expect } from "vitest";
import { deriveKeyPair } from "../src/identity/bip39.js";

/**
 * Tests for BIP39 deterministic key derivation.
 * We need the SAME public key EVERY TIME from the SAME mnemonic.
 */
describe("deriveKeyPair deterministic derivation", () => {
  it("should derive the SAME public key from the same mnemonic every time", () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    
    const keyPair1 = deriveKeyPair(mnemonic);
    const keyPair2 = deriveKeyPair(mnemonic);
    const keyPair3 = deriveKeyPair(mnemonic);
    
    // All should be identical
    expect(keyPair1.publicKey.toString("hex")).toBe(keyPair2.publicKey.toString("hex"));
    expect(keyPair2.publicKey.toString("hex")).toBe(keyPair3.publicKey.toString("hex"));
  });

  it("should derive DIFFERENT keys from DIFFERENT mnemonics", () => {
    const mnemonic1 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const mnemonic2 = "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo";
    
    const keyPair1 = deriveKeyPair(mnemonic1);
    const keyPair2 = deriveKeyPair(mnemonic2);
    
    expect(keyPair1.publicKey.toString("hex")).not.toBe(keyPair2.publicKey.toString("hex"));
  });

  it("should produce a valid 32-byte public key", () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const keyPair = deriveKeyPair(mnemonic);
    
    // Ed25519 public key should be 32 bytes
    expect(keyPair.publicKey.length).toBe(32);
  });

  it("should produce a valid 32-byte private key", () => {
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const keyPair = deriveKeyPair(mnemonic);
    
    // Ed25519 private key should be 32 bytes
    expect(keyPair.privateKey.length).toBe(32);
  });
});