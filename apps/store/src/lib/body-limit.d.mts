export function readUtf8BodyLimited(stream: ReadableStream<Uint8Array> | null, maximumBytes: number): Promise<string | null>;
