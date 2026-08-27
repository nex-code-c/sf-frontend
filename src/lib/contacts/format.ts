import { ADDRESS_TYPES, type Address, type AddressType, type Contact } from "./types";

/** Presentation helpers shared by the list, the detail page, and the cards. */

/** Up to two letters for the avatar bubble. */
export function initials(contact: Pick<Contact, "first_name" | "last_name">) {
  return `${contact.first_name.at(0) ?? ""}${contact.last_name.at(0) ?? ""}`
    .toUpperCase()
    .trim();
}

/**
 * Stable hue per contact so the same person keeps the same avatar colour
 * across renders and machines (no randomness, no hydration mismatch).
 */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

// Rendered on the server and hydrated on the client, so pin the locale and zone
// rather than letting each side pick its own and mismatch.
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${TIMESTAMP_FORMAT.format(date)} UTC`;
}

/** "Ada Lovelace · Mathematician at Analytical Engines"-style subtitle. */
export function jobLine(contact: Contact): string | null {
  if (contact.job_title && contact.company) {
    return `${contact.job_title} at ${contact.company}`;
  }
  return contact.job_title ?? contact.company ?? null;
}

/** Single-line postal address, skipping the parts that are not filled in. */
export function addressLine(address: Address): string | null {
  const parts = [
    address.street,
    address.city,
    [address.state, address.postal_code].filter(Boolean).join(" "),
    address.country,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.length ? parts.join(", ") : null;
}

/**
 * Addresses bucketed by type, in Home/Work/Other order, with empty buckets
 * dropped — so the detail page can render one section per type it actually has.
 */
export function addressesByType(
  addresses: Address[],
): [AddressType, Address[]][] {
  return ADDRESS_TYPES.map(
    (type): [AddressType, Address[]] => [
      type,
      addresses.filter((address) => address.type === type),
    ],
  ).filter(([, group]) => group.length > 0);
}
