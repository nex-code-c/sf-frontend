import { toVCard } from "@/lib/contacts/vcard";
import { makeContact } from "../../mocks/handlers";

function lines(contact: Parameters<typeof toVCard>[0]) {
  return toVCard(contact).split("\r\n");
}

describe("toVCard", () => {
  it("wraps the contact in a vCard 3.0 envelope", () => {
    const card = lines(makeContact());

    expect(card[0]).toBe("BEGIN:VCARD");
    expect(card[1]).toBe("VERSION:3.0");
    expect(card.at(-1)).toBe("END:VCARD");
    expect(card).toContain("N:Lovelace;Ada;;;");
    expect(card).toContain("FN:Ada Lovelace");
    expect(card).toContain("EMAIL;TYPE=INTERNET:ada@example.com");
  });

  it("leaves out the fields the contact has not filled in", () => {
    const card = toVCard(makeContact({ phone: null, company: null, job_title: null }));

    expect(card).not.toContain("TEL");
    expect(card).not.toContain("ORG");
    expect(card).not.toContain("TITLE");
  });

  it("writes one positional ADR per address, tagged with its type", () => {
    const card = lines(
      makeContact({
        addresses: [
          {
            id: 1,
            type: "Work",
            street: "1 Market St",
            city: "San Francisco",
            state: "CA",
            postal_code: "94105",
            country: "USA",
          },
        ],
      }),
    );

    expect(card).toContain("ADR;TYPE=WORK:;;1 Market St;San Francisco;CA;94105;USA");
  });

  it("escapes the characters vCard treats as structure", () => {
    const card = toVCard(makeContact({ company: "Babbage, Lovelace; Ltd" }));
    expect(card).toContain("ORG:Babbage\\, Lovelace\\; Ltd");
  });

  it("keeps the photo out, so the QR code stays scannable", () => {
    const card = toVCard(makeContact({ photo: "data:image/png;base64,iVBORw0KGgo=" }));

    expect(card).not.toContain("PHOTO");
    expect(card).not.toContain("base64");
    // Comfortably inside a QR code's ~2,950 byte ceiling.
    expect(card.length).toBeLessThan(1000);
  });
});
