import assert from 'node:assert/strict';
import { paystackConfiguration } from '../apps/store/src/lib/payment-config.mjs';

const disabled = paystackConfiguration({ PAYSTACK_SECRET_KEY: 'sk_test_example' });
assert.equal(disabled.enabled, false, 'payments must be disabled by default');

const testEnabled = paystackConfiguration({
  GAMEON_PAYMENTS_ENABLED: 'true', GAMEON_PAYMENTS_MODE: 'test', PAYSTACK_SECRET_KEY: 'sk_test_example',
});
assert.equal(testEnabled.enabled, true, 'test mode should accept a test key when explicitly enabled');
assert.equal(testEnabled.mode, 'test');

const wrongTestKey = paystackConfiguration({
  GAMEON_PAYMENTS_ENABLED: 'true', GAMEON_PAYMENTS_MODE: 'test', PAYSTACK_SECRET_KEY: 'sk_live_example',
});
assert.equal(wrongTestKey.enabled, false, 'test mode must reject a live key');

const liveWithoutApproval = paystackConfiguration({
  GAMEON_PAYMENTS_ENABLED: 'true', GAMEON_PAYMENTS_MODE: 'live', PAYSTACK_SECRET_KEY: 'sk_live_example',
});
assert.equal(liveWithoutApproval.enabled, false, 'live funds require a separate approval flag');

const liveEnabled = paystackConfiguration({
  GAMEON_PAYMENTS_ENABLED: 'true', GAMEON_PAYMENTS_MODE: 'live', PAYSTACK_SECRET_KEY: 'sk_live_example', GAMEON_LIVE_PAYMENTS_APPROVED: 'true',
});
assert.equal(liveEnabled.enabled, true, 'approved live mode should accept a live key');
assert.equal(liveEnabled.mode, 'live');

const unknownMode = paystackConfiguration({
  GAMEON_PAYMENTS_ENABLED: 'true', GAMEON_PAYMENTS_MODE: 'production-ish', PAYSTACK_SECRET_KEY: 'sk_live_example', GAMEON_LIVE_PAYMENTS_APPROVED: 'true',
});
assert.equal(unknownMode.enabled, false, 'unknown payment modes must fail closed');

console.log('Payment configuration tests passed: disabled by default, test/live key separation, explicit live approval and fail-closed unknown modes.');
