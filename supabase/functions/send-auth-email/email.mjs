const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const ACTION_COPY = {
  signup: {
    subject: "Confirm your GAME ON account",
    title: "Welcome to GAME ON",
    message: "Confirm your email address to finish creating your GAME ON Creator account.",
    button: "Confirm email address",
  },
  invite: {
    subject: "You are invited to GAME ON",
    title: "Your GAME ON Creator invitation",
    message: "You have been invited to join GAME ON Creator. Use the secure link below to accept your invitation.",
    button: "Accept invitation",
  },
  magiclink: {
    subject: "Your GAME ON sign-in link",
    title: "Sign in to GAME ON",
    message: "Use the secure, one-time link below to sign in to your GAME ON account.",
    button: "Sign in to GAME ON",
  },
  recovery: {
    subject: "Reset your GAME ON password",
    title: "Password reset requested",
    message: "We received a request to reset the password for your GAME ON account. Use the secure link below to choose a new password.",
    button: "Reset password",
  },
  email: {
    subject: "Confirm your GAME ON email address",
    title: "Confirm your email address",
    message: "Use the secure link below to confirm this email address for your GAME ON account.",
    button: "Confirm email address",
  },
  email_change: {
    subject: "Confirm your GAME ON email change",
    title: "Confirm your email change",
    message: "Use the secure link below to confirm this email-address change on your GAME ON account.",
    button: "Confirm email change",
  },
  email_change_current: {
    subject: "Confirm your GAME ON email change",
    title: "Confirm this email change",
    message: "A request was made to change the email address on your GAME ON account. Confirm this request using the secure link below.",
    button: "Confirm email change",
  },
  email_change_new: {
    subject: "Confirm your new GAME ON email address",
    title: "Confirm your new email address",
    message: "Use the secure link below to confirm this as the new email address for your GAME ON account.",
    button: "Confirm new email address",
  },
  reauthentication: {
    subject: "Your GAME ON verification code",
    title: "Verify your identity",
    message: "Enter this one-time code in GAME ON to confirm that it is you.",
    button: "",
  },
};

const NOTIFICATION_COPY = {
  password_changed_notification: {
    subject: "Your GAME ON password was changed",
    title: "Password changed",
    message: "The password for your GAME ON account was changed. If you made this change, no further action is needed. If you did not make this change, use GAME ON's password-reset page and contact support.",
  },
  email_changed_notification: {
    subject: "Your GAME ON account email was changed",
    title: "Account email changed",
    message: "The email address associated with your GAME ON account was changed. If you did not request this change, contact GAME ON support immediately.",
  },
  phone_changed_notification: {
    subject: "Your GAME ON phone number was changed",
    title: "Phone number changed",
    message: "The phone number associated with your GAME ON account was changed. If you did not request this change, contact GAME ON support.",
  },
  identity_linked_notification: {
    subject: "A sign-in method was added to your GAME ON account",
    title: "Sign-in method added",
    message: "A new sign-in identity was linked to your GAME ON account. If you did not request this change, contact GAME ON support.",
  },
  identity_unlinked_notification: {
    subject: "A sign-in method was removed from your GAME ON account",
    title: "Sign-in method removed",
    message: "A sign-in identity was removed from your GAME ON account. If you did not request this change, contact GAME ON support.",
  },
  mfa_factor_enrolled_notification: {
    subject: "Two-step verification was enabled on GAME ON",
    title: "Two-step verification enabled",
    message: "A new two-step verification factor was added to your GAME ON account. If you did not request this change, contact GAME ON support.",
  },
  mfa_factor_unenrolled_notification: {
    subject: "A two-step verification method was removed from GAME ON",
    title: "Two-step verification method removed",
    message: "A two-step verification factor was removed from your GAME ON account. If you did not request this change, contact GAME ON support.",
  },
};

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireEmail(value, fieldName) {
  const email = cleanString(value);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new Error("A valid " + fieldName + " email address is required.");
  }
  return email;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function createVerifyUrl({ supabaseUrl, tokenHash, actionType, redirectTo }) {
  const base = cleanString(supabaseUrl);
  if (!base) throw new Error("The Supabase project URL is not configured.");
  const url = new URL("/auth/v1/verify", base);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  if (cleanString(redirectTo)) url.searchParams.set("redirect_to", cleanString(redirectTo));
  return url.toString();
}

function renderEmail({ title, message, button, verificationUrl, token }) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeToken = escapeHtml(token);
  const safeUrl = verificationUrl ? escapeHtml(verificationUrl) : "";
  const buttonHtml = verificationUrl
    ? '<p style="margin:28px 0"><a href="' + safeUrl + '" style="display:inline-block;padding:14px 22px;background:#165dff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">' + escapeHtml(button || "Continue securely") + "</a></p>"
    : "";
  const codeHtml = token
    ? '<p style="margin:22px 0 8px;color:#475569">Or enter this one-time code in GAME ON:</p><p style="display:inline-block;padding:12px 18px;background:#eff6ff;border-radius:8px;color:#102a56;font-size:22px;font-weight:700;letter-spacing:4px">' + safeToken + "</p>"
    : "";
  const html = '<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#102a56"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:14px;padding:32px"><tr><td><p style="margin:0 0 28px;font-size:13px;font-weight:800;letter-spacing:2px;color:#165dff">GAME ON · CREATOR</p><h1 style="font-size:25px;line-height:1.25;margin:0 0 16px">' + safeTitle + "</h1><p style=\"font-size:15px;line-height:1.7;color:#475569\">" + safeMessage + "</p>" + buttonHtml + codeHtml + '<p style="font-size:13px;line-height:1.6;color:#64748b;margin-top:28px">If you did not request this, you can safely ignore this email. Never share a verification code with anyone.</p><hr style="border:0;border-top:1px solid #e2e8f0;margin:28px 0 18px"><p style="font-size:12px;color:#94a3b8;margin:0">GAME ON · Every game deserves a chance. Every player deserves a fair deal.</p></td></tr></table></td></tr></table></body></html>';

  let text = title + "\n\n" + message + "\n";
  if (verificationUrl) text += "\n" + (button || "Continue securely") + ": " + verificationUrl + "\n";
  if (token) text += "\nOne-time code: " + token + "\n";
  text += "\nIf you did not request this, you can safely ignore this email. Never share a verification code with anyone.\n\nGAME ON Creator";
  return { html, text };
}

function createActionMessage({
  recipient,
  subject,
  title,
  message,
  button,
  verificationUrl,
  token,
}) {
  const to = requireEmail(recipient, "recipient");
  const rendered = renderEmail({ title, message, button, verificationUrl, token });
  return { to, subject, ...rendered };
}

function createNotificationMessages({ user, emailData }) {
  const actionType = cleanString(emailData.email_action_type);
  const copy = NOTIFICATION_COPY[actionType];
  if (!copy) throw new Error("Unsupported GAME ON notification type.");
  const recipients = [requireEmail(user.email, "account")];
  if (actionType === "email_changed_notification" && cleanString(emailData.old_email)) {
    const oldEmail = requireEmail(emailData.old_email, "previous account");
    if (!recipients.includes(oldEmail)) recipients.push(oldEmail);
  }
  const detailParts = [];
  if (cleanString(emailData.provider)) detailParts.push("Sign-in provider: " + cleanString(emailData.provider));
  if (cleanString(emailData.factor_type)) detailParts.push("Verification method: " + cleanString(emailData.factor_type));
  if (cleanString(emailData.old_email)) detailParts.push("Previous email: " + cleanString(emailData.old_email));
  const detail = detailParts.length ? "\n\n" + detailParts.join("\n") : "";
  return recipients.map((recipient) => createActionMessage({
    recipient,
    subject: copy.subject,
    title: copy.title,
    message: copy.message + detail,
    button: "",
    verificationUrl: "",
    token: "",
  }));
}

/**
 * Build one or more signed-link/OTP emails from Supabase's Send Email Auth Hook payload.
 * @param {{user: {email?: string, new_email?: string}, emailData: Record<string, unknown>, supabaseUrl: string}} input
 * @returns {Array<{to: string, subject: string, html: string, text: string}>}
 */
export function buildAuthEmailMessages({ user, emailData, supabaseUrl }) {
  if (!user || !emailData || typeof emailData !== "object") {
    throw new Error("The Supabase Auth email payload is incomplete.");
  }
  const actionType = cleanString(emailData.email_action_type);
  if (Object.prototype.hasOwnProperty.call(NOTIFICATION_COPY, actionType)) {
    return createNotificationMessages({ user, emailData });
  }

  if (actionType === "email_change") {
    const hasCurrentPair = cleanString(emailData.token_hash_new) && cleanString(emailData.token);
    const hasNewPair = cleanString(emailData.token_hash) && cleanString(emailData.token_new);
    if (hasCurrentPair && hasNewPair) {
      const currentUrl = createVerifyUrl({
        supabaseUrl,
        tokenHash: cleanString(emailData.token_hash_new),
        actionType,
        redirectTo: cleanString(emailData.redirect_to),
      });
      const newUrl = createVerifyUrl({
        supabaseUrl,
        tokenHash: cleanString(emailData.token_hash),
        actionType,
        redirectTo: cleanString(emailData.redirect_to),
      });
      return [
        createActionMessage({
          recipient: user.email,
          subject: ACTION_COPY.email_change_current.subject,
          title: ACTION_COPY.email_change_current.title,
          message: ACTION_COPY.email_change_current.message,
          button: ACTION_COPY.email_change_current.button,
          verificationUrl: currentUrl,
          token: cleanString(emailData.token),
        }),
        createActionMessage({
          recipient: user.new_email,
          subject: ACTION_COPY.email_change_new.subject,
          title: ACTION_COPY.email_change_new.title,
          message: ACTION_COPY.email_change_new.message,
          button: ACTION_COPY.email_change_new.button,
          verificationUrl: newUrl,
          token: cleanString(emailData.token_new),
        }),
      ];
    }

    const newEmailTokenHash = cleanString(emailData.token_hash);
    const newEmailToken = cleanString(emailData.token_new) || cleanString(emailData.token);
    if (newEmailTokenHash && newEmailToken && cleanString(user.new_email)) {
      const url = createVerifyUrl({
        supabaseUrl,
        tokenHash: newEmailTokenHash,
        actionType,
        redirectTo: cleanString(emailData.redirect_to),
      });
      return [createActionMessage({
        recipient: user.new_email,
        subject: ACTION_COPY.email_change_new.subject,
        title: ACTION_COPY.email_change_new.title,
        message: ACTION_COPY.email_change_new.message,
        button: ACTION_COPY.email_change_new.button,
        verificationUrl: url,
        token: newEmailToken,
      })];
    }
    throw new Error("The email-change confirmation details are incomplete.");
  }

  if (actionType === "email_change_current" || actionType === "email_change_new") {
    const copy = ACTION_COPY[actionType];
    const currentTarget = actionType === "email_change_current";
    const recipient = currentTarget ? user.email : user.new_email;
    const tokenHash = cleanString(emailData.token_hash) || cleanString(emailData.token_hash_new);
    const token = cleanString(emailData.token) || cleanString(emailData.token_new);
    const url = tokenHash ? createVerifyUrl({
      supabaseUrl,
      tokenHash,
      actionType: "email_change",
      redirectTo: cleanString(emailData.redirect_to),
    }) : "";
    if (!tokenHash && !token) throw new Error("The email-change confirmation code is missing.");
    return [createActionMessage({
      recipient,
      subject: copy.subject,
      title: copy.title,
      message: copy.message,
      button: copy.button,
      verificationUrl: url,
      token,
    })];
  }

  const copy = ACTION_COPY[actionType];
  if (!copy) throw new Error("Unsupported GAME ON authentication email action: " + (actionType || "empty"));
  const token = cleanString(emailData.token);
  if (actionType === "reauthentication") {
    if (!token) throw new Error("The reauthentication code is missing.");
    return [createActionMessage({
      recipient: user.email,
      subject: copy.subject,
      title: copy.title,
      message: copy.message,
      button: "",
      verificationUrl: "",
      token,
    })];
  }

  const tokenHash = cleanString(emailData.token_hash);
  if (!tokenHash && !token) throw new Error("The authentication email has no verification token.");
  const verificationUrl = tokenHash ? createVerifyUrl({
    supabaseUrl,
    tokenHash,
    actionType,
    redirectTo: cleanString(emailData.redirect_to),
  }) : "";
  return [createActionMessage({
    recipient: user.email,
    subject: copy.subject,
    title: copy.title,
    message: copy.message,
    button: copy.button,
    verificationUrl,
    token,
  })];
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

/**
 * Create a Gmail API-compatible base64url-encoded RFC 2822 message.
 * @param {{fromEmail: string, fromName: string, to: string, subject: string, text: string, html: string, boundary?: string}} input
 * @returns {string}
 */
export function createRawGmailMessage({ fromEmail, fromName, to, subject, text, html, boundary }) {
  const sender = requireEmail(fromEmail, "sender");
  const recipient = requireEmail(to, "recipient");
  const displayName = cleanString(fromName);
  const safeSubject = cleanString(subject);
  if (!displayName || /[\r\n"]/.test(displayName)) throw new Error("The sender display name is invalid.");
  if (!safeSubject || /[\r\n]/.test(safeSubject)) throw new Error("The email subject is invalid.");
  const mimeBoundary = cleanString(boundary) || ("game-on-auth-" + Math.random().toString(36).slice(2));
  if (/[\r\n"]/.test(mimeBoundary)) throw new Error("The email MIME boundary is invalid.");

  const mime = [
    "From: " + displayName + " <" + sender + ">",
    "To: " + recipient,
    "Subject: " + safeSubject,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="' + mimeBoundary + '"',
    "",
    "--" + mimeBoundary,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(encodeBase64Utf8(text)),
    "--" + mimeBoundary,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(encodeBase64Utf8(html)),
    "--" + mimeBoundary + "--",
    "",
  ].join("\r\n");

  return encodeBase64Utf8(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
