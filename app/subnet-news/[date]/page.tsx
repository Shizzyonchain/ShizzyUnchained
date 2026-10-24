import { withSocialMetadata } from "../../lib/social-metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSubnetNewsBrief, getSubnetNewsBriefs } from "../../lib/subnet-news";
import { NewsEdition } from "../news-edition";
export const dynamicParams = false;

export function generateStaticParams() {
  return getSubnetNewsBriefs().map((brief) => ({ date: brief.date }));
}

export async function generateMetadata({ params }: PageProps<"/subnet-news/[date]">): Promise<Metadata> {
  const { date } = await params;
  const brief = getSubnetNewsBrief(date);
  if (!brief) return {};
  return withSocialMetadata({
    title: `${brief.title} | Subnet News`,
    description: brief.summary,
    alternates: { canonical: `/subnet-news/${date}` },
  }, `/subnet-news/${date}`, { article: true, publishedTime: brief.publishedAt });
}

export default async function SubnetNewsBriefPage({params}:PageProps<"/subnet-news/[date]">){const {date}=await params;const brief=getSubnetNewsBrief(date);if(!brief)notFound();return <NewsEdition brief={brief} briefs={getSubnetNewsBriefs()}/>;}
