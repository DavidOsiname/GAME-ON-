import assert from 'node:assert/strict';
import { readUtf8BodyLimited } from '../apps/store/src/lib/body-limit.mjs';

const encoder = new TextEncoder();
const stream = (...parts) => new ReadableStream({
  start(controller) {
    for (const part of parts) controller.enqueue(encoder.encode(part));
    controller.close();
  },
});

assert.equal(await readUtf8BodyLimited(stream('{"ok":', 'true}'), 32), '{"ok":true}');
assert.equal(await readUtf8BodyLimited(stream('1234', '5678'), 7), null, 'body must be rejected as soon as cumulative bytes exceed the limit');
assert.equal(await readUtf8BodyLimited(stream('🎮'), 4), '🎮', 'limit is measured in UTF-8 bytes, not JavaScript characters');
assert.equal(await readUtf8BodyLimited(null, 1), '');
await assert.rejects(() => readUtf8BodyLimited(stream('x'), -1), TypeError);

console.log('Webhook body-limit tests passed: streaming byte cap, multi-chunk overflow, UTF-8 byte counting and invalid limits.');
