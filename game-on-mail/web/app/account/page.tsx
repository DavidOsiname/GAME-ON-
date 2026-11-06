import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountActions from "./account-actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="auth-page">
      <section className="auth-card account-card">
        <Link className="auth-brand" href="/">
          <span className="brand-mark">GO</span>
          <span><strong>GAME ON</strong><small>MAIL</small></span>
        </Link>
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Welcome, {session.user.name}</h1>
        <p className="auth-muted">Your GAME ON MAIL platform account is active.</p>

        <div className="account-summary">
          <div><span>Contact email</span><strong>{session.user.email}</strong></div>
          <div>
            <span>Email verification</span>
            <strong>{session.user.emailVerified ? "Verified" : "Not verified"}</strong>
          </div>
          <div><span>Mailbox status</span><strong>Not provisioned yet</strong></div>
        </div>

        <div className="auth-notice">
          Your platform account is ready. A GAME ON email address and inbox will be assigned once the company domain and self-hosted mail server are configured.
        </div>
        <div className="account-actions">
          <Link className="secondary-button" href="/">Open demo inbox</Link>
          <AccountActions />
        </div>
        <p className="auth-footnote">Signed-in sessions are stored server-side and expire after seven days of inactivity policy.</p>
      </section>
    </main>
  );
}
