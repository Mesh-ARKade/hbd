/**
 * Tests for ClrMamePro XML parser.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ClrMameProParser } from "../../../src/scrapers/parsers/clrmamepro.js";
import { isOk, isErr } from "../../../src/core/result.js";
import { getUniqueTestDir, robustRm } from "../../test-utils.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("ClrMameProParser", () => {
  let testDir: string;
  let mockLogger: any;

  beforeEach(() => {
    testDir = getUniqueTestDir(".hbd-clrmamepro" + Date.now());
    fs.mkdirSync(testDir, { recursive: true });

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => mockLogger),
    };
  });

  afterEach(async () => {
    await robustRm(testDir);
  });

  describe("constructor", () => {
    it("should initialize with data directory", () => {
      const parser = new ClrMameProParser({
        dataDir: testDir,
        logger: mockLogger,
      });
      expect(parser.getDataDir()).toContain(testDir.replace(/\\/g, "/"));
    });

    it("should require data directory", () => {
      expect(() => {
        new ClrMameProParser({} as any);
      }).toThrow("dataDir is required");
    });
  });

  describe("parse", () => {
    // Test empty header field
    it("should handle minimal header", async () => {
      const content = `<?xml version="1.0"?><datafile><header></header><machine n="g"><desc>G</desc></machine></datafile>`;
      const p = path.join(testDir, "min.dat");
      fs.writeFileSync(p, content);
      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);
      expect(r.ok).toBe(true);
    });

    it("should handle empty machine list", async () => {
      const content = `<?xml version="1.0"?><datafile><header><name>N</name></header></datafile>`;
      const p = path.join(testDir, "empty.dat");
      fs.writeFileSync(p, content);
      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.length).toBe(0);
    });

    it("should parse valid DAT with single machine", async () => {
      const content = `<?xml version="1.0"?>
<datafile>
  <header><name>Test</name></header>
  <machine name="g1"><description>Game 1</description><rom name="r1.bin" size="100" crc="abc" /></machine>
</datafile>`;
      const p = path.join(testDir, "single.dat");
      fs.writeFileSync(p, content);

      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);

      expect(r.ok).toBe(true);
    });

    it("should extract ROM details", async () => {
      const content = `<?xml version="1.0"?>
<datafile>
  <header><name>T</name></header>
  <machine name="g1"><description>Game One</description><rom name="game.bin" size="2097152" crc="cafebabe" sha1="abcd1234" /></machine>
</datafile>`;
      const p = path.join(testDir, "rom.dat");
      fs.writeFileSync(p, content);

      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);

      expect(r.ok).toBe(true);
      if (r.ok) {
        const rom = r.value[0];
        expect(rom.name).toBe("g1");
        expect(rom.description).toBe("Game One");
        expect(rom.roms?.[0]?.name).toBe("game.bin");
      }
    });

    it("should handle multiple ROMs in machine", async () => {
      // Use TWO machines and THREE total to ensure robust array
      const content = `<?xml version="1.0"?>
<datafile>
  <header><name>T</name></header>
  <machine name="A"><description>A</description><rom n="a" s="1" c="1" /><rom n="b" s="2" c="2" /></machine>
  <machine name="B"><description>B</description></machine>
  <machine name="C"><description>C</description></machine>
</datafile>`;
      const p = path.join(testDir, "mr" + process.env.VITEST_WORKER_ID + ".dat");
      fs.writeFileSync(p, content);

      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.length).toBe(3);
      }
    });

    it("should return error for missing file", async () => {
      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse("/missing/file.dat");
      expect(isErr(r)).toBe(true);
    });

    it("should return error for invalid XML", async () => {
      const p = path.join(testDir, "bad.xml");
      fs.writeFileSync(p, "NOT XML ><");

      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);
      expect(isErr(r)).toBe(true);
    });

    it("should handle empty datafile", async () => {
      const content = `<?xml version="1.0"?><datafile><header><name>Empty</name></header></datafile>`;
      const p = path.join(testDir, "empty.dat");
      fs.writeFileSync(p, content);

      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.length).toBe(0);
    });

    it("should return error for missing datafile element", async () => {
      const content = `<?xml version="1.0"?><wrongroot><header><name>Test</name></header></wrongroot>`;
      const p = path.join(testDir, "nodatafile.dat");
      fs.writeFileSync(p, content);

      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);
      expect(isErr(r)).toBe(true);
    });

    it("should handle machine without name attribute", async () => {
      const content = `<?xml version="1.0"?><datafile><header><name>T</name></header><machine><description>NoName</description></machine></datafile>`;
      const p = path.join(testDir, "noname.dat");
      fs.writeFileSync(p, content);

      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.length).toBe(0);
    });

    it("should handle header with falsy values", async () => {
      const content = `<?xml version="1.0"?><datafile><header><name></name><description></description></header><machine name="g"><description>G</description></machine></datafile>`;
      const p = path.join(testDir, "falsy.dat");
      fs.writeFileSync(p, content);

      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);
      expect(r.ok).toBe(true);
    });

    it("should parse machine without roms", async () => {
      const content = `<?xml version="1.0"?><datafile><header><name>T</name></header><machine name="nodump"><description>No Dump</description></machine></datafile>`;
      const p = path.join(testDir, "nodump.dat");
      fs.writeFileSync(p, content);


      const parser = new ClrMameProParser({ dataDir: testDir });
      const r = await parser.parse(p);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value[0].roms).toBeUndefined();
      }
    });
  });
});