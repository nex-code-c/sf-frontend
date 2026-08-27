import { z } from "zod";
import {
  ADDRESS_TYPES,
  type AddressInput,
  type AddressType,
  type ContactInput,
  type ContactScalarField,
} from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

export const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES).default("Home"),
  street: optionalText(300, "Street address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
});

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  // Already a data URL by the time it reaches here: PhotoField encodes the
  // picked file and submits it through a hidden input.
  photo: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  addresses: z.array(addressInputSchema).default([]),
}) satisfies z.ZodType<ContactInput, unknown>;

export type ContactFormValues = z.input<typeof contactInputSchema>;

/**
 * Collapse a ZodError into one message per field, keyed by input name.
 *
 * Only the contact's own fields have somewhere to render a message. An issue on
 * an address (`addresses.0.street`) is reported through `addressErrors` instead,
 * so a bad address is not rejected silently.
 */
export function zodFieldErrors(error: z.ZodError): {
  fieldErrors: Partial<Record<ContactScalarField, string>>;
  addressErrors: Record<number, string>;
} {
  const fieldErrors: Partial<Record<ContactScalarField, string>> = {};
  const addressErrors: Record<number, string> = {};

  for (const issue of error.issues) {
    const [head, index] = issue.path;
    if (head === "addresses" && typeof index === "number") {
      addressErrors[index] ??= issue.message;
    } else if (typeof head === "string" && SCALAR_FIELDS.has(head) && !(head in fieldErrors)) {
      fieldErrors[head as ContactScalarField] = issue.message;
    }
  }

  return { fieldErrors, addressErrors };
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface ContactFieldSpec {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "photo";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

/** A spec for one of the contact's own fields, so form state stays typed. */
export type ContactScalarFieldSpec = ContactFieldSpec & { name: ContactScalarField };

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactScalarFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Photo",
    description: "Optional headshot, shown as this contact's avatar.",
    fields: [
      {
        name: "photo",
        label: "Photo",
        type: "photo",
        // A data URL is roughly 4/3 the size of the file it encodes.
        maxLength: 4_000_000,
        wide: true,
      },
    ],
  },
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactScalarFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** The contact's own fields, i.e. the ones the form has an input for. */
const SCALAR_FIELDS = new Set<string>(CONTACT_FIELDS.map((field) => field.name));

/** Pull the contact's scalar fields out of a submitted form, as raw strings. */
export function formDataToValues(
  formData: FormData,
): Record<ContactScalarField, string> {
  return Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field.name,
      String(formData.get(field.name) ?? ""),
    ]),
  ) as Record<ContactScalarField, string>;
}

/** The address inputs, named `addresses.0.city` and so on. */
export const ADDRESS_FIELDS = [
  { name: "street", label: "Street address", maxLength: 300, placeholder: "1 Market St, Suite 400", autoComplete: "street-address", wide: true },
  { name: "city", label: "City", maxLength: 120, placeholder: "San Francisco", autoComplete: "address-level2" },
  { name: "state", label: "State / region", maxLength: 120, placeholder: "CA", autoComplete: "address-level1" },
  { name: "postal_code", label: "Postal code", maxLength: 20, placeholder: "94105", autoComplete: "postal-code" },
  { name: "country", label: "Country", maxLength: 120, placeholder: "USA", autoComplete: "country-name" },
] as const satisfies readonly (ContactFieldSpec & { name: keyof AddressInput })[];

const ADDRESS_INPUT = /^addresses\.(\d+)\.([a-z_]+)$/;

/**
 * Rebuild the address rows from a submitted form, in the order they appear.
 *
 * The inputs are named by position (`addresses.0.city`), which keeps them plain
 * form fields that submit without JavaScript. Every row comes back, blanks
 * included, so a validation issue on `addresses.1` lands on the second row the
 * user is looking at. `isFilledAddress` drops the blanks on the way out.
 */
export function formDataToAddresses(formData: FormData): AddressInput[] {
  const rows = new Map<number, Record<string, string>>();

  for (const [key, value] of formData.entries()) {
    const match = ADDRESS_INPUT.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    const row = rows.get(index) ?? {};
    row[match[2]] = String(value);
    rows.set(index, row);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => ({
      type: (ADDRESS_TYPES as readonly string[]).includes(row.type)
        ? (row.type as AddressType)
        : "Home",
      street: row.street?.trim() || null,
      city: row.city?.trim() || null,
      state: row.state?.trim() || null,
      postal_code: row.postal_code?.trim() || null,
      country: row.country?.trim() || null,
    }));
}

/** A row the user actually filled in. `type` alone is just an untouched row. */
export function isFilledAddress(address: AddressInput): boolean {
  return ADDRESS_FIELDS.some((field) => address[field.name]);
}
