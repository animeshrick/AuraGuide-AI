import bn from "@/i18n/bn.json";
import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";
import { formatMessage, getDictionary, isSupportedLanguage } from "@/i18n";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const flatEn = flatten(en);
const flatHi = flatten(hi);
const flatBn = flatten(bn);

describe("dictionaries", () => {
  it("have the same keys in all three languages", () => {
    expect(Object.keys(flatHi).sort()).toEqual(Object.keys(flatEn).sort());
    expect(Object.keys(flatBn).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it("use the same {placeholders} in every language", () => {
    for (const key of Object.keys(flatEn)) {
      expect(placeholders(flatHi[key]), `hi ${key}`).toEqual(placeholders(flatEn[key]));
      expect(placeholders(flatBn[key]), `bn ${key}`).toEqual(placeholders(flatEn[key]));
    }
  });

  it("have no empty text", () => {
    for (const flat of [flatEn, flatHi, flatBn]) {
      for (const [key, value] of Object.entries(flat)) {
        expect(value.trim().length, key).toBeGreaterThan(0);
      }
    }
  });

  it("are actually translated", () => {
    const keys = Object.keys(flatEn).filter((k) => flatEn[k].length > 25);
    const sameAsEnglishHi = keys.filter((k) => flatHi[k] === flatEn[k]);
    const sameAsEnglishBn = keys.filter((k) => flatBn[k] === flatEn[k]);
    expect(sameAsEnglishHi).toEqual([]);
    expect(sameAsEnglishBn).toEqual([]);
  });

  it("contain Devanagari and Bengali script", () => {
    expect(flatHi["hero.title"]).toMatch(/[ऀ-ॿ]/);
    expect(flatBn["hero.title"]).toMatch(/[ঀ-৿]/);
  });
});

describe("helpers", () => {
  it("fills placeholders and leaves unknown ones alone", () => {
    expect(formatMessage("Hello {name}, AQI {aqi}", { name: "Asha", aqi: 210 })).toBe(
      "Hello Asha, AQI 210"
    );
    expect(formatMessage("Hello {name}", {})).toBe("Hello {name}");
  });

  it("does not run user text as a template", () => {
    expect(formatMessage("Hi {name}", { name: "{aqi}", aqi: 5 })).toBe("Hi {aqi}");
  });

  it("falls back to English for an unknown language", () => {
    expect(getDictionary("xx" as never)).toBe(getDictionary("en"));
  });

  it("recognises supported languages", () => {
    expect(isSupportedLanguage("hi")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
  });
});
