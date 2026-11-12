import React from 'react';
import {useProject} from '../../context/ProjectContext';
export const ProjectCharts:React.FC=()=>{
  const {snapshot,issues,backlinks}=useProject();
  const dates=[...new Set(snapshot?.performance.map(r=>r.date)||[])].sort().slice(-14);
  const values=dates.map(date=>snapshot!.performance.filter(r=>r.date===date).reduce((n,r)=>n+r.clicks,0));
  const max=Math.max(1,...values);
  const groups=[{label:'Open',count:issues.filter(i=>i.status==='to-do').length,color:'var(--color-accent)'},{label:'In progress',count:issues.filter(i=>i.status==='in-progress').length,color:'var(--color-muted)'},{label:'Resolved',count:issues.filter(i=>i.status==='resolved').length,color:'var(--color-ok)'}];
  const total=groups.reduce((n,g)=>n+g.count,0);let offset=0;
  const gradient=groups.map(g=>{const start=offset;offset+=total?g.count/total*100:0;return `${g.color} ${start}% ${offset}%`;}).join(',');
  return <section className="project-charts" aria-label="Project analytics"><div className="analytics-panel"><div className="analytics-heading"><div><h2>Organic search activity</h2><p>Daily clicks from Google Search Console</p></div><span>Last 14 measured days</span></div>{dates.length?<div className="bar-chart" role="img" aria-label="Daily organic click bar graph">{dates.map((d,i)=><div className="bar-column" key={d}><span>{values[i]}</span><div className="bar-track"><div className="bar-fill" style={{height:`${values[i]/max*100}%`}} /></div><small>{d.slice(5)}</small></div>)}</div>:<div className="chart-empty"><strong>Your search activity will appear here</strong><p>Connect a Search Console property and sync your first measurements.</p></div>}</div><div className="analytics-panel"><div className="analytics-heading"><div><h2>Issue overview</h2><p>Saved tasks across this project</p></div><span>{total} total</span></div><div className="pie-layout"><div className="issue-pie" role="img" aria-label={groups.map(g=>`${g.label}: ${g.count}`).join(', ')} style={{background:total?`conic-gradient(${gradient})`:'var(--color-rule)'}}><div><strong>{total}</strong><span>issues</span></div></div><ul>{groups.map(g=><li key={g.label}><i style={{background:g.color}} />{g.label}<strong>{g.count}</strong></li>)}</ul></div><p className="chart-note">{backlinks.length} imported backlink observations, project data only</p></div></section>;
};
