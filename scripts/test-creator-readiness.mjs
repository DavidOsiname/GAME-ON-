import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { getListingReadiness } = await import(pathToFileURL(path.join(root, "apps/creator/src/lib/listing-readiness.mjs")));

const valid = {
  title: "Neon Drift",
  genre: "Racing",
  description: "Race through a futuristic neon city.",
  supportedPlatforms: ["android"],
  gameFitPlatforms: ["android"],
  monetizationType: "free",
};

const complete = getListingReadiness(valid);
assert.equal(complete.ready, true);
assert.equal(complete.percent, 100);
assert.equal(complete.completed, 5);
assert.equal(complete.nextStep, "All required listing details are in place.");

const empty = getListingReadiness({});
assert.equal(empty.ready, false);
assert.equal(empty.percent, 0);
assert.equal(empty.checks.length, 5);

const missingFit = getListingReadiness({ ...valid, gameFitPlatforms: [] });
assert.equal(missingFit.ready, false);
assert.equal(missingFit.checks.find((check) => check.label.startsWith("Add GAME FIT")).complete, false);

const multiPlatformMissingOne = getListingReadiness({
  ...valid,
  supportedPlatforms: ["android", "web"],
  gameFitPlatforms: ["android"],
});
assert.equal(multiPlatformMissingOne.checks.find((check) => check.label.startsWith("Add GAME FIT")).complete, false);

const invalidPlatform = getListingReadiness({
  ...valid,
  supportedPlatforms: ["android", "unsupported"],
  gameFitPlatforms: ["android", "unsupported"],
});
assert.equal(invalidPlatform.checks.find((check) => check.label.startsWith("Select")).complete, false);

const shortDescription = getListingReadiness({ ...valid, description: "Too short" });
assert.equal(shortDescription.checks.find((check) => check.label.startsWith("Add a short description")).complete, false);

const longDescription = getListingReadiness({ ...valid, description: "x".repeat(181) });
assert.equal(longDescription.checks.find((check) => check.label.startsWith("Add a short description")).complete, false);

const paidWithoutPrice = getListingReadiness({ ...valid, monetizationType: "paid", priceMinor: null });
assert.equal(paidWithoutPrice.ready, false);
assert.equal(paidWithoutPrice.total, 6);
assert.equal(paidWithoutPrice.percent, 83);

const paidWithPrice = getListingReadiness({ ...valid, monetizationType: "paid", priceMinor: 250000 });
assert.equal(paidWithPrice.ready, true);
assert.equal(paidWithPrice.percent, 100);

console.log("Creator live listing readiness checks passed: required fields, platform GAME FIT records, descriptions and paid pricing.");
