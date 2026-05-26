import { describe, expect, it } from "vitest";
import { scoreGuess } from "./scoring";

describe("scoreGuess", () => {
  it("exact = 1000", () => expect(scoreGuess(100, 100)).toBe(1000));
  it("10x off ≈ 333", () => expect(scoreGuess(1000, 100)).toBe(333));
  it("0.1x off ≈ 333", () => expect(scoreGuess(10, 100)).toBe(333));
  it("100x off → 0", () => expect(scoreGuess(10000, 100)).toBe(0));
  it("zero guess → 0", () => expect(scoreGuess(0, 100)).toBe(0));
  it("negative → 0", () => expect(scoreGuess(-5, 100)).toBe(0));
  it("NaN → 0", () => expect(scoreGuess(NaN, 100)).toBe(0));
});
