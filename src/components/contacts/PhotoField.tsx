"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Trash2, UserRound } from "lucide-react";
import ContactAvatar from "./ContactAvatar";
import { buttonClasses } from "@/components/ui/Button";
import type { ContactFieldSpec } from "@/lib/contacts/schema";
import type { Contact } from "@/lib/contacts/types";

/** Formats the file input accepts, and the API validates on the way in. */
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Largest file we will read. A data URL is ~4/3 the size of its source. */
const MAX_BYTES = 2 * 1024 * 1024;

/** Longest edge of the stored image. An avatar is never rendered bigger. */
const MAX_EDGE = 512;

/** Read a picked file into the `data:<mime>;base64,...` string the API stores. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** How long to wait for the browser to decode the picked image. */
const DECODE_TIMEOUT_MS = 5_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Neither event is guaranteed to fire, so never wait on them forever.
    const timer = setTimeout(() => reject(new Error("decode timed out")), DECODE_TIMEOUT_MS);
    const settle = (run: () => void) => {
      clearTimeout(timer);
      run();
    };

    image.onload = () => settle(() => resolve(image));
    image.onerror = () => settle(() => reject(new Error("not a decodable image")));
    image.src = src;
  });
}

/**
 * Shrink the picked image to avatar size before it is ever submitted.
 *
 * A photo travels inside the contact JSON, so a 2MB upload would otherwise sit
 * in every list response and blow past the 1MB server action body limit. At
 * 512px it lands in the tens of KB and still renders sharp on a retina avatar.
 *
 * Best effort: if the browser cannot decode or paint the image, the original
 * data URL is kept rather than losing the user's photo.
 */
async function toAvatarDataUrl(dataUrl: string): Promise<string> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  // No canvas to paint on: keep the photo rather than dropping it.
  if (!context) return dataUrl;

  try {
    const image = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));

    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return dataUrl;
  }
}

/** Why a picked file was rejected, or `null` when it is fine. */
function rejectionReason(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "That is not an image. Choose a PNG, JPEG, GIF, or WebP file.";
  }
  if (file.size > MAX_BYTES) {
    const megabytes = (file.size / 1024 / 1024).toFixed(1);
    return `That image is ${megabytes} MB. Choose one under 2 MB.`;
  }
  return null;
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
  // Reading a file is async, so a fast second pick could otherwise be overtaken
  // by the first one finishing. Only the newest request is allowed to land.
  const latestPick = useRef(0);

  const id = `field-${field.name}`;
  const errorId = `${id}-error`;
  const message = error ?? readError;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the picker either way, so re-choosing the same file still fires.
    event.target.value = "";
    if (!file) return;

    const pick = (latestPick.current += 1);

    const rejection = rejectionReason(file);
    if (rejection) {
      setReadError(rejection);
      return;
    }

    try {
      const dataUrl = await toAvatarDataUrl(await readAsDataUrl(file));
      if (pick !== latestPick.current) return;
      setPhoto(dataUrl);
      setReadError(null);
    } catch {
      if (pick !== latestPick.current) return;
      setReadError("That file could not be read. Try another one.");
    }
  }

  function clear() {
    // Outranks any read still in flight, so a slow one cannot undo the removal.
    latestPick.current += 1;
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
                aria-label="Remove photo"
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
              : "PNG, JPEG, GIF, or WebP under 2 MB. Without one the contact keeps their initials."}
          </p>
        </div>
      </div>

      <input
        id={id}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
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
