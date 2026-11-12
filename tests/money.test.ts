import { describe, expect, it } from "vitest";
import { HISTORY_FILTERS, MONEY_STATUS_LABEL, MONEY_STATUS_STYLE, isMoneyStatus, moneyStatusHelp } from "@/lib/money";
import { moneyCancelSchema, moneyIdSchema, moneyReasonSchema, moneySendSchema } from "@/lib/validation";

const id = "11111111-1111-4111-8111-111111111111";

describe("sending money (what a seller types)", () => {
  const ok = { to: id, amount: "500", sent_on: "", note: "" };
  it("accepts a normal transfer, with or without cents, date and note", () => {
    for (const amount of ["500", "500.5", "500.50", "0.01", "12345678.99"]) expect(moneySendSchema.safeParse({ ...ok, amount }).success, amount).toBe(true);
    expect(moneySendSchema.safeParse({ ...ok, sent_on: "2026-11-09", note: "Zelle" }).success).toBe(true);
    expect(moneySendSchema.safeParse({ to: id, amount: "10" }).success).toBe(true);
  });
  it("rejects zero, negatives, three decimals, letters, commas and huge numbers", () => {
    for (const amount of ["0", "0.00", "-5", "5.555", "abc", "1,000", "", "123456789"]) expect(moneySendSchema.safeParse({ ...ok, amount }).success, amount).toBe(false);
  });
  it("needs a real recipient, a real date and a short note", () => {
    expect(moneySendSchema.safeParse({ ...ok, to: "" }).success).toBe(false);
    expect(moneySendSchema.safeParse({ ...ok, to: "arpan" }).success).toBe(false);
    expect(moneySendSchema.safeParse({ ...ok, sent_on: "yesterday" }).success).toBe(false);
    expect(moneySendSchema.safeParse({ ...ok, note: "x".repeat(201) }).success).toBe(false);
  });
});

describe("answering a transfer", () => {
  it("needs the transfer id", () => {
    expect(moneyIdSchema.safeParse({ id }).success).toBe(true);
    expect(moneyIdSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
  it("needs a reason to reject or reverse, but not to cancel your own", () => {
    expect(moneyReasonSchema.safeParse({ id, reason: "Not received" }).success).toBe(true);
    expect(moneyReasonSchema.safeParse({ id, reason: " " }).success).toBe(false);
    expect(moneyReasonSchema.safeParse({ id, reason: "ab" }).success).toBe(false);
    expect(moneyCancelSchema.safeParse({ id }).success).toBe(true);
    expect(moneyCancelSchema.safeParse({ id, reason: "x".repeat(301) }).success).toBe(false);
  });
});

describe("how the ledger words things", () => {
  it("has a label and a colour for every status", () => {
    for (const s of Object.keys(MONEY_STATUS_LABEL)) { expect(MONEY_STATUS_STYLE[s as keyof typeof MONEY_STATUS_STYLE]).toBeTruthy(); expect(isMoneyStatus(s)).toBe(true); }
    expect(MONEY_STATUS_LABEL.pending).toBe("Waiting");
    expect(MONEY_STATUS_LABEL.accepted).toBe("Logged");
    expect(isMoneyStatus("paid")).toBe(false);
    expect(isMoneyStatus(undefined)).toBe(false);
  });
  it("tells the sender it is not logged until accepted, and tells the receiver what to do", () => {
    expect(moneyStatusHelp("pending", "sender", "Arpan")).toBe("Waiting for Arpan to accept it. It is not logged until then.");
    expect(moneyStatusHelp("pending", "receiver", "Arpan")).toContain("accept or reject");
    expect(moneyStatusHelp("accepted", "sender", "Arpan")).toContain("logged");
    expect(moneyStatusHelp("rejected", "other", "Arpan")).toContain("not logged");
  });
  it("filters the history by every finished status, never by waiting", () => {
    expect([...HISTORY_FILTERS]).toEqual(["all", "accepted", "rejected", "cancelled", "reversed"]);
  });
});
