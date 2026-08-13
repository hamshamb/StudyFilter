import React from "react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const LINKS = [
  { href: "/subjects", label: "Subjects" },
  { href: "/practice", label: "Practice" },
  { href: "/library", label: "Library" },
  { href: "/dashboard", label: "Progress" },
  { href: "/saved", label: "Saved" },
];

/**
 * The footer sits at the bottom of study pages, inside an app shell that
 * already has a sidebar — so it is a quiet closing rule, not a second
 * navigation.
 *
 * It used to carry a gradient overlay, a glowing logo and the slogan "Study
 * smarter. Revise faster." on every chapter page. A student three hours into
 * revision does not need to be sold the product they are already using.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="flex items-center gap-2 self-start">
          <img
            src={`${basePath}/logo.png`}
            alt=""
            className="h-6 w-6 shrink-0 rounded-md bg-primary object-contain p-0.5"
          />
          <span className="text-sm font-bold tracking-tight text-foreground">StudyFilter</span>
          <span className="text-sm text-muted-foreground">· CBSE Class 10</span>
        </Link>

        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
        >
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="transition-colors hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
