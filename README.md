# HBD (How 'Bout DAT!?)

**HBD** is the administrative "Genesis Seed" tool for the **Mesh ARKade** ecosystem. It is responsible for fetching, normalizing, and seeding museum-quality game preservation metadata (DATs) to the decentralized P2P swarm.

## 🚀 Overview

HBD gathers metadata from authoritative sources like No-Intro, Redump, TOSEC, and MAME, merging them into a single, high-trust Hyperbee catalog. This catalog is then broadcast via Hyperswarm, allowing Mesh ARKade nodes to replicate the genesis seed without centralized servers.

## ✨ Key Features

- **P2P-First Storage**: Built on the Hyperstack (Hypercore + Hyperbee) for native replication and persistence.
- **Deterministic Identity**: BIP39 Mnemonic-based key derivation ensures a persistent P2P identity across machines.
- **High-Trust Curation**: GitHub OAuth integration provides an auditable trail for all metadata merges.
- **Secondary Indexing**: Fast lookups by SHA1, CRC32, and normalized ROM names.
- **Single-Writer Model**: Simplified P2P architecture where HBD acts as the canonical source for the Mesh ARKade swarm.

## 🛠️ Engineering Standards

HBD is built with extreme technical integrity:
- **TDD (Test-Driven Development)**: 100% of logic is born from failing tests.
- **Quality Gate**: Minimum **90% test coverage** enforced via Vitest.
- **EARS Method**: Unambiguous requirements syntax for all specifications.
- **SOLID & DRY**: Simplified, maintainable architecture for long-term collaboration.

## 📦 Installation & Usage

```bash
# Clone the repository
git clone https://github.com/Mesh-ARKade/hbd.git
cd hbd

# Install dependencies
npm install

# Run tests with coverage
npm run test:coverage

# Initialize HBD identity
node dist/cli.js init
```

## 📜 License

MIT © [Mesh ARKade](https://github.com/Mesh-ARKade)
