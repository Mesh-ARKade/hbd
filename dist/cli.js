#!/usr/bin/env node
/**
 * HBD CLI entry point.
 * @packageDocumentation
 * @intent Provide the command-line interface for HBD operations.
 * @guarantee Handle CLI arguments and route to appropriate commands.
 */
import * as readline from "node:readline";
import { getVersion } from "./index.js";
import { generateMnemonic, } from "./identity/bip39.js";
import { hasKeystore, getPublicKey, hasSecretKey, storeKeypairFromMnemonic, deleteKeystore, HBD_CONFIG_DIR, } from "./identity/keyStore.js";
import { login as githubLogin, whoami as githubWhoami, loadGitHubConfig, } from "./identity/github.js";
/**
 * Print a message to stdout.
 */
function log(message) {
    process.stdout.write(message + "\n");
}
/**
 * Print an error to stderr.
 */
function error(message) {
    process.stderr.write(message + "\n");
}
/**
 * Prompt for user input.
 */
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}
/**
 * Print version.
 */
function version() {
    log(getVersion());
}
/**
 * Print help.
 */
function help() {
    log(`
HBD - HomeBase Directory
Decentralized ROM metadata catalog using Hyperbee

Usage: hbd <command>

Commands:
  version     Print the version
  help       Print this help message
  init       Initialize a new HBD keystore with a BIP39 mnemonic
  status     Show current keystore and identity status
  login      Authenticate with GitHub (Device Flow)
  whoami     Show current GitHub identity
  logout     Clear GitHub identity cached locally
  delete     Delete the keystore (DANGER: Cannot be undone)

Environment:
  HBD_CONFIG_DIR    Path to config directory (default: ~/.hbd)
  HBD_GITHUB_CLIENT_ID    GitHub OAuth client ID
  HBD_GITHUB_CLIENT_SECRET  GitHub OAuth client secret

For more information, see https://github.com/Mesh-ARKade/hbd
`);
}
/**
 * Initialize a new keystore.
 */
async function init() {
    if (hasKeystore()) {
        const overwrite = await prompt("Keystore already exists. Overwrite? (y/N): ");
        if (overwrite.toLowerCase() !== "y") {
            log("Cancelled.");
            return;
        }
        deleteKeystore();
    }
    const mnemonic = generateMnemonic(128);
    log("Your recovery phrase (SAVE THIS!):");
    log("");
    log(mnemonic);
    log("");
    const confirm = await prompt("Enter your recovery phrase to confirm: ");
    if (confirm.trim() !== mnemonic.trim()) {
        error("Mnemonic does not match. Keystore not created.");
        return;
    }
    storeKeypairFromMnemonic(mnemonic);
    log("Keystore created successfully!");
    log(`Public key: ${getPublicKey()}`);
    log(`Directory: ${HBD_CONFIG_DIR}`);
}
/**
 * Show current status.
 */
function status() {
    const publicKey = getPublicKey();
    log("=== HBD Status ===");
    log(`Config directory: ${HBD_CONFIG_DIR}`);
    log(`Keystore: ${hasKeystore() ? "present" : "NOT FOUND"}`);
    if (publicKey) {
        log(`Public key: ${publicKey}`);
        log(`Seeder mode: ${hasSecretKey() ? "ENABLED" : "read-only"}`);
    }
    const identity = githubWhoami();
    if (identity) {
        log(`GitHub: ${identity.login}`);
        log(`Avatar: ${identity.avatarUrl}`);
    }
    else {
        log("GitHub: Not logged in");
    }
}
/**
 * GitHub login.
 */
async function login() {
    const config = loadGitHubConfig();
    if (!config.clientId) {
        error("GitHub Client ID not configured.");
        error("Set HBD_GITHUB_CLIENT_ID environment variable.");
        return;
    }
    status();
    const proceed = await prompt("Proceed with GitHub login? (y/N): ");
    if (proceed.toLowerCase() !== "y") {
        log("Cancelled.");
        return;
    }
    const identity = await githubLogin();
    log(`Logged in as ${identity.login}!`);
}
/**
 * Show GitHub identity.
 */
function whoami() {
    const identity = githubWhoami();
    if (!identity) {
        log("Not logged in. Run 'hbd login' to authenticate.");
        return;
    }
    log(`Login: ${identity.login}`);
    if (identity.name) {
        log(`Name: ${identity.name}`);
    }
    if (identity.email) {
        log(`Email: ${identity.email}`);
    }
    log(`Avatar: ${identity.avatarUrl}`);
}
/**
 * Clear cached GitHub identity.
 */
async function logout() {
    const identity = githubWhoami();
    if (!identity) {
        log("Not logged in.");
        return;
    }
    const confirm = await prompt(`Logout ${identity.login}? (y/N): `);
    if (confirm.toLowerCase() !== "y") {
        log("Cancelled.");
        return;
    }
    const { clearGitHubIdentity } = await import("./identity/github.js");
    clearGitHubIdentity();
    log("Logged out.");
}
/**
 * Delete keystore.
 */
async function deleteKeyStore() {
    if (!hasKeystore()) {
        log("No keystore to delete.");
        return;
    }
    const confirm = await prompt("DELETE KEYSTORE? This cannot be undone. Type 'DELETE': ");
    if (confirm !== "DELETE") {
        log("Cancelled.");
        return;
    }
    deleteKeystore();
    log("Keystore deleted.");
}
/**
 * Main CLI entry point.
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] ?? "help";
    switch (command) {
        case "version":
        case "-v":
        case "--version":
            version();
            break;
        case "help":
        case "-h":
        case "--help":
            help();
            break;
        case "init":
            await init();
            break;
        case "status":
            status();
            break;
        case "login":
            await login();
            break;
        case "whoami":
            whoami();
            break;
        case "logout":
            await logout();
            break;
        case "delete":
            await deleteKeyStore();
            break;
        default:
            error(`Unknown command: ${command}`);
            help();
            process.exit(1);
    }
}
main().catch((error) => {
    error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
//# sourceMappingURL=cli.js.map