"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ModeSwitcher() {
  const pathname = usePathname();
  const isCode = pathname.startsWith("/code");

  return (
    <nav className="flex gap-3 text-sm">
      <Link className={isCode ? "text-muted" : "font-medium"} href="/">
        Chat
      </Link>
      <Link className={isCode ? "font-medium" : "text-muted"} href="/code">
        Code
      </Link>
    </nav>
  );
}
