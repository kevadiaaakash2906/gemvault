import { describe, expect, it } from "vitest";
import { ageTone, daysWaiting, fmtPct, marginPct, monthLabel, refundDue, signedUsd, waitingLabel } from "@/lib/reports";

const today = new Date("2026-10-27T09:00:00Z");

describe("daysWaiting", () => {
  it("counts whole days up to today", () => {
    expect(daysWaiting("2026-10-26", today)).toBe(1);
    expect(daysWaiting("2026-10-17", today)).toBe(10);
    expect(daysWaiting("2026-08-26", today)).toBe(62);
  });
  it("is zero today and never negative for future dates", () => {
    expect(daysWaiting("2026-10-27", today)).toBe(0);
    expect(daysWaiting("2026-12-03", today)).toBe(0);
  });
  it("returns null when there is no usable date", () => {
    expect(daysWaiting(null, today)).toBeNull();
    expect(daysWaiting(undefined, today)).toBeNull();
    expect(daysWaiting("not a date", today)).toBeNull();
  });
  it("is not thrown off by the time of day", () => {
    expect(daysWaiting("2026-10-26", new Date("2026-10-27T00:00:01Z"))).toBe(1);
    expect(daysWaiting("2026-10-26", new Date("2026-10-27T23:59:59Z"))).toBe(1);
  });
});

describe("waiting labels and colours", () => {
  it("words the wait", () => {
    expect(waitingLabel(null)).toBe("—");
    expect(waitingLabel(0)).toBe("Today");
    expect(waitingLabel(1)).toBe("1 day");
    expect(waitingLabel(45)).toBe("45 days");
  });
  it("turns amber at 30 days and red at 60", () => {
    expect(ageTone(null)).toBe("ok");
    expect(ageTone(29)).toBe("ok");
    expect(ageTone(30)).toBe("amber");
    expect(ageTone(59)).toBe("amber");
    expect(ageTone(60)).toBe("red");
  });
});

describe("margin and month labels", () => {
  it("measures profit against sales, and refuses to divide by zero", () => {
    expect(marginPct(241.27, 1300)).toBeCloseTo(18.56, 2);
    expect(marginPct(-300, 2000)).toBe(-15);
    expect(marginPct(10, 0)).toBeNull();
    expect(fmtPct(18.5555)).toBe("18.6%");
    expect(fmtPct(null)).toBe("—");
  });
  it("labels months, including sales with no date", () => {
    expect(monthLabel("2026-08-01")).toBe("Aug 2026");
    expect(monthLabel(null)).toBe("No sale date");
  });
});

describe("signedUsd", () => {
  it("puts a plus on gains and keeps the minus on losses", () => {
    expect(signedUsd(32753.47)).toBe("+$32,753.47");
    expect(signedUsd(-300)).toBe("-$300.00");
    expect(signedUsd(0)).toBe("$0.00");
  });
});

describe("refundDue", () => {
  it("refunds only what the buyer has paid above the reduced bill", () => {
    expect(refundDue(1200, 1500, 500)).toBe(200);      // part-paid memo
    expect(refundDue(600, 600, 600)).toBe(600);        // fully paid, only piece returned
    expect(refundDue(0, 800, 800)).toBe(0);            // nothing paid yet
    expect(refundDue(300, 1500, 500)).toBe(0);         // paid less than the new bill
  });
});
