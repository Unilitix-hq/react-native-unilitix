/**
 * The contract's crash fingerprint (sdk-contract.md "Crash fingerprint",
 * reference `internal/sdkcontract/fingerprint.go` in the api repo), computed
 * in JS for JS errors so iOS and Android group them identically.
 *
 * Native crash types (`SIGNAL`, `SIGNAL:<n>`) use the app-frames rule and
 * are fingerprinted by the native cores; {@link fingerprint} returns
 * `undefined` for them so the core computes the value.
 */

/* eslint-disable no-bitwise -- FNV-1a and UTF-8 encoding are bit operations */

/** Frames that feed the fingerprint (`SdkContract.fingerprintFrames`). */
const FRAMES = 3;

const appleFrameRe = /^\d+\s+(\S+)\s+0x[0-9a-fA-F]+\s+(.+?)(?:\s+\+\s+(\d+))?$/;
const dartFrameRe = /^#\d+\s+(.*)$/;
const dartVirtRe = /virt\s+([0-9a-f]+)/;
const dartLineRe = /:\d+(:\d+)?\)/g;
const spacesRe = /\s+/g;
const jsFrameRe = /^at\s+(.*?)\s*\((.*?)(?::\d+)+\)$/;
const jvmFrameRe = /^at\s+(.*?)\(([^:()]+)(?::\d+)?\)$/;
const trailLineRe = /:\d+(:\d+)?$/;

/** True for the native crash types the cores fingerprint themselves. */
export function isSignalType(type: string): boolean {
  return type === 'SIGNAL' || /^SIGNAL:\d+$/.test(type);
}

/**
 * One stack line in its fingerprint form, or null when the line is not a
 * frame (a message line, `<asynchronous suspension>`, a blank line).
 */
export function normaliseFrame(raw: string): string | null {
  const line = raw.trim();
  if (line === '') return null;
  let m = appleFrameRe.exec(line);
  if (m) {
    const image = m[1]!;
    const symbol = m[2]!.trim();
    if (symbol === image && m[3] !== undefined && m[3] !== '') {
      return `${image}+${m[3]}`;
    }
    return `${image} ${symbol}`;
  }
  m = dartFrameRe.exec(line);
  if (m) {
    const frame = m[1]!;
    const virt = dartVirtRe.exec(frame);
    if (virt) return `virt:${virt[1]}`;
    const noLine = frame.replace(dartLineRe, ')');
    if (noLine.startsWith('<asynchronous suspension>')) return null;
    return noLine.replace(spacesRe, ' ').trim();
  }
  m = jsFrameRe.exec(line);
  if (m) return `${m[1]} (${m[2]})`;
  m = jvmFrameRe.exec(line);
  if (m) return `${m[1]}(${m[2]})`;
  if (line.startsWith('at ')) {
    return line.slice(3).replace(trailLineRe, '').trim();
  }
  return null;
}

/** UTF-8 bytes of [s] (no TextEncoder in every JS engine RN supports). */
function utf8(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0x10000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f)
      );
    }
  }
  return out;
}

function fnv1a32(bytes: number[], seed: number): string {
  let h = seed >>> 0;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * `metadata.fingerprint` for an error of [type] with [stack]: 16 lowercase
 * hex characters, or `undefined` for native signal types.
 */
export function fingerprint(
  type: string,
  stack: string | null | undefined
): string | undefined {
  if (isSignalType(type)) return undefined;
  const parts = [type];
  if (stack) {
    for (const raw of stack.split('\n')) {
      if (parts.length > FRAMES) break;
      const f = normaliseFrame(raw);
      if (f !== null) parts.push(f);
    }
  }
  const bytes = utf8(parts.join('|'));
  return (
    fnv1a32(bytes, 0x811c9dc5) + fnv1a32(bytes, (0x811c9dc5 ^ 0x5bd1e995) >>> 0)
  );
}
