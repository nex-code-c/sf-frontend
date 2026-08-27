import React from "react";
import { render } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("ContactAvatar", () => {
  it("falls back to initials when there is no photo", () => {
    const { container } = render(<ContactAvatar contact={makeContact()} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AL");
  });

  it("renders the photo as a circular image when there is one", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} size="lg" />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", PHOTO);
    expect(image).toHaveClass("rounded-full", "aspect-square", "object-cover");
    // The size prop still drives the circle, photo or not.
    expect(image).toHaveClass("h-14", "w-14");
    expect(container.textContent).toBe("");
  });

  it("keeps the same initials hue for the same email", () => {
    const first = render(<ContactAvatar contact={makeContact()} />);
    const second = render(<ContactAvatar contact={makeContact({ id: 2 })} />);

    expect(first.container.firstElementChild?.getAttribute("style")).toBe(
      second.container.firstElementChild?.getAttribute("style"),
    );
  });
});
