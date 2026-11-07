export type PaystackConfiguration =
  | { enabled: true; mode: "test" | "live"; secret: string }
  | { enabled: false; reason: string };
export function paystackConfiguration(env?: Record<string, string | undefined>): PaystackConfiguration;
