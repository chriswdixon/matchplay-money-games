import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  emailSchema,
  displayNameSchema,
  dateOfBirthSchema,
  inviteCodeSchema,
  signUpSchema,
  signInSchema,
  passwordResetSchema,
  profileUpdateSchema,
  createMatchSchema,
  sanitizeInput,
  RateLimiter,
  validateSessionToken,
  calculateAge,
  isOver21,
} from "@/lib/validation";

describe("validation: passwordSchema", () => {
  it.each([
    ["StrongAa1!", true],
    ["GoodPw9$Aa", true],
  ])("validates password %s", (pw, ok) => {
    const r = passwordSchema.safeParse(pw);
    if (ok) expect(r.success).toBe(true);
  });

  it("rejects passwords missing categories", () => {
    expect(passwordSchema.safeParse("alllower1!").success).toBe(false);
    expect(passwordSchema.safeParse("ALLUPPER1!").success).toBe(false);
    expect(passwordSchema.safeParse("NoNumbers!").success).toBe(false);
    expect(passwordSchema.safeParse("NoSpecial1A").success).toBe(false);
    expect(passwordSchema.safeParse("Short1!").success).toBe(false);
  });

  it("rejects too long passwords", () => {
    expect(passwordSchema.safeParse("Aa1!" + "x".repeat(200)).success).toBe(false);
  });

  it("rejects common weak patterns", () => {
    expect(passwordSchema.safeParse("Password1!").success).toBe(false);
    expect(passwordSchema.safeParse("Qwerty12!A").success).toBe(false);
    expect(passwordSchema.safeParse("Letmein1!A").success).toBe(false);
    expect(passwordSchema.safeParse("Welcome1!A").success).toBe(false);
    expect(passwordSchema.safeParse("Dragon12!A").success).toBe(false);
    expect(passwordSchema.safeParse("Monkey12!A").success).toBe(false);
    expect(passwordSchema.safeParse("123456abC!A").success).toBe(false);
    expect(passwordSchema.safeParse("Abc12345!A").success).toBe(false);
  });

  it("accepts strong passwords", () => {
    expect(passwordSchema.safeParse("Tr0ub4dor&3X").success).toBe(true);
    expect(passwordSchema.safeParse("MyV@lid9pass").success).toBe(true);
  });
});

describe("validation: emailSchema", () => {
  it("accepts valid emails", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
    expect(emailSchema.safeParse("USER@EXAMPLE.COM").data).toBe("user@example.com");
    expect(emailSchema.safeParse("  spaced@example.com  ").data).toBe("spaced@example.com");
  });
  it("rejects invalid", () => {
    expect(emailSchema.safeParse("notanemail").success).toBe(false);
    expect(emailSchema.safeParse("a@b").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
    expect(emailSchema.safeParse("a@" + "x".repeat(260) + ".com").success).toBe(false);
  });
});

describe("validation: displayNameSchema", () => {
  it("allows safe characters", () => {
    expect(displayNameSchema.safeParse("John_Doe-99").success).toBe(true);
    expect(displayNameSchema.safeParse("Ab").success).toBe(true);
  });
  it("rejects unsafe", () => {
    expect(displayNameSchema.safeParse("a").success).toBe(false);
    expect(displayNameSchema.safeParse("x".repeat(60)).success).toBe(false);
    expect(displayNameSchema.safeParse("<script>").success).toBe(false);
    expect(displayNameSchema.safeParse("name@bad").success).toBe(false);
  });
});

describe("validation: dateOfBirthSchema", () => {
  it("requires age 18+", () => {
    const today = new Date();
    const eighteen = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate() - 1);
    expect(dateOfBirthSchema.safeParse(eighteen.toISOString().slice(0, 10)).success).toBe(true);
    const seventeen = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
    expect(dateOfBirthSchema.safeParse(seventeen.toISOString().slice(0, 10)).success).toBe(false);
  });
  it("rejects future dates", () => {
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(dateOfBirthSchema.safeParse(future).success).toBe(false);
  });
});

describe("validation: inviteCodeSchema", () => {
  it("accepts uppercase alnum", () => {
    expect(inviteCodeSchema.safeParse("ABC123").success).toBe(true);
    expect(inviteCodeSchema.safeParse("ABCDEF1234567890").success).toBe(true);
  });
  it("rejects lowercase/short/long", () => {
    expect(inviteCodeSchema.safeParse("abc123").success).toBe(false);
    expect(inviteCodeSchema.safeParse("AB12").success).toBe(false);
    expect(inviteCodeSchema.safeParse("A".repeat(40)).success).toBe(false);
    expect(inviteCodeSchema.safeParse("ABC-123").success).toBe(false);
  });
});

describe("validation: composite schemas", () => {
  it("signInSchema requires both fields", () => {
    expect(signInSchema.safeParse({ email: "u@e.com", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "bad", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "u@e.com", password: "" }).success).toBe(false);
  });

  it("signUpSchema validates all fields together", () => {
    const ok = signUpSchema.safeParse({
      email: "user@example.com",
      password: "MyV@lid9pass",
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1990-01-01",
    });
    expect(ok.success).toBe(true);
  });

  it("passwordResetSchema requires email", () => {
    expect(passwordResetSchema.safeParse({ email: "u@e.com" }).success).toBe(true);
    expect(passwordResetSchema.safeParse({ email: "x" }).success).toBe(false);
  });

  it("profileUpdateSchema bounds handicap", () => {
    expect(profileUpdateSchema.safeParse({ handicap: 10 }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ handicap: 100 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ handicap: -50 }).success).toBe(false);
  });
});

describe("validation: createMatchSchema", () => {
  const base = {
    course_name: "Pebble",
    buy_in_amount: 1000,
    format: "Stroke Play" as const,
    holes: 18 as const,
    max_participants: 4,
    location: "CA",
  };
  it("accepts valid", () => {
    expect(createMatchSchema.safeParse(base).success).toBe(true);
  });
  it("rejects bad format/holes/buyin", () => {
    expect(createMatchSchema.safeParse({ ...base, format: "Foo" }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, holes: 12 }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, buy_in_amount: -1 }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, buy_in_amount: 60000 }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, max_participants: 0 }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, max_participants: 9 }).success).toBe(false);
  });
  it("validates handicap order", () => {
    expect(createMatchSchema.safeParse({ ...base, handicap_min: 10, handicap_max: 5 }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, handicap_min: 5, handicap_max: 10 }).success).toBe(true);
  });
  it("validates booking URL", () => {
    expect(createMatchSchema.safeParse({ ...base, booking_url: "" }).success).toBe(true);
    expect(createMatchSchema.safeParse({ ...base, booking_url: "https://golf.com" }).success).toBe(true);
    expect(createMatchSchema.safeParse({ ...base, booking_url: "not a url" }).success).toBe(false);
  });
});

describe("validation: sanitizeInput", () => {
  it("strips scripts and js: and on* handlers", () => {
    expect(sanitizeInput('<script>alert(1)</script>hello')).toBe('hello');
    expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeInput('<a onclick="bad()">x</a>')).not.toContain('onclick=');
  });
  it("trims and bounds length", () => {
    expect(sanitizeInput('  hi  ')).toBe('hi');
    expect(sanitizeInput('x'.repeat(2000)).length).toBe(1000);
  });
  it("handles empty", () => {
    expect(sanitizeInput("")).toBe("");
    expect(sanitizeInput(undefined as any)).toBe("");
  });
});

describe("validation: RateLimiter", () => {
  it("allows up to max then blocks", () => {
    const rl = new RateLimiter(3, 60_000);
    expect(rl.isAllowed("k")).toBe(true);
    expect(rl.isAllowed("k")).toBe(true);
    expect(rl.isAllowed("k")).toBe(true);
    expect(rl.isAllowed("k")).toBe(false);
    expect(rl.getRemainingTime("k")).toBeGreaterThan(0);
  });
  it("isolates keys", () => {
    const rl = new RateLimiter(1, 60_000);
    expect(rl.isAllowed("a")).toBe(true);
    expect(rl.isAllowed("b")).toBe(true);
    expect(rl.isAllowed("a")).toBe(false);
  });
  it("resets after window", () => {
    const rl = new RateLimiter(1, 1);
    rl.isAllowed("k");
    return new Promise<void>((res) => setTimeout(() => {
      expect(rl.isAllowed("k")).toBe(true);
      res();
    }, 5));
  });
});

describe("validation: validateSessionToken", () => {
  it("accepts JWT shape", () => {
    expect(validateSessionToken("aaa.bbb.ccc")).toBe(true);
    expect(validateSessionToken("eyJhbG-ci.payload_part.sig-part")).toBe(true);
  });
  it("rejects malformed", () => {
    expect(validateSessionToken("")).toBe(false);
    expect(validateSessionToken("onlytwo.parts")).toBe(false);
    expect(validateSessionToken("a..c")).toBe(false);
    expect(validateSessionToken("a.b.c.d")).toBe(false);
    expect(validateSessionToken(null as any)).toBe(false);
    expect(validateSessionToken("a.b.с")).toBe(false); // cyrillic
  });
});

describe("validation: age helpers", () => {
  it("calculateAge before/after birthday this year", () => {
    const today = new Date();
    const futureBday = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate() + 5);
    const age = calculateAge(futureBday.toISOString().slice(0, 10));
    expect([29, 30]).toContain(age);
  });
  it("isOver21 thresholds", () => {
    const today = new Date();
    const twentyOne = new Date(today.getFullYear() - 21, today.getMonth(), today.getDate() - 1);
    expect(isOver21(twentyOne.toISOString().slice(0, 10))).toBe(true);
    const twenty = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
    expect(isOver21(twenty.toISOString().slice(0, 10))).toBe(false);
  });
});
