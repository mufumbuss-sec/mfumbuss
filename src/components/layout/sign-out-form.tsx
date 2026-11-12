"use client";

import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";

export function SignOutForm() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={() => setSigningOut(true)}
    >
      <button
        type="submit"
        disabled={signingOut}
        aria-busy={signingOut}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger-ink hover:bg-danger disabled:cursor-wait disabled:opacity-70"
      >
        {signingOut ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        {signingOut ? "Signing out..." : "Sign Out"}
      </button>
    </form>
  );
}
