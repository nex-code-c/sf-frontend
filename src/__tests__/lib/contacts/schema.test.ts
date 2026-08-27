import {
  CONTACT_FIELDS,
  contactInputSchema,
  formDataToAddresses,
  formDataToValues,
  isFilledAddress,
  zodFieldErrors,
} from "@/lib/contacts/schema";

function values(overrides: Record<string, string> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    notes: "",
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).fieldErrors).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).fieldErrors.email).toBe(
      "Enter a valid email address",
    );
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), company: "b".repeat(201) }),
    );

    expect(zodFieldErrors(result.error!).fieldErrors).toEqual({
      first_name: "First name must be 100 characters or fewer",
      company: "Company must be 200 characters or fewer",
    });
  });

  it("reports a bad address against its row, not a contact field", () => {
    const result = contactInputSchema.safeParse({
      ...values(),
      addresses: [
        { type: "Home", street: "1 Market St" },
        { type: "Work", postal_code: "9".repeat(21) },
      ],
    });

    expect(result.success).toBe(false);
    const { fieldErrors, addressErrors } = zodFieldErrors(result.error!);
    expect(fieldErrors).toEqual({});
    expect(addressErrors).toEqual({ 1: "Postal code must be 20 characters or fewer" });
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      CONTACT_FIELDS.map((field) => field.name).sort(),
    );
  });
});

describe("formDataToAddresses", () => {
  function form(entries: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(entries)) formData.set(key, value);
    return formData;
  }

  it("keeps every row in order, so an error lands on the row that caused it", () => {
    const rows = formDataToAddresses(
      form({
        "addresses.0.type": "Work",
        "addresses.0.street": "",
        "addresses.1.type": "Home",
        "addresses.1.city": "  London  ",
      }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "Work", street: null });
    expect(rows[1]).toMatchObject({ type: "Home", city: "London" });
  });

  it("falls back to Home for a type the API would reject", () => {
    const [row] = formDataToAddresses(
      form({ "addresses.0.type": "Yacht", "addresses.0.city": "Nice" }),
    );
    expect(row.type).toBe("Home");
  });

  it("counts a row as filled only when a real field has content", () => {
    const [untouched, filled] = formDataToAddresses(
      form({
        "addresses.0.type": "Work",
        "addresses.1.type": "Work",
        "addresses.1.postal_code": "94105",
      }),
    );

    expect(isFilledAddress(untouched)).toBe(false);
    expect(isFilledAddress(filled)).toBe(true);
  });
});
