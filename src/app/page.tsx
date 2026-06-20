import { redirect } from "next/navigation";

// The authenticated app shell is the product; send the root straight to it.
// (A real build would route unauthenticated visitors to a marketing/login page.)
export default function Home() {
  redirect("/dashboard");
}
