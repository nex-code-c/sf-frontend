"use client";

import { useId, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import Field from "@/components/ui/Field";
import { buttonClasses } from "@/components/ui/Button";
import { ADDRESS_FIELDS } from "@/lib/contacts/schema";
import { ADDRESS_TYPES, type AddressInput, type AddressType } from "@/lib/contacts/types";

/** A row the user is editing. `key` is stable so removing one keeps the rest intact. */
interface Row {
  key: string;
  address: Partial<AddressInput>;
}

/**
 * The repeating address section of the contact form.
 *
 * Each row's inputs are named by position — `addresses.0.city` — so they are
 * ordinary form fields that submit without JavaScript; the server action
 * reassembles them with `formDataToAddresses`. Only adding and removing rows
 * needs the client.
 */
export default function AddressFields({
  addresses = [],
  errors,
}: {
  addresses?: AddressInput[];
  /** Per-row messages from a failed submit, keyed by the row's position. */
  errors?: Record<number, string>;
}) {
  const prefix = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    addresses.map((address, index) => ({ key: `${prefix}-${index}`, address })),
  );
  const [nextKey, setNextKey] = useState(addresses.length);

  function addRow() {
    setRows((current) => [...current, { key: `${prefix}-${nextKey}`, address: {} }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Addresses</legend>

      <div className="border-b border-hairline pb-2">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Addresses
        </h2>
        <p className="text-[13px] text-muted-foreground">
          As many as you need — each one is a Home, Work, or Other address.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-[13px] text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          No addresses yet.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div
          key={row.key}
          className="space-y-4 rounded-lg border border-border bg-card/40 p-4"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <label
                htmlFor={`field-addresses.${index}.type`}
                className="mb-1.5 block text-[13px] font-medium text-foreground"
              >
                Type
              </label>
              <select
                id={`field-addresses.${index}.type`}
                name={`addresses.${index}.type`}
                defaultValue={row.address.type ?? "Home"}
                className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground transition-colors focus:border-primary"
              >
                {ADDRESS_TYPES.map((type: AddressType) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label={`Remove address ${index + 1}`}
              className={buttonClasses("ghost", "sm")}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove
            </button>
          </div>

          {errors?.[index] ? (
            <p role="alert" className="text-[13px] text-destructive">
              {errors[index]}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {ADDRESS_FIELDS.map((field) => (
              <Field
                key={field.name}
                field={field}
                name={`addresses.${index}.${field.name}`}
                defaultValue={row.address[field.name] ?? ""}
              />
            ))}
          </div>
        </div>
      ))}

      <button type="button" onClick={addRow} className={buttonClasses("secondary", "sm")}>
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Add address
      </button>
    </fieldset>
  );
}
