import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractCourseNames, extractFormats, sanitize } from "./index.ts";

// ---------- sanitize ----------
Deno.test("sanitize: returns 'Unknown' for null/undefined/empty", () => {
  assertEquals(sanitize(null), "Unknown");
  assertEquals(sanitize(undefined), "Unknown");
  assertEquals(sanitize(""), "Unknown");
});

Deno.test("sanitize: strips disallowed characters", () => {
  assertEquals(sanitize("Pebble<script>Beach!"), "PebblescriptBeach");
  assertEquals(sanitize("St. Andrews, Old-Course"), "St. Andrews, Old-Course");
});

Deno.test("sanitize: truncates to 100 chars", () => {
  const long = "a".repeat(250);
  assertEquals(sanitize(long).length, 100);
});

// ---------- extractCourseNames ----------
Deno.test("extractCourseNames: null/undefined/empty -> 'None'", () => {
  assertEquals(extractCourseNames(null), "None");
  assertEquals(extractCourseNames(undefined), "None");
  assertEquals(extractCourseNames([]), "None");
});

Deno.test("extractCourseNames: object-shaped relation", () => {
  const history = [
    { matches: { course_name: "Pebble Beach", format: "stroke" } },
    { matches: { course_name: "Augusta", format: "match" } },
  ];
  assertEquals(extractCourseNames(history), "Pebble Beach, Augusta");
});

Deno.test("extractCourseNames: array-shaped relation (Supabase variant)", () => {
  const history = [
    { matches: [{ course_name: "Pebble Beach", format: "stroke" }] },
    { matches: [{ course_name: "Augusta", format: "match" }] },
  ];
  assertEquals(extractCourseNames(history), "Pebble Beach, Augusta");
});

Deno.test("extractCourseNames: filters missing/null relations and names", () => {
  const history = [
    { matches: { course_name: "Pebble Beach" } },
    { matches: null },
    { matches: { course_name: null } },
    { matches: [] },
    {},
    { matches: { course_name: "Augusta" } },
  ];
  assertEquals(extractCourseNames(history), "Pebble Beach, Augusta");
});

Deno.test("extractCourseNames: all entries missing names -> 'None'", () => {
  const history = [{ matches: null }, { matches: { course_name: null } }, {}];
  assertEquals(extractCourseNames(history), "None");
});

Deno.test("extractCourseNames: sanitizes special chars", () => {
  const history = [{ matches: { course_name: "Pebble<script>Beach" } }];
  assertEquals(extractCourseNames(history), "PebblescriptBeach");
});

// ---------- extractFormats ----------
Deno.test("extractFormats: null/undefined/empty -> 'None'", () => {
  assertEquals(extractFormats(null), "None");
  assertEquals(extractFormats(undefined), "None");
  assertEquals(extractFormats([]), "None");
});

Deno.test("extractFormats: object relation, deduplicates", () => {
  const history = [
    { matches: { format: "stroke" } },
    { matches: { format: "match" } },
    { matches: { format: "stroke" } },
  ];
  assertEquals(extractFormats(history), "stroke, match");
});

Deno.test("extractFormats: array relation, deduplicates", () => {
  const history = [
    { matches: [{ format: "stroke" }] },
    { matches: [{ format: "stroke" }] },
    { matches: [{ format: "scramble" }] },
  ];
  assertEquals(extractFormats(history), "stroke, scramble");
});

Deno.test("extractFormats: filters missing/null formats", () => {
  const history = [
    { matches: { format: "stroke" } },
    { matches: { format: null } },
    { matches: null },
    {},
    { matches: { format: "match" } },
  ];
  assertEquals(extractFormats(history), "stroke, match");
});

Deno.test("extractFormats: all formats missing -> 'None'", () => {
  const history = [{ matches: { format: null } }, {}, { matches: null }];
  assertEquals(extractFormats(history), "None");
});

Deno.test("extractFormats: mixed object/array shapes in same list", () => {
  const history = [
    { matches: { format: "stroke" } },
    { matches: [{ format: "match" }] },
    { matches: [{ format: "stroke" }] },
  ];
  assertEquals(extractFormats(history), "stroke, match");
});
