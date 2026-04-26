import { describe, it, expect } from "vitest";
import {
  validateHolePars,
  validateFinalScores,
  validateForfeitedPlayers,
  DEFAULT_HOLE_PARS,
} from "@/lib/matchValidation";

describe("matchValidation: validateHolePars", () => {
  it("accepts default 18-hole pars", () => {
    const r = validateHolePars(DEFAULT_HOLE_PARS);
    expect(r.success).toBe(true);
  });
  it("rejects missing holes", () => {
    const partial = { ...DEFAULT_HOLE_PARS } as any;
    delete partial["18"];
    expect(validateHolePars(partial).success).toBe(false);
  });
  it("rejects par out of range", () => {
    const bad = { ...DEFAULT_HOLE_PARS, "1": 7 };
    expect(validateHolePars(bad).success).toBe(false);
    const bad2 = { ...DEFAULT_HOLE_PARS, "1": 2 };
    expect(validateHolePars(bad2).success).toBe(false);
  });
  it("rejects bad hole keys", () => {
    const bad = { ...DEFAULT_HOLE_PARS, "19": 4 };
    expect(validateHolePars(bad).success).toBe(false);
  });
  it("rejects non-objects", () => {
    expect(validateHolePars(null).success).toBe(false);
    expect(validateHolePars("string").success).toBe(false);
  });
});

describe("matchValidation: validateFinalScores", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";
  const validScore = {
    player_name: "Jane",
    gross_strokes: 80,
    handicap_index: 10,
    course_handicap: 12,
    net_strokes: 68,
  };
  it("accepts valid", () => {
    const r = validateFinalScores({ [validUuid]: validScore });
    expect(r.success).toBe(true);
  });
  it("rejects non-uuid keys", () => {
    expect(validateFinalScores({ "not-a-uuid": validScore }).success).toBe(false);
  });
  it("rejects empty / too many", () => {
    expect(validateFinalScores({}).success).toBe(false);
    const many: any = {};
    for (let i = 0; i < 9; i++) {
      many[`${i.toString().repeat(8)}-1111-4111-8111-111111111111`.slice(0, 36)] = validScore;
    }
    // ensure 9 valid uuids
    expect(validateFinalScores(many).success).toBe(false);
  });
  it("rejects out-of-range strokes", () => {
    expect(validateFinalScores({ [validUuid]: { ...validScore, gross_strokes: 5 } }).success).toBe(false);
    expect(validateFinalScores({ [validUuid]: { ...validScore, gross_strokes: 250 } }).success).toBe(false);
  });
  it("sanitizes player_name", () => {
    const r = validateFinalScores({ [validUuid]: { ...validScore, player_name: "<script>x</script>Bob" } });
    expect(r.success).toBe(true);
    expect(r.data[validUuid].player_name).toBe("Bob");
  });
});

describe("matchValidation: validateForfeitedPlayers", () => {
  const valid = [{
    user_id: "11111111-1111-4111-8111-111111111111",
    reason: "no show",
    timestamp: new Date().toISOString(),
    refund_eligible: false,
  }];
  it("accepts valid array", () => {
    expect(validateForfeitedPlayers(valid).success).toBe(true);
  });
  it("rejects bad uuid / timestamp", () => {
    expect(validateForfeitedPlayers([{ ...valid[0], user_id: "x" }]).success).toBe(false);
    expect(validateForfeitedPlayers([{ ...valid[0], timestamp: "yesterday" }]).success).toBe(false);
  });
  it("rejects too many", () => {
    const many = Array(9).fill(valid[0]);
    expect(validateForfeitedPlayers(many).success).toBe(false);
  });
});
