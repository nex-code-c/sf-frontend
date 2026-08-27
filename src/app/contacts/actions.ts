"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, ApiUnreachableError } from "@/lib/apiClient";
import {
  apiErrorMessage,
  createContact,
  deleteContact,
  replaceContact,
  toFieldErrors,
} from "@/lib/contacts/api";
import {
  contactInputSchema,
  formDataToAddresses,
  formDataToValues,
  isFilledAddress,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import type { Contact, FormState } from "@/lib/contacts/types";

/** Mutations for the contacts UI. Every one of these runs only on the server. */

function invalidate(contactId?: number) {
  revalidatePath("/contacts");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
}

const UNREACHABLE =
  "Could not reach the Contacts API. Check that the backend is running.";

/** Map address errors keyed by filtered-list index back to the original row. */
function remapAddressErrors(
  errors: Record<number, string>,
  filledIndexes: number[],
): Record<number, string> {
  const remapped: Record<number, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    const originalIndex = filledIndexes[Number(key)];
    if (originalIndex !== undefined) remapped[originalIndex] = message;
  }
  return remapped;
}

/**
 * Create (when `contactId` is null) or fully replace a contact.
 *
 * Bind the id at the call site — `saveContactAction.bind(null, contact.id)` —
 * so the form itself never carries a mutable record id.
 */
export async function saveContactAction(
  contactId: number | null,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formDataToValues(formData);
  const addresses = formDataToAddresses(formData);

  const parsed = contactInputSchema.safeParse({ ...values, addresses });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      ...zodFieldErrors(parsed.error),
      values,
      addresses,
    };
  }

  // Rows the user added but never filled in are not addresses worth saving.
  // Track which original row each kept row came from, so an API error
  // reported against this filtered list can be pointed back at the row the
  // user is actually looking at.
  const filledIndexes: number[] = [];
  const filteredAddresses = parsed.data.addresses.filter((address, index) => {
    const keep = isFilledAddress(address);
    if (keep) filledIndexes.push(index);
    return keep;
  });
  const input = { ...parsed.data, addresses: filteredAddresses };

  let saved: Contact;
  try {
    saved =
      contactId === null
        ? await createContact(input)
        : await replaceContact(contactId, input);
  } catch (error) {
    if (error instanceof ApiUnreachableError) {
      return { status: "error", message: UNREACHABLE, values, addresses };
    }
    if (error instanceof ApiError) {
      if (error.status === 409) {
        return {
          status: "error",
          message: "That email address is already taken.",
          fieldErrors: {
            email: apiErrorMessage(error, "This email is already in use."),
          },
          values,
          addresses,
        };
      }
      if (error.status === 422) {
        const { fieldErrors, addressErrors } = toFieldErrors(error);
        return {
          status: "error",
          message: "The API rejected these values.",
          fieldErrors,
          addressErrors: remapAddressErrors(addressErrors, filledIndexes),
          values,
          addresses,
        };
      }
      return {
        status: "error",
        message: apiErrorMessage(error, "The contact could not be saved."),
        values,
        addresses,
      };
    }
    throw error;
  }

  invalidate(saved.id);
  // Outside the try/catch: redirect() signals by throwing.
  redirect(`/contacts/${saved.id}`);
}

export interface DeleteResult {
  error?: string;
}

/**
 * Delete a contact. Pass `redirectToList` from the detail page, where staying
 * put would leave the user on a 404.
 */
export async function deleteContactAction(
  contactId: number,
  redirectToList = false,
): Promise<DeleteResult> {
  try {
    await deleteContact(contactId);
  } catch (error) {
    if (error instanceof ApiUnreachableError) return { error: UNREACHABLE };
    if (error instanceof ApiError) {
      return {
        error:
          error.status === 404
            ? "That contact has already been deleted."
            : apiErrorMessage(error, "The contact could not be deleted."),
      };
    }
    throw error;
  }

  invalidate(contactId);
  if (redirectToList) redirect("/contacts");
  return {};
}
