import type { SubnetNewsBrief, NewsItem } from "./subnet-news";
export type EditionEntry = {item:NewsItem;context:string};
/** Preserve distinct versions; collapse only identical stories repeated across desks. */
export function rankEdition(brief:Pick<SubnetNewsBrief,"highlights"|"ecosystem"|"subnets">):EditionEntry[]{
 const entries=[...brief.highlights.map(item=>({item,context:"Network"})),...brief.ecosystem.map(item=>({item,context:"Ecosystem"})),...brief.subnets.flatMap(subnet=>subnet.updates.map(item=>({item,context:`SN${subnet.netuid} · ${subnet.name}`})))];
 const unique=new Map<string,EditionEntry>();
 for(const entry of entries){const key=JSON.stringify(entry.item);const prior=unique.get(key);if(!prior)unique.set(key,entry);else if(entry.context.startsWith("SN")&&!prior.context.startsWith("SN"))prior.context=entry.context;}
 return [...unique.values()].sort((a,b)=>(b.item.rating??0)-(a.item.rating??0)||Number(Boolean(b.item.priceAction))-Number(Boolean(a.item.priceAction)));
}
