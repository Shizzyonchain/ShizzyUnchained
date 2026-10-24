import type { Metadata } from "next";
import { withSocialMetadata } from "../lib/social-metadata";
import { getSubnetNewsBriefs } from "../lib/subnet-news";
import { NewsEdition } from "./news-edition";
import { SubnetNewsHeader } from "./subnet-news-header";
export const metadata:Metadata=withSocialMetadata({title:"Bittensor Daily News | Shizzy Unchained",description:"Read the latest Bittensor daily news immediately: subnet releases, research, partnerships, chain changes and sourced updates. Browse every previous edition.",alternates:{canonical:"/subnet-news"}},"/subnet-news");
export default function SubnetNewsPage(){const briefs=getSubnetNewsBriefs();return briefs[0]?<NewsEdition brief={briefs[0]} briefs={briefs}/>:<main className="news-shell"><SubnetNewsHeader/><section className="news-coming"><h1>Bittensor Daily News</h1><p>The first edition will appear here when published.</p></section></main>;}
