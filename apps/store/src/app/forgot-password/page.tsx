import type { Metadata } from "next";
import PasswordRecovery from "@/components/password-recovery";

export const metadata: Metadata = { title: "Reset your Game ON password", robots: { index: false, follow: false } };

export default function PasswordPage() { return <PasswordRecovery mode="request" />; }
