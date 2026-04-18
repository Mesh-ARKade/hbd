import { z } from "zod";
/**
 * ROM metadata schema and validation.
 * @packageDocumentation
 * @intent Define and validate ROM metadata structures.
 * @guarantee All stored records conform to the schema.
 */
/**
 * Known DAT sources for ROM metadata.
 */
export declare const DAT_SOURCES: readonly ["no-intro", "redump", "tosec", "mame", "trurip", "goodtools"];
/**
 * Type for known DAT sources.
 */
export type DatSource = (typeof DAT_SOURCES)[number];
/**
 * ROM metadata schema.
 */
export declare const RomMetadataSchema: z.ZodObject<{
    /**
     * SHA1 hash of the ROM file (primary key).
     */
    sha1: z.ZodString;
    /**
     * CRC32 hash of the ROM file.
     */
    crc32: z.ZodString;
    /**
     * MD5 hash (optional, for compatibility).
     */
    md5: z.ZodOptional<z.ZodString>;
    /**
     * ROM name (often with region and version).
     */
    name: z.ZodString;
    /**
     * File size in bytes.
     */
    size: z.ZodNumber;
    /**
     * System/console the ROM is for.
     */
    system: z.ZodString;
    /**
     * Region (optional).
     */
    region: z.ZodOptional<z.ZodString>;
    /**
     * Version (optional).
     */
    version: z.ZodOptional<z.ZodString>;
    /**
     * Year of release (optional).
     */
    year: z.ZodOptional<z.ZodNumber>;
    /**
     * Publisher (optional).
     */
    publisher: z.ZodOptional<z.ZodString>;
    /**
     * Game ID within the DAT (optional).
     */
    gameId: z.ZodOptional<z.ZodString>;
    /**
     * List of sources that have this ROM.
     * Used for deduplication.
     */
    sources: z.ZodArray<z.ZodEnum<["no-intro", "redump", "tosec", "mame", "trurip", "goodtools"]>, "many">;
    /**
     * Additional metadata from source.
     */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    /**
     * Timestamp of last update.
     */
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sha1: string;
    crc32: string;
    name: string;
    size: number;
    system: string;
    sources: ("no-intro" | "redump" | "tosec" | "mame" | "trurip" | "goodtools")[];
    updatedAt: number;
    md5?: string | undefined;
    region?: string | undefined;
    version?: string | undefined;
    year?: number | undefined;
    publisher?: string | undefined;
    gameId?: string | undefined;
    metadata?: Record<string, string> | undefined;
}, {
    sha1: string;
    crc32: string;
    name: string;
    size: number;
    system: string;
    sources: ("no-intro" | "redump" | "tosec" | "mame" | "trurip" | "goodtools")[];
    updatedAt: number;
    md5?: string | undefined;
    region?: string | undefined;
    version?: string | undefined;
    year?: number | undefined;
    publisher?: string | undefined;
    gameId?: string | undefined;
    metadata?: Record<string, string> | undefined;
}>;
/**
 * Type for ROM metadata.
 */
/**
 * Type for ROM metadata.
 */
export type RomMetadata = {
    sha1: string;
    crc32: string;
    md5?: string;
    name: string;
    size: number;
    system: string;
    region?: string;
    version?: string;
    year?: number;
    publisher?: string;
    gameId?: string;
    sources: Array<typeof DAT_SOURCES[number]>;
    metadata?: Record<string, string>;
    updatedAt: number;
};
/**
 * Source reference schema.
 */
export declare const SourceRefSchema: z.ZodObject<{
    source: z.ZodEnum<["no-intro", "redump", "tosec", "mame", "trurip", "goodtools"]>;
    /**
     * Game ID within the source DAT.
     */
    gameId: z.ZodOptional<z.ZodString>;
    /**
     * Original filename from source.
     */
    filename: z.ZodOptional<z.ZodString>;
    /**
     * Any source-specific metadata.
     */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    source: "no-intro" | "redump" | "tosec" | "mame" | "trurip" | "goodtools";
    gameId?: string | undefined;
    metadata?: Record<string, string> | undefined;
    filename?: string | undefined;
}, {
    source: "no-intro" | "redump" | "tosec" | "mame" | "trurip" | "goodtools";
    gameId?: string | undefined;
    metadata?: Record<string, string> | undefined;
    filename?: string | undefined;
}>;
/**
 * Type for source reference.
 */
export type SourceRef = z.infer<typeof SourceRefSchema>;
/**
 * Index key schema for secondary lookups.
 */
export declare const IndexKeySchema: z.ZodObject<{
    /**
     * Index type.
     */
    type: z.ZodEnum<["crc32", "name", "system", "year"]>;
    /**
     * Indexed value.
     */
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    type: "crc32" | "name" | "system" | "year";
}, {
    value: string;
    type: "crc32" | "name" | "system" | "year";
}>;
/**
 * Type for index key.
 */
export type IndexKey = z.infer<typeof IndexKeySchema>;
/**
 * Validate ROM metadata.
 * @param data - Data to validate
 * @returns The validated metadata
 * @throws ZodError if validation fails
 */
export declare function validateRomMetadata(data: unknown): RomMetadata;
/**
 * Validate and return parsed ROM metadata, or null if invalid.
 * @param data - Data to validate
 * @returns The validated metadata or null
 */
export declare function safeValidateRomMetadata(data: unknown): RomMetadata | null;
/**
 * Get the primary index key for a ROM.
 * @param metadata - ROM metadata
 * @returns The SHA1 hash as the primary key
 */
export declare function getPrimaryKey(metadata: RomMetadata): string;
/**
 * Generate a secondary index key.
 * @param metadata - ROM metadata
 * @param indexType - Type of index
 * @returns The index key or null
 */
export declare function getIndexKey(metadata: RomMetadata, indexType: "crc32" | "name" | "system" | "year"): IndexKey | null;
//# sourceMappingURL=schema.d.ts.map