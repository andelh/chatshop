import { describe, expect, it } from "vitest";
import { businessHoursError, isWithinBusinessHours } from "./lib/businessHours";

// Monday 2026-11-16.
const at = (iso: string) => new Date(iso).getTime();

describe("isWithinBusinessHours", () => {
  const trinidad = {
    timezone: "America/Port_of_Spain", // UTC-4, no DST
    days: {
      mon: { open: "09:00", close: "17:00" },
      sat: { open: "10:00", close: "14:00" },
    },
  };

  it("uses the shop's time zone", () => {
    // 12:59 UTC = 08:59 local; 13:00 UTC = 09:00 local.
    expect(isWithinBusinessHours(trinidad, at("2026-11-16T12:59:00Z"))).toBe(
      false,
    );
    expect(isWithinBusinessHours(trinidad, at("2026-11-16T13:00:00Z"))).toBe(
      true,
    );
    // 20:59 UTC = 16:59 local (open); 21:00 UTC = 17:00 local (closed).
    expect(isWithinBusinessHours(trinidad, at("2026-11-16T20:59:00Z"))).toBe(
      true,
    );
    expect(isWithinBusinessHours(trinidad, at("2026-11-16T21:00:00Z"))).toBe(
      false,
    );
  });

  it("uses the local weekday, not the UTC one", () => {
    // Tuesday 02:00 UTC is still Monday 22:00 local: closed (after 17:00).
    expect(isWithinBusinessHours(trinidad, at("2026-11-17T02:00:00Z"))).toBe(
      false,
    );
    // Saturday 2026-11-21 11:00 local.
    expect(isWithinBusinessHours(trinidad, at("2026-11-21T15:00:00Z"))).toBe(
      true,
    );
  });

  it("treats a day with no hours as closed", () => {
    // Sunday 2026-11-22, midday local.
    expect(isWithinBusinessHours(trinidad, at("2026-11-22T16:00:00Z"))).toBe(
      false,
    );
  });

  it("never restricts when hours are unset or malformed", () => {
    const now = at("2026-11-22T16:00:00Z");
    for (const hours of [
      undefined,
      null,
      "9-5",
      { timezone: "UTC" },
      {
        timezone: "Not/AZone",
        days: { sun: { open: "09:00", close: "17:00" } },
      },
      { timezone: "UTC", days: { sun: { open: "5pm", close: "9am" } } },
    ]) {
      expect(isWithinBusinessHours(hours, now)).toBe(true);
    }
  });
});

describe("businessHoursError", () => {
  it("accepts valid hours and explains invalid ones", () => {
    expect(
      businessHoursError({
        timezone: "UTC",
        days: { mon: { open: "09:00", close: "17:30" } },
      }),
    ).toBeNull();
    expect(businessHoursError({ timezone: "Nowhere", days: {} })).toMatch(
      /time zone/,
    );
    expect(
      businessHoursError({
        timezone: "UTC",
        days: { mon: { open: "17:00", close: "09:00" } },
      }),
    ).toMatch(/after opening/);
    expect(
      businessHoursError({
        timezone: "UTC",
        days: { mon: { open: "9:00", close: "17:00" } },
      }),
    ).toMatch(/HH:MM/);
  });
});
