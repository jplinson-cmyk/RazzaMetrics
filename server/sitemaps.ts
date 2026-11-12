import { load } from 'cheerio';
import { validateTarget } from './crawler';
export interface SitemapTask { url: string; depth: number }
export const MAX_SITEMAP_DOCUMENTS = 10;
export const MAX_SITEMAP_DEPTH = 3;
/** Parse actual sitemap elements; index entries are never treated as page URLs. */
export function parseSitemap(xml: string, domain: string, limit: number) {
  const $ = load(xml, {xmlMode:true});
  const root = $.root().children().first();
  const name = (node: {name?:string}) => node.name?.split(':').pop()?.toLowerCase();
  const kind = root[0] && name(root[0]);
  if(kind !== 'urlset' && kind !== 'sitemapindex') throw new Error('Response is not a sitemap URL set or index.');
  const locations:string[]=[];
  root.children().each((_,entry)=>{
    if(name(entry)!==(kind==='urlset'?'url':'sitemap'))return;
    $(entry).children().each((_,node)=>{
      if(name(node)!=='loc'||locations.length>=limit)return;
      try { const url=validateTarget($(node).text().trim(),domain).href;if(!locations.includes(url))locations.push(url); } catch { /* out of scope */ }
    });
  });
  return {pages:kind==='urlset'?locations:[],sitemaps:kind==='sitemapindex'?locations:[]};
}
export function sitemapSeeds(robots: string, origin: string, domain: string): SitemapTask[] {
  const seeds=[...robots.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)].map(m=>m[1]);
  seeds.push(new URL('/sitemap.xml',origin).href);
  const unique=new Set<string>();
  for(const seed of seeds)try{unique.add(validateTarget(seed,domain).href);}catch{/* out of scope */}
  return [...unique].slice(0,MAX_SITEMAP_DOCUMENTS).map(url=>({url,depth:0}));
}
