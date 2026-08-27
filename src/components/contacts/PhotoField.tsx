"use client";

import { useState, type ChangeEvent } from "react";
import { ImagePlus, Trash2, UserRound } from "lucide-react";
import ContactAvatar from "./ContactAvatar";
import { buttonClasses } from "@/components/ui/Button";
import type { ContactFieldSpec } from "@/lib/contacts/schema";
import type { Contact } from "@/lib/contacts/types";

/** Read a picked file into the `data:<mime>;base64,...` string the API stores. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Photo picker for the contact form.
 *
 * The chosen file is read into a base64 data URL and parked in a hidden input,
 * so the photo rides along with the ordinary form submit. That is also what
 * keeps the edit form honest: `PUT` replaces every field, and the hidden input
 * starts out holding the contact's current photo, so leaving it alone
 * resubmits the same value instead of clearing it.
 */
export default function PhotoField({
  field,
  defaultValue = "",
  error,
  contact,
}: {
  field: ContactFieldSpec;
  defaultValue?: string;
  error?: string;
  contact?: Pick<Contact, "first_name" | "last_name" | "email">;
}) {
  const [photo, setPhoto] = useState(defaultValue);
  const [readError, setReadError] = useState<string | null>(null);

  const id = `field-${field.name}`;
  const errorId = `${id}-error`;
  const message = error ?? readError;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the picker either way, so re-choosing the same file still fires.
    event.target.value = "";
    if (!file) return;

    try {
      setPhoto(await readAsDataUrl(file));
      setReadError(null);
    } catch {
      setReadError("That file could not be read. Try another one.");
    }
  }

  function clear() {
    setPhoto("");
    setReadError(null);
  }

  return (
    <div className={field.wide ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-foreground"
      >
        {field.label}
        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
          optional
        </span>
      </label>

      <div className="flex items-center gap-4">
        {photo || contact ? (
          <ContactAvatar
            contact={{
              first_name: contact?.first_name ?? "",
              last_name: contact?.last_name ?? "",
              email: contact?.email ?? "",
              photo: photo || null,
            }}
            size="xl"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/60"
          >
            <UserRound className="h-7 w-7" strokeWidth={1.5} />
          </span>
        )}

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={id}
              className={`${buttonClasses("secondary", "sm")} cursor-pointer`}
            >
              <ImagePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {photo ? "Replace photo" : "Choose photo"}
            </label>

            {photo ? (
              <button
                type="button"
                onClick={clear}
                className={buttonClasses("ghost", "sm")}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Remove
              </button>
            ) : null}
          </div>

          <p className="text-[12px] text-muted-foreground">
            {photo
              ? "Saved with the contact and shown as their avatar."
              : "Without a photo the contact keeps their initials."}
          </p>
        </div>
      </div>

      <input
        id={id}
        type="file"
        accept="image/*"
        onChange={handleChange}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        className="sr-only"
      />
      {/* The value the form actually submits. */}
      <input type="hidden" name={field.name} value={photo} />

      {message ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[13px] text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
