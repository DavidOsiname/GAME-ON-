export function checkReadiness(
  env?: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
  timeoutMs?: number,
  requiredServerSettings?: string[],
): Promise<{ ready: boolean; checks: Record<string, boolean> }>;
