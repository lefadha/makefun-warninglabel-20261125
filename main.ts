// Warning Label for Humans -- make.fun entry.
//
// The line lives in LINE.txt beside this file, so the program reads the same
// bytes whether the grader runs it from /bot, from a read-only copy, or from
// somewhere else entirely: nothing here depends on the working directory.
//
// The gate's rule is small and exact -- /output/entry.txt is UTF-8 text of 1 to
// 160 characters, not only white space -- so this file holds the line to it
// before a single byte reaches the output: no byte-order mark, no control
// characters, one line, no newline smuggled onto the end, and the count taken
// in code points the way a reader counts rather than in UTF-16 units.
//
// It also holds the line to the judge's own first criterion, which is a gate in
// practice: a line that is not a safety warning label for a human being loses
// to any line that is. So the label must open on label furniture, be one
// sentence of instruction or hazard, and stop inside the brief's 160.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_CHARS = 160;
const MIN_CHARS = 1;

const SOURCE = join(HERE, "LINE.txt");
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ? resolve(process.env.MAKEFUN_OUTPUT_DIR) : "/output";

// The heads a printed safety label actually uses. Criterion 1 of the brief is a
// gate, so the entry refuses to ship a line that would read as a quip instead.
const HEADS = /^(WARNING|CAUTION|DANGER|NOTICE|SAFETY|ADVISORY|ALLERGY ADVICE)\b/;

function refuse(why: string): never {
  // Nothing is written when the line would fail the gate: a loud missing entry
  // is better than a silent invalid one.
  process.stderr.write(`entry.txt not written: ${why}\n`);
  process.exit(1);
}

// Collect every fault, so one run tells the whole story.
function faults(text: string): string[] {
  const found: string[] = [];
  if (text.includes("\r")) found.push("LINE.txt holds a carriage return");
  if (text.endsWith("\n") || text.endsWith(" ")) found.push("LINE.txt ends with white space the gate would count");
  if (text.includes("\n")) found.push("LINE.txt holds more than one line");
  if (text.trim().length === 0) found.push("LINE.txt is empty or only white space");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(text)) found.push("LINE.txt holds a control character");
  const chars = Array.from(text).length;
  if (chars < MIN_CHARS || chars > MAX_CHARS) {
    found.push(`line is ${chars} characters, the gate allows ${MIN_CHARS} to ${MAX_CHARS}`);
  }
  // The brief's own shape, not the gate's: it has to read as label furniture,
  // not as a joke wearing a label as a hat.
  if (!HEADS.test(text)) found.push("the line does not open on warning-label furniture");
  // Criterion 1 must be true of the words as well as the form: the label has to
  // be about a human being, so the line has to name one inside the 160.
  if (!/\b(human|humans|people|person)\b/i.test(text)) {
    found.push("the line never names the human the label is printed on");
  }
  if (!/[.!?]$/.test(text)) found.push("the line does not end on terminal punctuation");
  if ((text.match(/[.!?]/g) ?? []).length > 3) found.push("the line runs to more than three sentences");
  if (/\s{2,}/.test(text)) found.push("the line holds a run of white space");
  if (chars > 140) found.push(`the line is ${chars} characters: past 140 the turn has to travel too far to land`);
  return found;
}

const raw = readFileSync(SOURCE);

if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
  refuse("LINE.txt starts with a UTF-8 byte-order mark");
}

let text: string;
try {
  text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
} catch {
  refuse("LINE.txt is not valid UTF-8");
}

const bad = faults(text);
if (bad.length) refuse(bad.join("; "));

mkdirSync(OUT_DIR, { recursive: true });
const target = join(OUT_DIR, "entry.txt");
writeFileSync(target, text, "utf8");

// Read it back: the bytes the judge reads are the bytes that were checked.
const written = readFileSync(target, "utf8");
if (written !== text) refuse("entry.txt did not read back as it was written");
if (Buffer.byteLength(written, "utf8") !== Buffer.byteLength(text, "utf8")) {
  refuse("entry.txt changed size on the way to disk");
}

process.stdout.write(
  `wrote ${target}: ${Array.from(written).length} characters, ${Buffer.byteLength(written, "utf8")} bytes, ` +
    `sha256 ${createHash("sha256").update(written, "utf8").digest("hex").slice(0, 16)}\n`,
);
