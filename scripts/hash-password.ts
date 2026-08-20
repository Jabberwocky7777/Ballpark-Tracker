/**
 * Generates the argon2id hash for ADMIN_PASSWORD_HASH, and a SESSION_SECRET.
 *
 *   npm run hash-password
 *
 * The password is read from stdin rather than argv so it never lands in shell
 * history or a process list. Neither value is written to disk -- paste them
 * into the app wizard's env section and keep a copy in a password manager.
 */
import { hash } from "@node-rs/argon2";

/** Argon2id. See the note in lib/auth.ts about the ambient const enum. */
const ARGON2ID = 2;
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stderr });
const password = (await rl.question("Admin password: ")).trim();
rl.close();

if (password.length < 12) {
  console.error("\nToo short. Use at least 12 characters -- this is the only lock behind the network.");
  process.exit(1);
}

// OWASP-recommended argon2id parameters: 19 MiB, 2 iterations, parallelism 1.
const digest = await hash(password, {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

console.log(`\nADMIN_PASSWORD_HASH=${digest}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString("base64")}`);
console.log(`\nPaste both into the app wizard. Do not commit them.`);
