// Contract matcher for the behaviour fixtures (README.md "Matchers", next
// to the fixtures). A failed match throws an Error naming the JSON path.
import {
  substitute,
  type JsonValue,
} from '../../../generated/behaviourFixtures';

export type Captures = Map<string, unknown>;

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const RFC3339_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const ABSENT = Symbol('absent');
type Actual = unknown | typeof ABSENT;

function fail(path: string, msg: string): never {
  throw new Error(`${path || '$'}: ${msg}`);
}

function show(v: Actual): string {
  if (v === ABSENT) return '<absent>';
  const s = JSON.stringify(v);
  return s === undefined
    ? String(v)
    : s.length > 120
      ? s.slice(0, 117) + '...'
      : s;
}

function jsonType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function isOperator(e: JsonValue): e is { [k: string]: JsonValue } {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  const keys = Object.keys(e);
  return keys.length > 0 && keys.every((k) => k.startsWith('$'));
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) =>
        deepEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k]
        )
      )
    );
  }
  return false;
}

function sentinel(s: string, actual: Actual, path: string): void {
  const ok = (() => {
    switch (s) {
      case '<any>':
        return actual !== ABSENT;
      case '<absent>':
        return actual === ABSENT;
      case '<empty>':
        return actual === ABSENT || actual === null || actual === '';
      case '<uuid>':
        return typeof actual === 'string' && UUID_RE.test(actual);
      case '<timestamp>':
        return typeof actual === 'string' && RFC3339_RE.test(actual);
      case '<fingerprint>':
        return typeof actual === 'string' && /^[0-9a-f]{16}$/.test(actual);
      case '<string>':
        return typeof actual === 'string';
      case '<number>':
        return typeof actual === 'number';
      case '<bool>':
        return typeof actual === 'boolean';
      case '<object>':
        return jsonType(actual) === 'object';
      case '<array>':
        return Array.isArray(actual);
      default:
        return fail(path, `unknown sentinel ${s} (fixture error)`);
    }
  })();
  if (!ok) fail(path, `expected ${s}, got ${show(actual)}`);
}

function operators(
  e: { [k: string]: JsonValue },
  actual: Actual,
  captures: Captures,
  path: string
): void {
  for (const [op, arg] of Object.entries(e)) {
    if (op === '$capture') continue;
    switch (op) {
      case '$match':
        match(arg, actual, captures, path);
        break;
      case '$eq':
        if (!captures.has(arg as string)) fail(path, `no capture ${arg}`);
        if (
          actual === ABSENT ||
          !deepEqual(actual, captures.get(arg as string))
        )
          fail(
            path,
            `expected = ${arg} (${show(captures.get(arg as string))}), got ${show(actual)}`
          );
        break;
      case '$ne':
        if (actual === ABSENT) fail(path, `expected present (≠ ${arg})`);
        if (deepEqual(actual, captures.get(arg as string)))
          fail(path, `expected ≠ ${arg}, got ${show(actual)}`);
        break;
      case '$size': {
        const n = Array.isArray(actual)
          ? actual.length
          : actual && typeof actual === 'object'
            ? Object.keys(actual).length
            : -1;
        if (n !== arg) fail(path, `expected size ${arg}, got ${n}`);
        break;
      }
      case '$length':
        if (typeof actual !== 'string' || actual.length !== arg)
          fail(path, `expected string of length ${arg}, got ${show(actual)}`);
        break;
      case '$repeat': {
        const r = arg as { string: string; count: number };
        if (actual !== r.string.repeat(r.count))
          fail(path, `expected "${r.string}"×${r.count}, got ${show(actual)}`);
        break;
      }
      case '$time':
        if (
          typeof actual !== 'string' ||
          Date.parse(actual) !== Date.parse(arg as string)
        )
          fail(path, `expected time ${arg}, got ${show(actual)}`);
        break;
      case '$oneOf': {
        const opts = arg as JsonValue[];
        const ok = opts.some((m) => {
          try {
            match(m, actual, new Map(captures), path);
            return true;
          } catch {
            return false;
          }
        });
        if (!ok) fail(path, `matches none of $oneOf, got ${show(actual)}`);
        break;
      }
      default:
        fail(path, `unknown operator ${op} (fixture error)`);
    }
  }
  if ('$capture' in e) {
    if (actual === ABSENT) fail(path, `expected present for $capture`);
    captures.set(e.$capture as string, actual);
  }
}

/** Expands `$each` elements of an expected array. */
export function expandArray(expected: JsonValue[]): JsonValue[] {
  const out: JsonValue[] = [];
  for (const e of expected) {
    if (e && typeof e === 'object' && !Array.isArray(e) && '$each' in e) {
      const each = e.$each as { from: number; to: number; match: JsonValue };
      for (let i = each.from; i <= each.to; i++)
        out.push(substitute(each.match, i));
    } else {
      out.push(e);
    }
  }
  return out;
}

/** Matches [actual] against the contract matcher [expected]; throws on a mismatch. */
export function match(
  expected: JsonValue,
  actual: Actual,
  captures: Captures,
  path = ''
): void {
  if (
    typeof expected === 'string' &&
    expected.startsWith('<') &&
    expected.endsWith('>')
  ) {
    sentinel(expected, actual, path);
    return;
  }
  if (isOperator(expected)) {
    operators(expected, actual, captures, path);
    return;
  }
  if (actual === ABSENT) fail(path, `missing (expected ${show(expected)})`);
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual))
      fail(path, `expected array, got ${show(actual)}`);
    const exp = expandArray(expected);
    if (exp.length !== actual.length)
      fail(path, `expected ${exp.length} elements, got ${actual.length}`);
    exp.forEach((e, i) => match(e, actual[i], captures, `${path}[${i}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    if (jsonType(actual) !== 'object')
      fail(path, `expected object, got ${show(actual)}`);
    const a = actual as Record<string, unknown>;
    for (const [k, e] of Object.entries(expected)) {
      match(e, k in a ? a[k] : ABSENT, captures, `${path}.${k}`);
    }
    return;
  }
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || actual !== expected)
      fail(path, `expected ${expected}, got ${show(actual)}`);
    return;
  }
  if (actual !== expected)
    fail(path, `expected ${show(expected)}, got ${show(actual)}`);
}

/** True when [actual] matches [expected] (no captures are kept). */
export function matches(
  expected: JsonValue,
  actual: unknown,
  captures: Captures
): boolean {
  try {
    match(expected, actual, new Map(captures));
    return true;
  } catch {
    return false;
  }
}
