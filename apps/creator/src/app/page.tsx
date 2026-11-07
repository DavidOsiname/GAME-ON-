import CreatorApp from "@/components/creator-app";
const scannerEnabled = process.env.GAMEON_SCANNER_ENABLED === "true";
export default function Page() { return <CreatorApp scannerEnabled={scannerEnabled} />; }
