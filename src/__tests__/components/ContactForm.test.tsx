import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/components/contacts/ContactForm";
import { makeContact } from "../mocks/handlers";
import type { FormState } from "@/lib/contacts/types";

const PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** The avatar preview. `alt=""` makes it presentational, so query the DOM. */
function photoPreview(): HTMLImageElement | null {
  return document.querySelector("form img");
}

function renderForm(action: jest.Mock, contact?: ReturnType<typeof makeContact>) {
  return render(
    <ContactForm
      action={action as never}
      contact={contact}
      submitLabel="Create contact"
      cancelHref="/contacts"
    />,
  );
}

describe("ContactForm", () => {
  it("renders every editable field", () => {
    renderForm(jest.fn());

    expect(screen.getByLabelText(/first name/i)).toBeRequired();
    expect(screen.getByLabelText(/last name/i)).toBeRequired();
    expect(screen.getByLabelText(/^email/i)).toBeRequired();
    expect(screen.getByLabelText(/phone/i)).not.toBeRequired();
    expect(screen.getByLabelText(/notes/i).tagName).toBe("TEXTAREA");
  });

  it("prefills from an existing contact", () => {
    renderForm(jest.fn(), makeContact());

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("ada@example.com");
    // Nulls become empty inputs rather than the string "null".
    expect(screen.getByLabelText(/street address/i)).toHaveValue("");
  });

  it("submits the entered values to the action", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    await userEvent.type(screen.getByLabelText(/first name/i), "Grace");
    await userEvent.type(screen.getByLabelText(/last name/i), "Hopper");
    await userEvent.type(screen.getByLabelText(/^email/i), "grace@example.com");
    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.get("first_name")).toBe("Grace");
    expect(formData.get("email")).toBe("grace@example.com");
  });

  it("shows the summary and the per-field errors the action returns", async () => {
    const action = jest.fn(
      async (): Promise<FormState> => ({
        status: "error",
        message: "That email address is already taken.",
        fieldErrors: { email: "This email is already in use." },
        values: { first_name: "Grace" },
      }),
    );
    renderForm(action);

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((node) => node.textContent)).toEqual(
      expect.arrayContaining([
        "That email address is already taken.",
        "This email is already in use.",
      ]),
    );
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("carries an existing photo through a submit untouched", async () => {
    // The edit form is a full PUT replace, so a photo the user never touched
    // has to come back out of the form or saving would wipe it.
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action, makeContact({ photo: PHOTO }));

    expect(photoPreview()).toHaveAttribute("src", PHOTO);

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));
    await waitFor(() => expect(action).toHaveBeenCalled());

    expect(action.mock.calls[0][1].get("photo")).toBe(PHOTO);
  });

  it("encodes a picked file into the submitted photo", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    // No photo yet: the field submits nothing and shows no image.
    expect(photoPreview()).toBeNull();

    await userEvent.upload(
      screen.getByLabelText(/^photo/i),
      new File([PNG_BYTES], "ada.png", { type: "image/png" }),
    );

    await waitFor(() => expect(photoPreview()).not.toBeNull());
    const src = photoPreview()!.getAttribute("src");
    expect(src).toMatch(/^data:image\/png;base64,/);

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));
    await waitFor(() => expect(action).toHaveBeenCalled());

    expect(action.mock.calls[0][1].get("photo")).toBe(src);
  });

  it("rejects a file that is not an image", async () => {
    renderForm(jest.fn());

    await userEvent.upload(
      screen.getByLabelText(/^photo/i),
      new File(["nope"], "resume.pdf", { type: "application/pdf" }),
      { applyAccept: false },
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /not an image.*PNG, JPEG, GIF, or WebP/i,
    );
    expect(photoPreview()).toBeNull();
  });

  it("rejects an image over 2 MB", async () => {
    renderForm(jest.fn());

    const tooBig = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "huge.png", {
      type: "image/png",
    });
    await userEvent.upload(screen.getByLabelText(/^photo/i), tooBig, {
      applyAccept: false,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /2\.0 MB\. Choose one under 2 MB/i,
    );
    expect(photoPreview()).toBeNull();
  });

  it("keeps an existing photo when a later pick is rejected", async () => {
    renderForm(jest.fn(), makeContact({ photo: PHOTO }));

    await userEvent.upload(
      screen.getByLabelText(/^photo/i),
      new File(["nope"], "resume.pdf", { type: "application/pdf" }),
      { applyAccept: false },
    );

    await screen.findByRole("alert");
    expect(photoPreview()).toHaveAttribute("src", PHOTO);
  });

  it("clears the photo when the user removes it", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action, makeContact({ photo: PHOTO }));

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(photoPreview()).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));
    await waitFor(() => expect(action).toHaveBeenCalled());

    // Empty, not the old data URL: PUT then clears it on the API side too.
    expect(action.mock.calls[0][1].get("photo")).toBe("");
  });

  it("links back out without submitting", () => {
    renderForm(jest.fn());
    expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });
});
