"use client";

import { authClient } from "@/lib/auth-client";

export default function AccountActions() {
  async function signOut() {
    const result = await authClient.signOut();
    if (!result.error) {
      window.location.assign("/sign-in");
    }
  }

  return (
    <button className="secondary-button" onClick={signOut}>
      Sign out
    </button>
  );
}
