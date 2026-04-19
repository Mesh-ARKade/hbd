import { describe, it, expect } from 'vitest'
import { 
  generateMnemonic, 
  validateMnemonic, 
  mnemonicToSeed,
  deriveKeyPair,
  GenerateMnemonicError,
  ValidateMnemonicError,
  MnemonicToSeedError,
  DeriveKeyPairError
} from '../src/identity/bip39'
import { isOk, isErr } from '../src/core/result'

describe('bip39 Result Refactor', () => {
  describe('generateMnemonic', () => {
    it('should return Result with mnemonic on success', async () => {
      const result = await generateMnemonic(128)
      expect(isOk(result)).toBe(true)
      expect(result.value).toMatch(/\w+/)

      const result24 = await generateMnemonic(256)
      expect(isOk(result24)).toBe(true)
      expect(result24.value).toMatch(/\w+/)
    })

    it('should return error for invalid strength', async () => {
      const result = await generateMnemonic(512 as any)
      expect(isErr(result)).toBe(true)
      expect(result.error).toBeInstanceOf(GenerateMnemonicError)
    })
  })

  describe('validateMnemonic', () => {
    it('should return Result with true for valid mnemonic', async () => {
      const genResult = await generateMnemonic(128)
      const mnemonic = genResult.value

      const result = await validateMnemonic(mnemonic)
      expect(isOk(result)).toBe(true)
      expect(result.value).toBe(true)
    })

    it('should return Result with false for invalid mnemonic', async () => {
      const result = await validateMnemonic('invalid mnemonic words here')
      expect(isOk(result)).toBe(true)
      expect(result.value).toBe(false)
    })

    it('should return error for non-string input', async () => {
      const result = await validateMnemonic(null as any)
      expect(isErr(result)).toBe(true)
      expect(result.error).toBeInstanceOf(ValidateMnemonicError)
    })
  })

  describe('mnemonicToSeed', () => {
    it('should return Result with seed buffer on success', async () => {
      const genResult = await generateMnemonic(128)
      const result = await mnemonicToSeed(genResult.value)
      expect(isOk(result)).toBe(true)
      expect(Buffer.isBuffer(result.value)).toBe(true)
      expect(result.value.length).toBe(64)
    })

    it('should return error for invalid mnemonic', async () => {
      const result = await mnemonicToSeed('invalid')
      expect(isErr(result)).toBe(true)
      expect(result.error).toBeInstanceOf(MnemonicToSeedError)
    })
  })

  describe('deriveKeyPair', () => {
    it('should return Result with KeyPair on success', async () => {
      const genResult = await generateMnemonic(128)
      const result = await deriveKeyPair(genResult.value)
      
      expect(isOk(result)).toBe(true)
      expect(Buffer.isBuffer(result.value.publicKey)).toBe(true)
      expect(Buffer.isBuffer(result.value.privateKey)).toBe(true)
    })

    it('should return same KeyPair for same mnemonic (deterministic)', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const result1 = await deriveKeyPair(mnemonic)
      const result2 = await deriveKeyPair(mnemonic)
      
      expect(result1.value.publicKey.equals(result2.value.publicKey)).toBe(true)
      expect(result1.value.privateKey.equals(result2.value.privateKey)).toBe(true)
    })

    it('should return error for invalid mnemonic', async () => {
      const result = await deriveKeyPair('invalid')
      expect(isErr(result)).toBe(true)
      expect(result.error).toBeInstanceOf(DeriveKeyPairError)
    })
  })
})