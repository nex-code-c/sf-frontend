import type { Address, Contact } from "./types";

/**
 * A contact as a vCard 3.0 string, for the QR code on the detail page.
 *
 * 3.0 rather than 4.0 because that is what iOS and Android camera apps parse
 * into a "Add to Contacts" prompt without an app in between.
 *
 * The photo is deliberately left out: a QR code holds ~2,950 bytes and a base64
 * avatar is tens of KB, so embedding one produces a code nothing can scan.
 * Notes are left out too — they are a private annotation, not card data.
 */

/** Escape the characters vCard treats as structure. */
function escape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** `ADR` is seven positional parts: PO box, extended, street, city, region, postcode, country. */
function addressLines(addresses: Address[]): string[] {
  return addresses.map((address) => {
    const parts = [
      "",
      "",
      address.street ?? "",
      address.city ?? "",
      address.state ?? "",
      address.postal_code ?? "",
      address.country ?? "",
    ];
    return `ADR;TYPE=${address.type.toUpperCase()}:${parts.map(escape).join(";")}`;
  });
}

export function toVCard(contact: Contact): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escape(contact.last_name)};${escape(contact.first_name)};;;`,
    `FN:${escape(contact.full_name)}`,
    `EMAIL;TYPE=INTERNET:${escape(contact.email)}`,
  ];

  if (contact.phone) lines.push(`TEL;TYPE=VOICE:${escape(contact.phone)}`);
  if (contact.company) lines.push(`ORG:${escape(contact.company)}`);
  if (contact.job_title) lines.push(`TITLE:${escape(contact.job_title)}`);
  lines.push(...addressLines(contact.addresses));
  lines.push("END:VCARD");

  // CRLF is what the spec calls for, and what the strict parsers expect.
  return lines.join("\r\n");
}
