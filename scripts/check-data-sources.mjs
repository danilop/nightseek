#!/usr/bin/env node
// Opt-in/network smoke check, kept out of deterministic unit tests. Public endpoints only.
import { appendFileSync } from 'node:fs';
const base='https://services.swpc.noaa.gov/json/';
const recent=(value,hours)=>Number.isFinite(Date.parse(value))&&Math.abs(Date.now()-Date.parse(value))<hours*3600000;
const checks=[
 ['NOAA flare schema',base+'solar_probabilities.json',d=>Array.isArray(d)&&d.some(r=>recent(r.date,48)&&typeof r.c_class_1_day==='number'&&typeof r.x_class_3_day==='number')],
 ['NOAA flux freshness',base+'f107_cm_flux.json',d=>Array.isArray(d)&&d.some(r=>recent(r.time_tag+'Z',48)&&typeof r.flux==='number')],
 ['NOAA Kp freshness',base+'planetary_k_index_1m.json',d=>Array.isArray(d)&&d.some(r=>recent(r.time_tag+'Z',1)&&typeof r.estimated_kp==='number')],
 ['NOAA sunspot schema',base+'sunspot_report.json',d=>Array.isArray(d)&&d.some(r=>recent(r.Obsdate+'Z',48)&&'Spotclass' in r&&'Magclass' in r)],
 ['NOAA OVATION',base+'ovation_aurora_latest.json',d=>recent(d['Forecast Time'],2)&&Array.isArray(d.coordinates)&&d.coordinates.length>100],
 ['CelesTrak OMM','https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON',d=>Array.isArray(d)&&d.some(r=>r.NORAD_CAT_ID===25544&&recent(r.EPOCH+'Z',48)&&r.MEAN_MOTION>0)],
 ['London geocoding','https://geocoding-api.open-meteo.com/v1/search?name=London&count=1&language=en&format=json',d=>d.results?.[0]?.timezone==='Europe/London'],
 ['London independent weather','https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=51.507&lon=-0.128',d=>recent(d.properties?.meta?.updated_at,24)&&d.properties?.timeseries?.length>0],
];
let failed=0;
const lines=[];
for(const [name,url,validate] of checks){
 try{
  const response=await fetch(url,{headers:{'User-Agent':'NightSeek/1.0 (+https://nightseek.danilop.net/)'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  if(!validate(await response.json()))throw new Error('schema or freshness check failed');
  lines.push(`- PASS: ${name}`);
 }catch(error){failed++;lines.push(`- FAIL: ${name}: ${error.message}`);}
}
console.log(lines.join('\n'));
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\n### Public source checks (${new Date().toISOString()})\n${lines.join('\n')}\n`);
process.exitCode=failed?1:0;
