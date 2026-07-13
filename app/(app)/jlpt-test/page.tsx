import { redirect } from "next/navigation";

/** Old placeholder route — the JLPT test engine now lives at `/jlpt` (Layer 5). */
export default function JlptTestPageRedirect() {
  redirect("/jlpt");
}
