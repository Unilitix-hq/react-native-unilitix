// Passes when the fake server received the example app's test event
// (CUSTOM "e2e_ping") within the timeout.
//
//   node example/e2e/assert-event.mjs [baseUrl] [timeoutSeconds]
const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const timeoutMs = Number(process.argv[3] ?? 90) * 1000;
const deadline = Date.now() + timeoutMs;

function findPing(received) {
  for (const r of received) {
    for (const e of r.body?.events ?? []) {
      if (e?.type === 'CUSTOM' && e?.metadata?.name === 'e2e_ping') return r;
    }
  }
  return null;
}

for (;;) {
  try {
    const received = await (await fetch(`${base}/__received`)).json();
    const hit = findPing(received);
    if (hit) {
      console.log(`received e2e_ping via ${hit.method} ${hit.path}`);
      process.exit(0);
    }
    if (Date.now() > deadline) {
      console.error('no e2e_ping; requests seen:');
      for (const r of received) console.error(`  ${r.method} ${r.path}`);
      process.exit(1);
    }
  } catch (e) {
    if (Date.now() > deadline) {
      console.error(`fake server unreachable: ${e}`);
      process.exit(1);
    }
  }
  await new Promise((r) => setTimeout(r, 2000));
}
