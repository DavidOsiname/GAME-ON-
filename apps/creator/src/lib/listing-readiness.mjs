const ALLOWED_PLATFORMS = new Set(["android", "windows", "web"]);

export function getListingReadiness(input) {
  const title = (input.title || "").trim();
  const genre = (input.genre || "").trim();
  const description = input.description || "";
  const platforms = input.supportedPlatforms || [];
  const gameFitPlatforms = new Set(input.gameFitPlatforms || []);
  const checks = [
    { label: "Game title", complete: title.length >= 2 && title.length <= 100 },
    { label: "Choose a genre", complete: Boolean(genre) },
    {
      label: "Add a short description (10–180 characters)",
      complete: description.trim().length >= 10 && description.length <= 180,
    },
    {
      label: "Select at least one supported platform",
      complete: platforms.length > 0 && platforms.every((platform) => ALLOWED_PLATFORMS.has(platform)),
    },
    {
      label: "Add GAME FIT details for each platform",
      complete: platforms.length > 0 && platforms.every((platform) => gameFitPlatforms.has(platform)),
    },
  ];

  if (input.monetizationType === "paid") {
    checks.push({
      label: "Enter a valid paid-game price",
      complete: typeof input.priceMinor === "number" && Number.isSafeInteger(input.priceMinor) && input.priceMinor > 0,
    });
  }

  const completed = checks.filter((item) => item.complete).length;
  const percent = Math.round((completed / checks.length) * 100);
  return {
    checks,
    completed,
    total: checks.length,
    percent,
    ready: completed === checks.length,
    nextStep: checks.find((item) => !item.complete)?.label || "All required listing details are in place.",
  };
}
