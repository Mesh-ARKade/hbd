/**
 * HomeBase Directory (HBD) - Decentralized ROM metadata catalog using Hyperbee.
 * @packageDocumentation
 *
 * {@label intent}Provide the primary entry point for the HBD application.
 * {@label guarantee}Returns the version string from package.json.
 */
export function getVersion() {
    return "1.0.0";
}
// Re-export key modules
export { createMetadataStore, MetadataStore } from "./storage/hyperbee.js";
export { createIndexedStore, IndexedMetadataStore } from "./storage/indexed.js";
export { createP2PSync, P2PSync } from "./p2p/sync.js";
export { validateRomMetadata, DAT_SOURCES } from "./storage/schema.js";
//# sourceMappingURL=index.js.map