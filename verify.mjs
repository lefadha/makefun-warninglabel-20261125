// verify.mjs -- the local mirror of the gate, plus the checks this entry adds.
//
// The gate says: /output/entry.txt is UTF-8 text of 1 to 160 characters, not
// only white space. This script runs main.ts twice into two separate
// directories from a working directory that is not the entry's, holds the
// output to that rule, and then holds it to the judge's own brief: one line
// that reads as a printed safety label for a human being, with the turn last.
//
//   node verify.mjs            # exit 0 only when every check passes

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0;
const fails = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS ${name}${detail ? " -- " + detail : ""}`);
  } else {
    fails.push(name);
    console.log(`FAIL ${name}${detail ? " -- " + detail : ""}`);
  }
}

const a = mkdtempSync(join(tmpdir(), "warn-a-"));
const b = mkdtempSync(join(tmpdir(), "warn-b-"));

function run(out) {
  // Run from / so a relative path can never be what makes it work.
  const stdout = execFileSync(process.execPath, [join(HERE, "main.ts")], {
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: out },
    cwd: "/",
    stdio: "pipe",
  }).toString();
  return { buf: readFileSync(join(out, "entry.txt")), stdout };
}

let bufA;
let bufB;
let saidA = "";
try {
  const first = run(a);
  const second = run(b);
  bufA = first.buf;
  bufB = second.buf;
  saidA = first.stdout;
} catch (e) {
  check("main.ts exits 0", false, String(e.stderr || e.message).trim().slice(0, 300));
  process.exit(1);
}
check("main.ts exits 0", true);
check(
  "main.ts reports the hash of the bytes it wrote",
  saidA.includes(createHash("sha256").update(bufA).digest("hex").slice(0, 16)),
  saidA.trim(),
);

check("writes exactly entry.txt", existsSync(join(a, "entry.txt")));
check("two runs are byte-identical", Buffer.compare(bufA, bufB) === 0, `${bufA.length} B`);

const raw = bufA;
check("no byte-order mark", !(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf));
check("no carriage return", !raw.includes(0x0d));
check("no trailing newline", raw[raw.length - 1] !== 0x0a);

let text = "";
try {
  text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  check("valid UTF-8", true, `${Buffer.byteLength(text, "utf8")} B`);
} catch {
  check("valid UTF-8", false);
}

const chars = Array.from(text).length;
check("1 to 160 characters", chars >= 1 && chars <= 160, `${chars} characters`);
check("not only white space", text.trim().length > 0);
check("no control characters", !/[\u0000-\u001f\u007f]/.test(text));
check("one line", !text.includes("\n") && !text.includes("\r"));
check("under 160 bytes, so no reader truncates it", Buffer.byteLength(text, "utf8") <= 160, `${Buffer.byteLength(text, "utf8")} B`);

// The entry's own promise, from the judge's brief in RULES.txt.
check("opens on warning-label furniture", /^(WARNING|CAUTION|DANGER|NOTICE|SAFETY|ADVISORY|ALLERGY ADVICE)\b/.test(text), text.split(":")[0]);
check("names a hazard or an instruction, not a scene", /^(WARNING|CAUTION|DANGER|NOTICE|SAFETY|ADVISORY|ALLERGY ADVICE)/.test(text) && /[.!?]$/.test(text));
check("ends on the turn, not on an explanation", /[.!?]$/.test(text), text.split(/(?<=[.!?])\s+/).slice(-1)[0]);
check("at most two sentences, so one idea", (text.match(/[.!?]/g) ?? []).length <= 2, `${(text.match(/[.!?]/g) ?? []).length} stops`);
check("no run of white space inside the line", !/\s{2,}/.test(text));
check("no trailing space for the gate to trim", text === text.trimEnd());
check("is not an address to the judge", !/\bjudge\b|\bentry A\b|\bpick me\b/i.test(text));

rmSync(a, { recursive: true, force: true });
rmSync(b, { recursive: true, force: true });

console.log(`\n${pass} pass, ${fails.length} fail`);
if (fails.length) {
  console.log("failed: " + fails.join(", "));
  process.exit(1);
}
console.log("entry.txt:\n  " + text);
