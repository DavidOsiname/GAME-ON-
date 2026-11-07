export type ListingReadinessInput = {
  title?: string;
  genre?: string;
  description?: string;
  supportedPlatforms?: string[];
  gameFitPlatforms?: string[];
  monetizationType?: string;
  priceMinor?: number | null;
};
export type ListingReadinessCheck = { label: string; complete: boolean };
export type ListingReadiness = {
  checks: ListingReadinessCheck[];
  completed: number;
  total: number;
  percent: number;
  ready: boolean;
  nextStep: string;
};
export function getListingReadiness(input: ListingReadinessInput): ListingReadiness;
