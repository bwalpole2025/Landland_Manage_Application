import { getSession } from "@/server/auth/session";
import { Landing } from "@/components/marketing/Landing";

// Public marketing landing page — always shown at the root. When the visitor is
// already signed in, the nav offers a "Go to dashboard" shortcut instead of the
// sign-in / trial calls to action.
export default async function Home() {
  const session = await getSession();
  return <Landing signedIn={Boolean(session)} />;
}
