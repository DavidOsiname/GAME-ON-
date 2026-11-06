import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "game-on-mail-web",
    mailDeliveryEnabled: false,
    note: "Prototype only; no real mailbox connection is configured.",
  });
}
