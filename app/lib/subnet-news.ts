import "server-only";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type NewsImportance = "high" | "medium" | "informational";
export type NewsStatus = "verified" | "developing" | "rumor";

import type { NewsSource } from "./news-source";
export type { NewsSource } from "./news-source";
import { newsSourceIssue } from "./news-source-links.mjs";
import { validateEditorialOrder } from "./news-editorial-order.mjs";

export type NewsItem = {
  headline: string;
  summary: string;
  importance: NewsImportance;
  status: NewsStatus;
  rating?: number;
  ratingReason?: string;
  priceAction?: {
    change24hPct: number;
    observedAt: string;
    basis?: string;
  };
  sources: NewsSource[];
};

export type SubnetNews = {
  netuid: number;
  name: string;
  updates: NewsItem[];
};

export type UnlockStatus = "confirmed" | "developing" | "unverified";
export type UnlockReleaseType = "cliff" | "conviction-decay" | "unknown";

export type UpcomingUnlock = {
  netuid: number;
  name: string;
  scheduledFor: string;
  amountAlpha: number;
  releaseType: UnlockReleaseType;
  status: UnlockStatus;
  summary: string;
  sources: NewsSource[];
};

export type SubnetNewsBrief = {
  version: 1;
  date: string;
  title: string;
  summary: string;
  publishedAt: string;
  storyOrder?: string[];
  correctedAt?: string;
  correctionNote?: string;
  coverageStart: string;
  coverageEnd: string;
  highlights: NewsItem[];
  upcomingUnlocks: UpcomingUnlock[];
  subnets: SubnetNews[];
  ecosystem: NewsItem[];
  coverage: {
    searched: string[];
    gaps: string[];
  };
};

const reportsDirectory = join(process.cwd(), "content", "subnet-news");
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Subnet News: ${field} must be a non-empty string.`);
  }
}

function assertSource(value: unknown, field: string) {
  if (!isRecord(value)) throw new Error(`Subnet News: ${field} must be an object.`);
  assertString(value.label, `${field}.label`);
  assertString(value.url, `${field}.url`);
  const issue = newsSourceIssue(value as NewsSource);
  if (issue) throw new Error(`Subnet News: ${field}: ${issue}.`);
}

function assertNewsItem(value: unknown, field: string) {
  if (!isRecord(value)) throw new Error(`Subnet News: ${field} must be an object.`);
  assertString(value.headline, `${field}.headline`);
  assertString(value.summary, `${field}.summary`);
  if (!["high", "medium", "informational"].includes(value.importance as string)) {
    throw new Error(`Subnet News: ${field}.importance is invalid.`);
  }
  if (!["verified", "developing", "rumor"].includes(value.status as string)) {
    throw new Error(`Subnet News: ${field}.status is invalid.`);
  }
  if (value.rating !== undefined && (!Number.isInteger(value.rating) || (value.rating as number) < 1 || (value.rating as number) > 5)) {
    throw new Error(`Subnet News: ${field}.rating must be an integer from 1 to 5.`);
  }
  if (value.rating !== undefined) assertString(value.ratingReason, `${field}.ratingReason`);
  if (value.priceAction !== undefined) {
    if (!isRecord(value.priceAction)) throw new Error(`Subnet News: ${field}.priceAction must be an object.`);
    if (typeof value.priceAction.change24hPct !== "number" || !Number.isFinite(value.priceAction.change24hPct)) {
      throw new Error(`Subnet News: ${field}.priceAction.change24hPct must be a number.`);
    }
    assertString(value.priceAction.observedAt, `${field}.priceAction.observedAt`);
    if (Number.isNaN(Date.parse(value.priceAction.observedAt as string))) {
      throw new Error(`Subnet News: ${field}.priceAction.observedAt must be an ISO timestamp.`);
    }
    if (value.priceAction.basis !== undefined) assertString(value.priceAction.basis, `${field}.priceAction.basis`);
  }
  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    throw new Error(`Subnet News: ${field}.sources must include at least one source.`);
  }
  value.sources.forEach((source, index) => assertSource(source, `${field}.sources[${index}]`));
}

function assertUpcomingUnlock(value: unknown, field: string) {
  if (!isRecord(value)) throw new Error(`Subnet News: ${field} must be an object.`);
  if (!Number.isInteger(value.netuid) || (value.netuid as number) < 0) {
    throw new Error(`Subnet News: ${field}.netuid must be a non-negative integer.`);
  }
  assertString(value.name, `${field}.name`);
  assertString(value.scheduledFor, `${field}.scheduledFor`);
  if (!datePattern.test(value.scheduledFor as string)) {
    throw new Error(`Subnet News: ${field}.scheduledFor must use YYYY-MM-DD.`);
  }
  if (typeof value.amountAlpha !== "number" || !Number.isFinite(value.amountAlpha) || value.amountAlpha <= 0) {
    throw new Error(`Subnet News: ${field}.amountAlpha must be a positive number.`);
  }
  if (!["cliff", "conviction-decay", "unknown"].includes(value.releaseType as string)) {
    throw new Error(`Subnet News: ${field}.releaseType is invalid.`);
  }
  if (!["confirmed", "developing", "unverified"].includes(value.status as string)) {
    throw new Error(`Subnet News: ${field}.status is invalid.`);
  }
  assertString(value.summary, `${field}.summary`);
  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    throw new Error(`Subnet News: ${field}.sources must include at least one source.`);
  }
  value.sources.forEach((source, index) => assertSource(source, `${field}.sources[${index}]`));
}

export function validateSubnetNewsBrief(value: unknown): asserts value is SubnetNewsBrief {
  if (!isRecord(value)) throw new Error("Subnet News: report must be an object.");
  if (value.version !== 1) throw new Error("Subnet News: version must be 1.");
  assertString(value.date, "date");
  if (!datePattern.test(value.date as string)) throw new Error("Subnet News: date must use YYYY-MM-DD.");
  assertString(value.title, "title");
  assertString(value.summary, "summary");
  assertString(value.publishedAt, "publishedAt");
  if (value.correctedAt !== undefined || value.correctionNote !== undefined) {
    assertString(value.correctedAt, "correctedAt"); assertString(value.correctionNote, "correctionNote");
    if (!Number.isFinite(Date.parse(String(value.correctedAt))) || Date.parse(String(value.correctedAt)) < Date.parse(String(value.publishedAt))) throw new Error("Correction time must follow publication");
  }
  assertString(value.coverageStart, "coverageStart");
  assertString(value.coverageEnd, "coverageEnd");
  for (const field of ["publishedAt", "coverageStart", "coverageEnd"] as const) {
    if (Number.isNaN(Date.parse(value[field] as string))) {
      throw new Error(`Subnet News: ${field} must be an ISO timestamp.`);
    }
  }
  if (!Array.isArray(value.highlights)) throw new Error("Subnet News: highlights must be an array.");
  value.highlights.forEach((item, index) => assertNewsItem(item, `highlights[${index}]`));
  if (!Array.isArray(value.upcomingUnlocks)) throw new Error("Subnet News: upcomingUnlocks must be an array.");
  value.upcomingUnlocks.forEach((item, index) => assertUpcomingUnlock(item, `upcomingUnlocks[${index}]`));
  if (!Array.isArray(value.ecosystem)) throw new Error("Subnet News: ecosystem must be an array.");
  value.ecosystem.forEach((item, index) => assertNewsItem(item, `ecosystem[${index}]`));
  if (!Array.isArray(value.subnets)) throw new Error("Subnet News: subnets must be an array.");
  const seenNetuids = new Set<number>();
  value.subnets.forEach((subnet, index) => {
    if (!isRecord(subnet)) throw new Error(`Subnet News: subnets[${index}] must be an object.`);
    if (!Number.isInteger(subnet.netuid) || (subnet.netuid as number) < 0) {
      throw new Error(`Subnet News: subnets[${index}].netuid must be a non-negative integer.`);
    }
    if (seenNetuids.has(subnet.netuid as number)) {
      throw new Error(`Subnet News: duplicate SN${subnet.netuid}.`);
    }
    seenNetuids.add(subnet.netuid as number);
    assertString(subnet.name, `subnets[${index}].name`);
    if (!Array.isArray(subnet.updates)) throw new Error(`Subnet News: subnets[${index}].updates must be an array.`);
    subnet.updates.forEach((item, itemIndex) => assertNewsItem(item, `subnets[${index}].updates[${itemIndex}]`));
  });
  validateEditorialOrder(value);
  if (!isRecord(value.coverage)) throw new Error("Subnet News: coverage must be an object.");
  for (const field of ["searched", "gaps"] as const) {
    if (!Array.isArray(value.coverage[field]) || !(value.coverage[field] as unknown[]).every((entry) => typeof entry === "string")) {
      throw new Error(`Subnet News: coverage.${field} must be an array of strings.`);
    }
  }
}

function readBrief(filename: string) {
  const raw = JSON.parse(readFileSync(join(reportsDirectory, filename), "utf8")) as unknown;
  validateSubnetNewsBrief(raw);
  if (filename !== `${raw.date}.json`) {
    throw new Error(`Subnet News: ${filename} must match its report date (${raw.date}.json).`);
  }
  return raw;
}

export function getSubnetNewsBriefs() {
  try {
    return readdirSync(reportsDirectory)
      .filter((filename) => datePattern.test(filename.replace(/\.json$/, "")) && filename.endsWith(".json"))
      .map(readBrief)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    if (isRecord(error) && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export function getSubnetNewsBrief(date: string) {
  if (!datePattern.test(date)) return null;
  return getSubnetNewsBriefs().find((brief) => brief.date === date) ?? null;
}

export function formatBriefDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date(`${date}T12:00:00-04:00`));
}
