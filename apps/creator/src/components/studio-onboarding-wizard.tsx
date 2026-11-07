"use client";

import { FormEvent, useEffect, useState } from "react";

export type StudioSetupStudio = {
  id: string;
  studio_name: string;
  slug: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  verification_status?: string;
};

export type StudioSetupProfile = {
  studio_id: string;
  owner_user_id: string;
  contact_name: string;
  contact_role: string;
  official_email: string;
};

export type StudioSetupData = {
  studioName: string;
  logoFile: File | null;
  contactName: string;
  contactRole: string;
  officialEmail: string;
  websiteUrl: string;
  description: string;
};

type Props = {
  initialStudio?: StudioSetupStudio | null;
  initialProfile?: StudioSetupProfile | null;
  userEmail?: string;
  busy?: boolean;
  error?: string;
  onSave: (data: StudioSetupData) => void | Promise<void>;
  onSignOut: () => void;
};

const STEPS = [
  { eyebrow: "YOUR STUDIO", title: "What is your company called?", copy: "Let's create the home for your games on GAME ON Creator." },
  { eyebrow: "YOUR BRAND", title: "Add your company logo.", copy: "Give your studio a recognisable identity. You can also add this later." },
  { eyebrow: "YOUR PROFILE", title: "Who are you in the company?", copy: "Tell us who is setting up this studio and what their role is." },
  { eyebrow: "COMPANY CONTACT", title: "What is your official company email?", copy: "This is the business contact address for your studio. It can be different from your sign-in email." },
  { eyebrow: "ABOUT THE STUDIO", title: "Tell developers and players about your studio.", copy: "Add a website and a short introduction. These details help people understand who is behind your games." },
  { eyebrow: "FINAL REVIEW", title: "Your studio is almost ready.", copy: "Check the information below before creating your Creator workspace." },
] as const;

const ROLES = [
  "Founder",
  "Co-founder",
  "CEO / Managing Director",
  "Studio Director",
  "Studio Manager",
  "Game Developer",
  "Game Designer",
  "Game Producer",
  "Publisher",
  "Marketing Lead",
  "Community Manager",
  "Other",
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateWebsite(value: string) {
  if (!value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" && parsed.hostname && !parsed.username && !parsed.password
      ? null
      : "Enter a public HTTPS website address.";
  } catch {
    return "Enter a valid HTTPS website address.";
  }
}

export default function StudioOnboardingWizard({
  initialStudio,
  initialProfile,
  userEmail,
  busy = false,
  error = "",
  onSave,
  onSignOut,
}: Props) {
  const [step, setStep] = useState(0);
  const [studioName, setStudioName] = useState(initialStudio?.studio_name || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(initialStudio?.logo_url || "");
  const [contactName, setContactName] = useState(initialProfile?.contact_name || "");
  const [contactRole, setContactRole] = useState(initialProfile?.contact_role || "");
  const [otherRole, setOtherRole] = useState("");
  const [officialEmail, setOfficialEmail] = useState(initialProfile?.official_email || "");
  const [websiteUrl, setWebsiteUrl] = useState(initialStudio?.website_url || "");
  const [description, setDescription] = useState(initialStudio?.description || "");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!logoPreview.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const resolvedRole = contactRole === "Other" ? otherRole.trim() : contactRole;
  const totalSteps = STEPS.length;
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  function chooseLogo(file?: File) {
    setLocalError("");
    if (!file) return;
    const supported = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!supported) {
      setLocalError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size < 1 || file.size > 3 * 1024 * 1024) {
      setLocalError("Your logo must be smaller than 3 MB.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (studioName.trim().length < 2 || studioName.trim().length > 80) return "Company name must be between 2 and 80 characters.";
      if (!/[a-z0-9]/i.test(studioName)) return "Add at least one letter or number to your company name.";
    }
    if (step === 1 && logoFile) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(logoFile.type)) return "Choose a JPG, PNG or WebP image.";
      if (logoFile.size < 1 || logoFile.size > 3 * 1024 * 1024) return "Your logo must be smaller than 3 MB.";
    }
    if (step === 2) {
      if (contactName.trim().length < 2 || contactName.trim().length > 120) return "Enter your full name (2–120 characters).";
      if (!resolvedRole || resolvedRole.length < 2 || resolvedRole.length > 60) return "Choose your company role or enter it under Other.";
    }
    if (step === 3 && !isValidEmail(officialEmail)) return "Enter a valid official company email address.";
    if (step === 4) {
      const websiteError = validateWebsite(websiteUrl);
      if (websiteError) return websiteError;
      if (description.trim().length > 280) return "Keep the studio introduction to 280 characters or fewer.";
    }
    return null;
  }

  function nextStep() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError("");
    setStep((current) => Math.min(current + 1, totalSteps - 1));
  }

  function previousStep() {
    setLocalError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateCurrentStep();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError("");
    await onSave({
      studioName: studioName.trim(),
      logoFile,
      contactName: contactName.trim(),
      contactRole: resolvedRole,
      officialEmail: officialEmail.trim().toLowerCase(),
      websiteUrl: websiteUrl.trim(),
      description: description.trim(),
    });
  }

  const current = STEPS[step];

  return (
    <main className="studio-onboarding studio-setup-screen">
      <header className="onboarding-top">
        <div className="small-brand"><span className="brand-square">G</span><span>GAME ON <b>CREATOR</b></span></div>
        <button className="quiet-button" type="button" onClick={onSignOut}>Sign out</button>
      </header>
      <section className="setup-wizard-shell">
        <div className="setup-wizard-side">
          <p className="eyebrow">WELCOME TO GAME ON CREATOR</p>
          <h2>Let's build your studio's home.</h2>
          <p>Set up your company profile once. You'll use this workspace to publish games, manage submissions and understand how your studio is performing.</p>
          <div className="setup-wizard-side-foot">
            <span>STUDIO SETUP</span>
            <b>{String(step + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}</b>
          </div>
        </div>
        <div className="setup-wizard-card">
          <div className="setup-wizard-progress-head">
            <span>{current.eyebrow}</span>
            <b>{progress}%</b>
          </div>
          <div className="setup-wizard-progress"><span style={{ width: progress + "%" }}/></div>
          <div className="setup-wizard-step-meta">STEP {String(step + 1).padStart(2, "0")} OF {String(totalSteps).padStart(2, "0")}</div>
          <h1>{current.title}</h1>
          <p className="setup-wizard-copy">{current.copy}</p>

          <form onSubmit={submit}>
            {step === 0 && <div className="setup-field-block">
              <label htmlFor="setup-studio-name">COMPANY / STUDIO NAME</label>
              <input id="setup-studio-name" value={studioName} onChange={(event) => setStudioName(event.target.value)} maxLength={80} autoFocus placeholder="e.g. Blue Lantern Games"/>
              <small>This name will identify your studio in the Creator workspace.</small>
            </div>}

            {step === 1 && <div className="setup-logo-step">
              <div className="setup-logo-preview">
                {logoPreview ? <img src={logoPreview} alt="Studio logo preview"/> : <span>{studioName.trim().slice(0, 1).toUpperCase() || "G"}</span>}
              </div>
              <label className="setup-upload-button" htmlFor="setup-studio-logo">{logoFile ? "Choose a different logo" : "Choose company logo"}</label>
              <input id="setup-studio-logo" className="setup-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseLogo(event.currentTarget.files?.[0])}/>
              <p>JPG, PNG or WebP · Maximum 3 MB. A square image works best.</p>
              {logoPreview && <button className="setup-text-button" type="button" onClick={() => { setLogoFile(null); setLogoPreview(""); }}>Remove logo</button>}
              <button className="setup-skip-button" type="button" onClick={nextStep}>Skip logo for now →</button>
            </div>}

            {step === 2 && <div className="setup-fields-grid">
              <div className="setup-field-block">
                <label htmlFor="setup-contact-name">YOUR FULL NAME</label>
                <input id="setup-contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={120} autoComplete="name" placeholder="e.g. Alex Johnson"/>
              </div>
              <div className="setup-field-block">
                <label htmlFor="setup-contact-role">YOUR ROLE IN THE COMPANY</label>
                <select id="setup-contact-role" value={contactRole} onChange={(event) => setContactRole(event.target.value)}>
                  <option value="">Select your role</option>
                  {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              {contactRole === "Other" && <div className="setup-field-block">
                <label htmlFor="setup-other-role">ENTER YOUR ROLE</label>
                <input id="setup-other-role" value={otherRole} onChange={(event) => setOtherRole(event.target.value)} maxLength={60} placeholder="e.g. Creative Lead"/>
              </div>}
            </div>}

            {step === 3 && <div className="setup-field-block">
              <label htmlFor="setup-official-email">OFFICIAL COMPANY EMAIL</label>
              <input id="setup-official-email" value={officialEmail} onChange={(event) => setOfficialEmail(event.target.value)} maxLength={254} autoCapitalize="none" autoComplete="email" type="email" placeholder="hello@yourstudio.com"/>
              <small>This is the business contact email for the studio. Your sign-in email remains {userEmail || "your account email"}.</small>
            </div>}

            {step === 4 && <div className="setup-fields-grid">
              <div className="setup-field-block">
                <label htmlFor="setup-website">COMPANY WEBSITE <span>OPTIONAL</span></label>
                <input id="setup-website" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} type="url" autoCapitalize="none" placeholder="https://yourstudio.com"/>
                <small>Use a public HTTPS website.</small>
              </div>
              <div className="setup-field-block">
                <label htmlFor="setup-description">ABOUT YOUR STUDIO <span>OPTIONAL</span></label>
                <textarea id="setup-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={280} rows={4} placeholder="Tell us what your studio makes and what players can expect."/>
                <small>{description.length}/280 characters</small>
              </div>
            </div>}

            {step === 5 && <div className="setup-review-list">
              <div className="setup-review-logo">
                {logoPreview ? <img src={logoPreview} alt="Company logo"/> : <span>{studioName.trim().slice(0, 1).toUpperCase() || "G"}</span>}
                <div><b>{studioName}</b><small>Company / studio name</small></div>
              </div>
              <div className="setup-review-row"><span>YOUR NAME</span><b>{contactName}</b></div>
              <div className="setup-review-row"><span>YOUR ROLE</span><b>{resolvedRole}</b></div>
              <div className="setup-review-row"><span>OFFICIAL EMAIL</span><b>{officialEmail}</b></div>
              <div className="setup-review-row"><span>WEBSITE</span><b>{websiteUrl || "Not added"}</b></div>
              <div className="setup-review-row"><span>ABOUT THE STUDIO</span><b>{description || "Not added"}</b></div>
            </div>}

            {(localError || error) && <p className="setup-error" role="alert">{localError || error}</p>}
            <div className="setup-wizard-actions">
              {step > 0 ? <button className="creator-outline" type="button" onClick={previousStep} disabled={busy}>Back</button> : <span/>}
              {step < totalSteps - 1
                ? <button className="creator-primary" type="button" onClick={nextStep} disabled={busy}>Continue →</button>
                : <button className="creator-primary" type="submit" disabled={busy}>{busy ? "Creating your studio…" : "Create my studio →"}</button>}
            </div>
          </form>
        </div>
      </section>
      <p className="setup-privacy-note">Your company contact details stay private to your studio account. Studio verification and publishing permissions are reviewed separately by Game ON.</p>
    </main>
  );
}
