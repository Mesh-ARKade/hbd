# HBD Code Review Guidelines

Welcome, Devin. You are reviewing the **HBD (How 'Bout DAT!?)** project. This is a high-integrity "Genesis Seed" tool for the Mesh ARKade ecosystem, built on the Hyperstack (Hypercore/Hyperbee/Hyperswarm).

## 🛠️ Core Engineering Standards

Every PR MUST be evaluated against these non-negotiable standards:

1.  **TDD (Test-Driven Development)**: Every logic change must have a corresponding test. If a feature is added without a test, reject it.
2.  **The Beyoncé Rule**: "If you liked it, then you shoulda put a test on it." We mandate a **90% coverage gate** for all source modules.
3.  **EARS (Easy Approach to Requirements Syntax)**: All specifications and complex logic should follow the `When/While/If-Then` pattern.
4.  **Result Pattern**: HBD does NOT use generic `throws`. Core logic MUST return a `Result<T, E>` object (e.g., `{ ok: true, value: T } | { ok: false, error: E }`).
5.  **Structured Logging**: All significant events MUST be logged via `Pino` with metadata context (e.g., `sha1`, `system`).
6.  **DAMP Tests**: Tests should be Descriptive And Meaningful. Prioritize readability and self-contained logic over extreme deduplication.
7.  **SOLID & DRY**: Keep implementation code simple, decoupled, and minimal so other agents can easily reason about it.

## 🔍 Critical Areas for Scrutiny

-   **`src/storage/` (Hyperbee)**: Ensure every `put`, `get`, and `del` is correctly `await`-ed and handles the `opened` state. Verify that the "Master Record Merge" logic correctly de-duplicates sources.
-   **`src/identity/` (BIP39/OAuth)**: Check for deterministic key derivation. Ensure the 24-word mnemonic always produces the same P2P identity.
-   **`src/p2p/` (Hyperswarm)**: Watch for "Dangling Swarms." Every `SyncPeer` must be properly closed to release Windows file locks.
-   **`src/dashboard/`**: Ensure the UI assets are correctly found and served by Fastify. (Current issue: `"error": "Dashboard not built"`).

## ⚠️ Common Pitfalls

-   **ESM Extensions**: Node.js ESM mode REQUIRES `.js` extensions on all relative imports (e.g., `import { x } from "./file.js"`). If these are missing, the build will break.
-   **Windows File Locks**: Hypercore on Windows is aggressive. Ensure test cleanup utilities use retries or OS-native fallbacks.
-   **Type Safety**: Avoid using `any`. Ensure custom Error classes are used within the Result pattern.

## 🚫 Ignore

-   `node_modules/`, `dist/`, `coverage/`.
-   Temporary test directories matching `.hbd-*`.
-   `package-lock.json` unless dependencies were explicitly changed.

---

**Note to Devin**: We are currently building **Epic E2 (No-Intro Scraper)**. Ensure any new scrapers follow the `AbstractScraper` interface and use the streaming `ClrMameProParser`.
