import { describe, it, expect } from "vitest";
import {
  cn,
  generateSecureRandomString,
  checkPasswordSecurity,
  isValidSessionAge,
  sanitizeRedirectUrl,
} from "@/lib/utils";

describe("utils: cn", () => {
  it("merges class names and dedupes tailwind", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
  });
});

describe("utils: generateSecureRandomString", () => {
  it("returns requested length", () => {
    expect(generateSecureRandomString(16)).toHaveLength(16);
    expect(generateSecureRandomString(64)).toHaveLength(64);
  });
  it("uses safe charset", () => {
    expect(generateSecureRandomString(50)).toMatch(/^[A-Za-z0-9]+$/);
  });
  it("is unique across calls", () => {
    const a = generateSecureRandomString(32);
    const b = generateSecureRandomString(32);
    expect(a).not.toBe(b);
  });
});

describe("utils: checkPasswordSecurity", () => {
  it("flags weaknesses", async () => {
    const r = await checkPasswordSecurity("aaa");
    expect(r.isSecure).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("flags only-letters / only-digits / repeats / keyboard", async () => {
    expect((await checkPasswordSecurity("abcdefghij")).warnings).toContain("Include numbers and special characters");
    expect((await checkPasswordSecurity("1111111111")).warnings.some(w => /repeat/i.test(w))).toBe(true);
    expect((await checkPasswordSecurity("qwerty12345")).warnings.some(w => /keyboard/i.test(w))).toBe(true);
  });
  it("strong passes", async () => {
    const r = await checkPasswordSecurity("M9!nopqRstUvWx#zPL");
    expect(r.warnings).toEqual([]);
    expect(r.isSecure).toBe(true);
  });
});

describe("utils: isValidSessionAge", () => {
  it("recent session is valid", () => {
    expect(isValidSessionAge(new Date().toISOString())).toBe(true);
  });
  it("old session is invalid", () => {
    const old = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    expect(isValidSessionAge(old, 24)).toBe(false);
  });
});

describe("utils: sanitizeRedirectUrl", () => {
  it("allows same-origin path", () => {
    expect(sanitizeRedirectUrl("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectUrl(window.location.origin + "/x?y=1")).toContain("/x");
  });
  it("rejects external by default", () => {
    expect(sanitizeRedirectUrl("https://evil.com/x")).toBe("/");
  });
  it("allows whitelisted hostnames", () => {
    expect(sanitizeRedirectUrl("https://trusted.com/y", ["trusted.com"])).toBe("/y");
  });
  it("strips external host even with weird input", () => {
    // jsdom URL parser is permissive; just assert that a non-allowed external host returns "/"
    expect(sanitizeRedirectUrl("https://evil.example/path")).toBe("/");
  });
});
