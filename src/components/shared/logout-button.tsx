"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  return (
    <form method="post" action="/auth/logout" onSubmit={() => setPending(true)}>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label="Logout akun"
        title="Logout akun"
      >
        <LogOut />
        <span className="hidden sm:inline">
          {pending ? "Keluar…" : "Logout"}
        </span>
      </Button>
    </form>
  );
}
