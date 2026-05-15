import { describe, expect, it } from "vitest";
import { formatNominatimAddress } from "../nominatimReverseGeocoder.js";

describe("nominatimReverseGeocoder", () => {
  it("formatiert eine kompakte Adresse aus Nominatim address", () => {
    const formatted = formatNominatimAddress({
      display_name: "Fallback, München, Deutschland",
      address: {
        road: "Marienplatz",
        house_number: "1",
        postcode: "80331",
        city: "München"
      }
    });
    expect(formatted).toBe("Marienplatz 1, 80331 München");
  });

  it("nutzt display_name als Fallback", () => {
    const formatted = formatNominatimAddress({
      display_name: "48.1351, 11.5820, Altstadt-Lehel, München, Bayern, Deutschland"
    });
    expect(formatted).toBe("48.1351, 11.5820, Altstadt-Lehel, München, Bayern, Deutschland");
  });
});
