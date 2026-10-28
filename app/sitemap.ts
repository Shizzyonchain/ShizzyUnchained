import type { MetadataRoute } from "next";
import { chartPaths, siteOrigin } from "./lib/seo";
import { getSubnetNewsBriefs } from "./lib/subnet-news";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteOrigin;
  const pages = [
    "",
    "/start-here",
    "/activity",
    "/balls",
    "/wallet-tracker",
    "/validators",
    "/validators/root",
    "/subnet-news",
    "/subnet-news/etao",
    "/subnet-news/burns",
    "/subnet-news/exploit-conference-catch-up",
    "/subnet-news/exploit-conference-catch-up-day-2",
    "/sectors",
    "/deep-dives/bittensor-v440",
    "/deep-dives/compute-wars",
    "/deep-dives/arbos-root-basket",
    "/video",
    "/university",
    "/partners",
    "/about",
    "/privacy",
    "/tao-heads",
  ];
  const staticPages: MetadataRoute.Sitemap = pages.map((path, index) => ({
    url: `${base}${path}`,
    changeFrequency: index === 0 ? "always" : index < 4 ? "daily" : "weekly",
    priority: index === 0 ? 1 : index < 4 ? 0.8 : 0.6,
  }));
  const newsPages: MetadataRoute.Sitemap = getSubnetNewsBriefs().map((brief) => ({
    url: `${base}/subnet-news/${brief.date}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  const charts: MetadataRoute.Sitemap = chartPaths.map(path => ({ url: `${base}${path}`, changeFrequency: "daily", priority: 0.7 }));
  return [...staticPages, ...charts, ...newsPages];
}
