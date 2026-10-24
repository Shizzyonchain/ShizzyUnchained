import { checkOwnedNewsLinks } from "./check-news-links.mjs";
import { newsSourceIssue } from "../app/lib/news-source-links.mjs";
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateChainReviews } from "./news-chain-review.mjs";
import { validateMarketReview } from "./news-market-review.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const reportsDirectory = join(root, "content", "subnet-news");
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const importances = new Set(["high", "medium", "informational"]);
const statuses = new Set(["verified", "developing", "rumor"]);
const unlockStatuses = new Set(["confirmed", "developing", "unverified"]);
const unlockReleaseTypes = new Set(["cliff", "conviction-decay", "unknown"]);

function fail(message) {
  throw new Error(`Subnet News: ${message}`);
}

function object(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object.`);
}

function string(value, field) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be a non-empty string.`);
}

function item(value, field) {
  object(value, field);
  string(value.headline, `${field}.headline`);
  string(value.summary, `${field}.summary`);
  if (!importances.has(value.importance)) fail(`${field}.importance is invalid.`);
  if (!statuses.has(value.status)) fail(`${field}.status is invalid.`);
  if (!Array.isArray(value.sources) || !value.sources.length) fail(`${field}.sources must not be empty.`);
  value.sources.forEach((source, index) => {
    object(source, `${field}.sources[${index}]`);
    string(source.label, `${field}.sources[${index}].label`);
    string(source.url, `${field}.sources[${index}].url`);
    const issue = newsSourceIssue(source);
    if (issue) fail(`${field}.sources[${index}]: ${issue}.`);
  });
}

function unlock(value, field) {
  object(value, field);
  if (!Number.isInteger(value.netuid) || value.netuid < 0) fail(`${field}.netuid must be a non-negative integer.`);
  string(value.name, `${field}.name`);
  string(value.scheduledFor, `${field}.scheduledFor`);
  if (!datePattern.test(value.scheduledFor)) fail(`${field}.scheduledFor must use YYYY-MM-DD.`);
  if (typeof value.amountAlpha !== "number" || !Number.isFinite(value.amountAlpha) || value.amountAlpha <= 0) {
    fail(`${field}.amountAlpha must be a positive number.`);
  }
  if (!unlockReleaseTypes.has(value.releaseType)) fail(`${field}.releaseType is invalid.`);
  if (!unlockStatuses.has(value.status)) fail(`${field}.status is invalid.`);
  string(value.summary, `${field}.summary`);
  if (!Array.isArray(value.sources) || !value.sources.length) fail(`${field}.sources must not be empty.`);
  value.sources.forEach((source, index) => {
    object(source, `${field}.sources[${index}]`);
    string(source.label, `${field}.sources[${index}].label`);
    string(source.url, `${field}.sources[${index}].url`);
    const issue = newsSourceIssue(source);
    if (issue) fail(`${field}.sources[${index}]: ${issue}.`);
  });
}

function validate(value, filename) {
  object(value, "report");
  if (value.version !== 1) fail("version must be 1.");
  string(value.date, "date");
  if (!datePattern.test(value.date)) fail("date must use YYYY-MM-DD.");
  if (filename !== `${value.date}.json`) fail(`${filename} must match the report date (${value.date}.json).`);
  for (const field of ["title", "summary", "publishedAt", "coverageStart", "coverageEnd"]) string(value[field], field);
  if (value.correctedAt !== undefined || value.correctionNote !== undefined) {
    string(value.correctedAt, "correctedAt"); string(value.correctionNote, "correctionNote");
    if (!Number.isFinite(Date.parse(value.correctedAt)) || Date.parse(value.correctedAt) < Date.parse(value.publishedAt)) throw new Error("Correction time must follow publication");
  }
  for (const field of ["publishedAt", "coverageStart", "coverageEnd"]) {
    if (Number.isNaN(Date.parse(value[field]))) fail(`${field} must be an ISO timestamp.`);
  }
  for (const field of ["highlights", "upcomingUnlocks", "ecosystem", "subnets"]) {
    if (!Array.isArray(value[field])) fail(`${field} must be an array.`);
  }
  value.highlights.forEach((entry, index) => item(entry, `highlights[${index}]`));
  value.upcomingUnlocks.forEach((entry, index) => unlock(entry, `upcomingUnlocks[${index}]`));
  value.ecosystem.forEach((entry, index) => item(entry, `ecosystem[${index}]`));
  const netuids = new Set();
  value.subnets.forEach((subnet, index) => {
    object(subnet, `subnets[${index}]`);
    if (!Number.isInteger(subnet.netuid) || subnet.netuid < 0) fail(`subnets[${index}].netuid must be a non-negative integer.`);
    if (netuids.has(subnet.netuid)) fail(`duplicate SN${subnet.netuid}.`);
    netuids.add(subnet.netuid);
    string(subnet.name, `subnets[${index}].name`);
    if (!Array.isArray(subnet.updates)) fail(`subnets[${index}].updates must be an array.`);
    subnet.updates.forEach((entry, itemIndex) => item(entry, `subnets[${index}].updates[${itemIndex}]`));
  });
  object(value.coverage, "coverage");
  for (const field of ["searched", "gaps"]) {
    if (!Array.isArray(value.coverage[field]) || !value.coverage[field].every((entry) => typeof entry === "string")) {
      fail(`coverage.${field} must be an array of strings.`);
    }
  }
  return value;
}

function readAndValidate(path) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (value.date >= "2026-09-26") {
    const audit = JSON.parse(readFileSync(join(reportsDirectory, "audits", `${value.date}.json`), "utf8"));
    validateMarketReview(value, audit);
    if (value.date >= "2026-10-24") validateChainReviews(value, audit, {
      etao: JSON.parse(readFileSync(join(root, "app/data/etao.json"), "utf8")),
      burns: JSON.parse(readFileSync(join(root, "app/data/burns.json"), "utf8")),
    });
  }
  return validate(value, basename(path));
}

if (process.argv[2] === "--check") {
  mkdirSync(reportsDirectory, { recursive: true });
  const files = readdirSync(reportsDirectory).filter((file) => file.endsWith(".json"));
  files.forEach((file) => readAndValidate(join(reportsDirectory, file)));
  console.log(`Validated ${files.length} Subnet News report${files.length === 1 ? "" : "s"}.`);
} else {
  const input = process.argv[2];
  if (!input) fail("provide the path to a report JSON file.");
  const inputPath = resolve(input);
  const report = readAndValidate(inputPath);
  await checkOwnedNewsLinks(report);
  mkdirSync(reportsDirectory, { recursive: true });
  const destination = join(reportsDirectory, `${report.date}.json`);
  copyFileSync(inputPath, destination);
  console.log(`Published ${report.date} to ${destination}`);
}
