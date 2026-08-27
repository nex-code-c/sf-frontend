"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, X } from "lucide-react";
import ContactAvatar from "./ContactAvatar";
import Button, { buttonClasses } from "@/components/ui/Button";
import { jobLine } from "@/lib/contacts/format";
import { toVCard } from "@/lib/contacts/vcard";
import type { Contact } from "@/lib/contacts/types";

/**
 * Turns a contact into a scannable digital business card.
 *
 * The QR code holds the whole vCard, so a phone camera reads it straight into
 * "Add to Contacts" — no server, no shared link, nothing to host.
 */
export default function ShareContactButton({ contact }: { contact: Contact }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const vcard = toVCard(contact);
  const subtitle = jobLine(contact);

  async function copyVCard() {
    try {
      await navigator.clipboard.writeText(vcard);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the QR code is the point either way.
    }
  }

  return (
    <>
      <Button type="button" onClick={() => dialog.current?.showModal()}>
        <QrCode className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Share contact
      </Button>

      <dialog
        ref={dialog}
        aria-label={`Share ${contact.full_name}`}
        onClose={() => setCopied(false)}
        // Clicking the backdrop lands on the dialog itself, not on the card.
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-foreground backdrop:bg-black/60"
      >
        <div className="relative flex flex-col items-center gap-4 px-6 pb-6 pt-8">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>

          <ContactAvatar contact={contact} size="xl" />

          <div className="text-center">
            <p className="font-display text-lg font-bold tracking-tight">
              {contact.full_name}
            </p>
            {subtitle ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>

          {/* A QR code only scans reliably on white, so it keeps its own ground
              in both themes rather than inheriting the card's. A contact with
              addresses runs to ~65 modules, which needs the size to stay
              scannable from a phone held at arm's length. */}
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={vcard} size={256} level="M" marginSize={0} />
          </div>

          <p className="text-[13px] text-muted-foreground">Scan to save contact</p>

          <button
            type="button"
            onClick={copyVCard}
            className={`${buttonClasses("secondary", "sm")} w-full justify-center`}
          >
            {copied ? (
              <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy vCard"}
          </button>
        </div>
      </dialog>
    </>
  );
}
