"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="system-state"><section><p className="system-eyebrow">GAME ON · SERVICE NOTICE</p><h1>Something interrupted the game.</h1><p>Your work may not have been saved. Try again, and contact Game ON support if the problem continues.</p><button onClick={() => reset()}>Try again</button><a href="/">Return to the home page</a></section></main>;
}
