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
export const DAT_SOURCES = [
    "no-intro",
    "redump",
    "tosec",
    "mame",
    "trurip",
    "goodtools",
];
/**
 * ROM metadata schema.
 */
export const RomMetadataSchema = z.object({
    /**
     * SHA1 hash of the ROM file (primary key).
     */
    sha1: z.string().length(40),
    /**
     * CRC32 hash of the ROM file.
     */
    crc32: z.string().length(8),
    /**
     * MD5 hash (optional, for compatibility).
     */
    md5: z.string().length(32).optional(),
    /**
     * ROM name (often with region and version).
     */
    name: z.string().min(1),
    /**
     * File size in bytes.
     */
    size: z.number().int().positive(),
    /**
     * System/console the ROM is for.
     */
    system: z.string().min(1),
    /**
     * Region (optional).
     */
    region: z.string().optional(),
    /**
     * Version (optional).
     */
    version: z.string().optional(),
    /**
     * Year of release (optional).
     */
    year: z.number().int().min(1970).max(2100).optional(),
    /**
     * Publisher (optional).
     */
    publisher: z.string().optional(),
    /**
     * Game ID within the DAT (optional).
     */
    gameId: z.string().optional(),
    /**
     * List of sources that have this ROM.
     * Used for deduplication.
     */
    sources: z.array(z.enum(DAT_SOURCES)).min(1),
    /**
     * Additional metadata from source.
     */
    metadata: z.record(z.string()).optional(),
    /**
     * Timestamp of last update.
     */
    updatedAt: z.number().int(),
});
/**
 * Source reference schema.
 */
export const SourceRefSchema = z.object({
    source: z.enum(DAT_SOURCES),
    /**
     * Game ID within the source DAT.
     */
    gameId: z.string().optional(),
    /**
     * Original filename from source.
     */
    filename: z.string().optional(),
    /**
     * Any source-specific metadata.
     */
    metadata: z.record(z.string()).optional(),
});
/**
 * Index key schema for secondary lookups.
 */
export const IndexKeySchema = z.object({
    /**
     * Index type.
     */
    type: z.enum(["crc32", "name", "system", "year"]),
    /**
     * Indexed value.
     */
    value: z.string(),
});
/**
 * Validate ROM metadata.
 * @param data - Data to validate
 * @returns The validated metadata
 * @throws ZodError if validation fails
 */
export function validateRomMetadata(data) {
    const result = RomMetadataSchema.safeParse(data);
    if (!result.success) {
        throw result.error;
    }
    return result.data;
}
/**
 * Validate and return parsed ROM metadata, or null if invalid.
 * @param data - Data to validate
 * @returns The validated metadata or null
 */
export function safeValidateRomMetadata(data) {
    const result = RomMetadataSchema.safeParse(data);
    return result.success ? result.data : null;
}
/**
 * Get the primary index key for a ROM.
 * @param metadata - ROM metadata
 * @returns The SHA1 hash as the primary key
 */
export function getPrimaryKey(metadata) {
    return metadata.sha1;
}
/**
 * Generate a secondary index key.
 * @param metadata - ROM metadata
 * @param indexType - Type of index
 * @returns The index key or null
 */
export function getIndexKey(metadata, indexType) {
    switch (indexType) {
        case "crc32":
            return { type: "crc32", value: metadata.crc32 };
        case "name":
            return { type: "name", value: metadata.name.toLowerCase() };
        case "system":
            return { type: "system", value: metadata.system };
        case "year":
            return {
                type: "year",
                value: metadata.year?.toString() ?? "",
            };
        default:
            return null;
    }
}
//# sourceMappingURL=schema.js.map