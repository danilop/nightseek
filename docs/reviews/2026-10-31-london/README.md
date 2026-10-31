# London data and API review — 31 October 2026

## Verdict

**Implementation follow-up, 31 October:** the defects identified below have been addressed, and the recommended free API integrations implemented. Follow-up checks cover London, New York, Tromsø, Quito, Sydney, Auckland and Honolulu, including polar conditions and the exact spring/autumn clock-change periods. The final suite passes 1,060 tests; coverage exceeds all configured thresholds. Type checking, the web production build and the mobile-wrapper build pass. The mobile satellite adapter was updated alongside the web adapter for JSON orbital elements.

Weather evidence now exposes missing inputs and forecast disagreement; unavailable ICON gusts do not hide its global cloud/rain evidence or imply calm winds. Repeated local times carry UTC offsets, missing clock-change hours are rejected in exposure input, and elapsed durations/calendar exports retain their actual instants. Five-star cards contain exactly five stars and reserve equal space for the Best label.

DONKI still returns HTTP 503 in the captured checks: its retained snapshot is labelled stale/unknown, rather than interpreted as no activity. Independent checks establish calculation/adapter consistency and source availability, not the accuracy of future weather or every catalogue object. The findings and original evidence below are preserved as the pre-fix audit record.

**Original review verdict:** the core astronomical calculations passed the independent spot checks, but the application had confirmed parsing, freshness, labelling and local-observability defects. Fixing these offered more immediate value than replacing the weather provider.

Recommended direction: retain Astronomy Engine, Open-Meteo, OpenNGC and CelesTrak; repair data contracts and missing-data handling; add weather uncertainty and local aurora context; then enrich target details and field-of-view planning. No provider change is established as more accurate by this review.

The following sections describe the original review; the implementation follow-up above supersedes their unresolved status.

## Scope and evidence

- Location: central London, **51.5074° N, 0.1278° W**, `Europe/London`. The reverse-geocoded label “City of Westminster” is appropriate. All times below are GMT/UTC.
- Forecast: seven nights, **31 October–6 November 2026**, including the following mornings. Live source snapshots were collected around 21:09–21:11 UTC, with independent checks later that evening.
- Code: local HEAD `f4628cb975ec17209f159271c5a8c3c8cdf33a72`. The local bundled astronomy snapshots are from September. Remote `main` metadata was checked separately; local staleness is not evidence of production staleness.
- Methods: browser inspection; source-to-output tracing; execution of the real forecast/calculation modules; saved live API responses; independent USNO and JPL comparisons; one deliberately synthetic rain case; alternative-provider requests.
- Existing tests: **64 files, 835 tests passed**, using `cd web && pnpm exec vitest run`. This does not validate live upstream schemas or forecast skill.
- [Evidence snapshot](evidence.json) contains inputs, output excerpts, dates, comparisons and source request metadata. API keys were redacted. Large object tracks and the full OpenNGC catalogue are omitted.

“Confirmed” below means demonstrated by source/output evidence, not independently observed in the sky. Future weather cannot be confirmed correct before observations exist. This review does not certify every catalogue object, every future event or every location.

## What checked out

### Sun, Moon and position calculations

The independent [USNO API](https://aa.usno.navy.mil/data/api) gives the following minute-rounded values. NightSeek's underlying seconds agree within the sources' displayed precision. The UI truncates minutes, which explains one-minute display differences such as 06:53 versus 06:54.

| Event | NightSeek calculation | USNO |
|---|---|---|
| Sunset, 31 October | 16:35:21 | 16:35 |
| End civil twilight, 31 October | 17:10:23 | 17:10 |
| Moonrise, 31 October | 21:00:47 | 21:01 |
| Sunrise, 1 November | 06:53:55 | 06:54 |
| Moonset, 1 November | 13:42:42 | 13:43 |

NightSeek's astronomical dark window is 18:28:23–05:00:30, approximately 10 h 32 m. This boundary was reviewed in the calculation code; the USNO endpoint above supplies civil twilight, not an independent astronomical-twilight comparison.

At 00:00 UTC on 1 November, angular separations between NightSeek and [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) were:

| Body | Position separation |
|---|---:|
| Moon | 7.3 arcsec |
| Jupiter | 7.6 arcsec |
| Saturn | 8.0 arcsec |
| Pluto | 3.7 arcsec |
| Ceres | 11.0 arcsec |
| Vesta | 7.6 arcsec |
| Pallas | 7.3 arcsec |

These are small for observation planning. The comparison includes small frame/parallax differences: JPL used the London observer, while the minor-planet routine returns geocentric coordinates. It is a single-epoch spot check, not an error bound over all dates. JPL altitudes were airless, so they were not directly compared against the app's refracted altitudes near the horizon.

Moon illumination also passed a like-for-like check: **59.74624%** in NightSeek versus **59.74317%** from geocentric Horizons at midnight. The London topocentric Horizons value is 59.11915%; that difference is observer geometry, not a demonstrated bug. The app's **59.867%** for the night is evaluated earlier, at the dark-window midpoint. USNO's daily illumination should not be compared to a different-time night summary.

### Weather transformation and honest existing labels

All seven nightly cloud averages exactly match recomputation from their 11 hourly records: **43.18, 72.27, 0, 48.91, 86, 48.55 and 19.27%**. The requested interval includes the morning after the final night; Unix timestamps avoid ambiguous local-time parsing in this London run. Wind, visibility, precipitation and air-quality units were traced through the source and output structures.

The UI correctly describes seeing as a weather-only estimate, not measured FWHM; sky brightness as a modelled moonless baseline; meteor rates as geometric ceilings, not personal rate forecasts; historical cloud data as daily history; and Kp outlook as global rather than a guarantee of local aurora.

## Findings, ordered by user impact

### 1. A rainy window can receive five stars — high priority, confirmed

`web/src/lib/weather/open-meteo.ts` (`scoreObservingHour`, `findBestObservingTime`) and `night-quality.ts` omit precipitation from headline window eligibility/rating. The target-specific imaging-window code already rejects rain, so the two parts can disagree.

A synthetic 11-hour input with 1 mm/hour of rain and 100% precipitation probability, otherwise favourable values, returns “Clear skies”, a three-hour best window, and **79 points / five stars / Excellent**. This is a robustness reproducer, not the observed London forecast; London’s first sampled night had no predicted rain.

**Action:** use a shared observing-window eligibility rule for headline and target windows. Explicitly represent rain/snow, fog/very poor visibility and excessive gusts. If no usable interval remains, show that outcome. Missing weather must remain unknown rather than becoming favourable. Test realistic mixed-cloud showers as well as the extreme synthetic case.

### 2. Several NOAA SWPC adapters disagree with the live schemas — high priority, confirmed

Owning code: `web/src/lib/nasa/swpc.ts`; presentation: `web/src/components/forecast/SpaceWeatherCard.tsx`.

These adapter results were reproduced by calling the actual module against captured live responses. The legacy space-weather card is conditional on nonempty DONKI events, so it was **not visible in the current empty London snapshot**. The separate Overview Kp outlook is visible and uses a different parser; these findings must not be attributed to that correctly labelled forecast card.

| Feed | Observed source | Current interpretation | Required correction |
|---|---|---|---|
| Solar flare probabilities | `date`, `c_class_1_day`, `m_class_1_day`, `x_class_1_day`; latest 25%, 1%, 1% | Parser expects other names, produces empty dates and zero probabilities; UI can hide the row | Parse documented/observed fields and forecast horizons; reject unknown schemas |
| F10.7 flux | Newest-first; 31 Oct 20:00 = **92** | Takes last record: **100**, from 20 Sept 17:00, 41 days earlier | Select maximum valid observation timestamp; expose its age |
| Sunspot report | Historical station reports; 296 rows, 270 with region IDs | Counts all 270 as “Active Regions”; uses numeric `Zurich` and absent `Magtype` | Select a current valid reporting epoch, deduplicate region IDs; use `Spotclass` and `Magclass` |
| Minute Kp | Snapshot covers approximately six hours | Label says “24h max Kp” | Use a genuine 24-hour series or label actual coverage |
| Missing Kp within partial response | No readings | `getCurrentKp` returns 0 | Return unknown, not quiet conditions |

There were **two distinct numbered regions** in the latest day's captured reports, not 270. This is a deduplication comparison within that feed, not a claim that every solar region has been independently counted. NOAA timestamps also need explicit UTC interpretation where they omit a suffix.

Evidence sources: [flare probabilities](https://services.swpc.noaa.gov/json/solar_probabilities.json), [F10.7](https://services.swpc.noaa.gov/json/f107_cm_flux.json), [sunspot reports](https://services.swpc.noaa.gov/json/sunspot_report.json), [minute Kp](https://services.swpc.noaa.gov/json/planetary_k_index_1m.json). These URLs are live and will change; captured excerpts are retained in the evidence file.

### 3. Stale DONKI can become “no aurora” — high priority, confirmed

`web/src/lib/nasa/donki.ts` accepts the bundled snapshot without an age gate. Empty or nonmatching storm records produce `chance: 'none'`. A “Live” label on the combined space-weather card can be supplied by other successful SWPC feeds.

This is not only the old local checkout: remote `main` metadata at 11:45 on 31 October records **DONKI GST 503 / FLR 503**, while remote `donki.json` still has **29 September** as its fetch date and empty arrays. [The daily update run succeeded](https://github.com/danilop/nightseek/actions/runs/41198118754), despite that partial failure.

With these empty arrays, the legacy card is suppressed altogether; the false `none` is present in the generated forecast data. The current browser therefore loses that source's context without a clear stale-data notice, rather than visibly showing the old solar flux.

**Action:** preserve per-source observation/fetch timestamps and error states through the UI. An expired snapshot means unavailable, not no aurora. Use the already-integrated NOAA forecast for forecast context; DONKI is an event catalogue, not a local aurora visibility forecast. Make partial pipeline failures visible in data health without discarding other fresh sources.

### 4. Gaia field-star parallaxes are presented as target distance — high priority, source-confirmed

`web/src/lib/gaia/api.ts` takes the median positive parallax above 0.1 mas from stars anywhere in the cone. `ObjectDetailPanel.tsx` presents the reciprocal as “Estimated distance” on the selected object.

Those foreground stars need not belong to a cluster, nebula or galaxy. The cut is not a parallax signal-to-noise check. For example, a cone around M31 cannot infer its galaxy distance this way; [NASA places M31 about 2.5 million light-years away](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/).

**Action:** remove the target-distance interpretation. Keep Gaia for the star field and clearly scoped individual-star information; use curated object distances with methods/uncertainties for targets. The live Gaia query timed out during this audit, so no fabricated numerical M31 result is claimed. Cache keys also omit cone radius, and named moving targets omit position; include the full query identity.

### 5. Twilight satellite passes are omitted — medium priority, reproduced

`web/src/lib/satellites/passes.ts` searches only the astronomical dark window. Using the same fresh ISS TLE and propagator, extending the search to sunset–sunrise finds an additional candidate on **1 November, 05:30:38–05:33:07**, maximum altitude approximately **14.7°**, estimated magnitude −1. At its maximum the Sun is **12.7° below the horizon**. It is absent from the current dark-window results.

**Action:** search the twilight interval too, then apply satellite illumination, local horizon and observer Sun-altitude conditions. This is a demonstrated search-window omission, not an independently timed observed ISS pass. Display TLE epoch and prediction uncertainty; preserve brightness as an estimate.

### 6. Jupiter moon events can be below London's horizon — medium priority, reproduced

`analyzer.ts` includes Jupiter's moon events if Jupiter is visible at some time that night. `galilean-moons.ts` generates events over the whole window; `JupiterMoonsCard.tsx` does not check altitude at each event.

For example, Europa's transit starts **2 November at 19:44**, when Jupiter is **−23.3°** high in London. Io's 4 November 18:43 transit is at **−24.0°**. Neither is observable there.

**Action:** show local altitude and observability per event, apply the user's horizon, and distinguish global events from locally useful ones. Label the moon diagram's calculation time. Event timings themselves were not independently certified against an external Galilean-moon ephemeris.

### 7. Meteor peak direction is reversed — medium priority, browser-confirmed

`meteor-showers.ts` defines positive `daysFromPeak` as after the peak. `MeteorShowerCard.tsx:202` renders the opposite sign. On 31 October the UI says **Orionids “10d to peak”**, Southern Taurids “4d past peak”, and Northern Taurids “11d past peak”. These directions are reversed relative to the underlying dates. The [IMO calendar](https://www.imo.net/calendar/) supports the October Orionid and November Taurid ordering.

**Action:** fix the sign labels and review the peak progress bar consistently. Keep annual, sourced shower data and outburst notes; the existing geometric rate disclaimer is valuable.

### 8. “Midnight” and Moon-phase names are imprecise — lower priority, confirmed

- `analyzer.ts` computes local sidereal time at the dark-window midpoint (~23:44), but the UI says “at Midnight”: **2h 25m** versus **2h 41m** at 00:00. Other midpoint-based labels, including meteor radiant altitude, need the same review.
- `utils/format.ts` rounds phase into eight bins, calling the 31 October Moon “Last Quarter” at almost 60% illumination. USNO calls it waning gibbous; exact last quarter is **1 November at 20:28**. The physical illumination is correct; the label is coarse.

**Action:** either calculate civil midnight or label the actual reference time. Use waxing/waning phase names between exact phase events, or explicitly say “near last quarter”. Show dates for rise/set events that occur outside the selected night.

### 9. Confidence measures presence, not coverage or reliability — medium priority, confirmed

`analyzer.ts:544` sets “high” whenever some weather and a non-null mean AOD exist. For 4 November only **5 of 11** weather hours have AOD, yet confidence is high. The following two nights have no AOD; 6 November still scores five stars using neutral transparency assumptions. That rating is not necessarily wrong, but the missing evidence is material.

The AQ request is capped at five days. [Open-Meteo now allows seven](https://open-meteo.com/en/docs/air-quality-api), but an actual seven-day request returned only 121 non-null AOD hours out of 168 in this snapshot. Request length is not data coverage.

**Action:** expose coverage per variable and window, source age, lead time, and model agreement separately. Label partially informed ratings and explain what is missing. Do not interpret the seeing estimator's internal `confidence: 1` as measured predictive accuracy.

### 10. Two secondary correctness defects — confirmed source checks

- `scripts/fetch-astro-data.mjs:323` requests Horizons `COMMAND='4'` for Vesta and `'2'` for Pallas. An actual request confirms `4` selects **Mars Barycenter**; asteroid identifiers require disambiguation such as `4;` and `2;`. `ephemeris.json` currently has no runtime consumer, so this is a latent bundled-data error, **not** the source of the displayed Vesta/Pallas positions that passed the checks above. Verify returned target identity before saving.
- `satellites/iss-position.ts` calls almost every coordinate between 180° W and 30° W, within ±60° latitude, “Atlantic Ocean”. The branch would label New York (40°, −74°) North Atlantic. Use a land/ocean polygon lookup or display coordinates; avoid invented geographic certainty and repeated reverse-geocoding for a moving satellite.

## Coverage of other produced data

| Data family | Review result and remaining limit |
|---|---|
| Planets, Moon, dwarf planets and selected asteroids | Seven position spot checks passed; Moon illumination passed; not every planet/date was independently sampled |
| Twilight, rise/set, time zone | London Sun/Moon checks passed; midpoint labels need repair; this GMT run does not certify all DST/polar cases |
| Deep-sky catalogue, target ranking, altitude tracks, imaging windows | OpenNGC fetched successfully and source flow reviewed. Ranking is a heuristic, not a calibrated visibility probability. Individual catalogue magnitudes, all 9,000+ entries, and every track were not independently remeasured |
| Comets and asteroid brightness | Bundled MPC elements and magnitude assumptions reviewed. Remote snapshot updated 31 October; local September snapshot differs. Comet brightness is intrinsically uncertain; no independent comet ephemeris/photometry certification here |
| NEO close approaches | Both required live feed chunks returned 200. Civil-day grouping and absolute magnitude are not evidence of nighttime visibility or apparent brightness. Recommend local observability only when an actual ephemeris supports it |
| Eclipses, conjunctions, oppositions, elongations, lunar apsides/nodes/libration, seasons, transits, Venus brightness | Local calculation code/tests reviewed as a family. No eclipse occurred in this seven-night sample; rare-event timings and all derived quantities were not independently certified |
| Meteors | Three active showers produced; reversed peak label confirmed; published ZHR is not a London hourly count |
| Variable stars | Small bundled VSX-derived list and simple prediction logic reviewed; not a live AAVSO observing feed. Epoch/period validity needs provenance; irregular variability cannot be predicted as a periodic light curve |
| Satellites and live ISS | Fresh CelesTrak data fetched; twilight omission reproduced. No independent observed-pass validation. Live position units match WTIA documentation; geographic naming is faulty |
| Seeing, transparency, dew, ratings | Derived heuristics, not instrument measurements. Cloud aggregation passed; rain and missing-data defects remain |
| Historical cloud summary | Daily archive request succeeded; daily averages are not nighttime clear-hour frequency or a multidecade climatology |
| Sky brightness/Bortle | London displayed 17.28 mag/arcsec² and derived Bortle 9.0 from Lorenz 2025. Appropriate model-baseline label; no local SQM measurement was made |
| Sky images, Gaia enhancements, camera framing | Survey imagery is archival, not current cloud/sky imagery. Gaia query failed in this run. Optical FOV is geometry, not a guarantee of usable framing through local obstructions |

## Current API and data-source assessment

| Source | Present use | Assessment / constraint |
|---|---|---|
| Open-Meteo Forecast | Hourly clouds/layers, weather, dew, rain, visibility, wind, pressure, CAPE | Keep. No key for noncommercial open access; currently 600/min, 5,000/hour, 10,000/day and 300,000/month. Additional variables/multi-model requests can affect call accounting. [Pricing](https://open-meteo.com/en/pricing) |
| Open-Meteo CAMS AQ | AOD, particles, dust → transparency | Keep as supporting evidence; variable/domain horizons differ. Show actual non-null coverage. [Documentation](https://open-meteo.com/en/docs/air-quality-api) |
| Open-Meteo Archive | Daily history | Keep daily labels; use historical **forecasts** and observations for forecast validation, not reanalysis alone. [Archive](https://open-meteo.com/en/docs/historical-weather-api) |
| NOAA SWPC | Kp outlook, current Kp, flux, sunspots, flare probabilities | Keep; public feeds need contract/freshness validation. Repair adapters before adding fields |
| NASA DONKI / NeoWs | Bundled space-weather events and NEO approaches; NeoWs live fallback | Keep event roles distinct. DEMO_KEY is unsuitable as a dependable shared production fallback. Free registered key belongs in the scheduled fetch process, not a distributed secret in the browser. [NASA APIs](https://api.nasa.gov/) |
| MPC / JPL | Comet elements, minor-body properties and bundled ephemerides | Keep; pin source epoch/identity. Horizons requires serialized calls. Fix the ambiguous asteroid IDs before consuming that bundle. [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) |
| CelesTrak | Visual-satellite TLEs | Keep provider, migrate to OMM/JSON. Six-digit catalogue IDs are no longer supported by legacy TLEs. Download only needed groups, no more than once per two-hour GP update. [Format and usage policy](https://celestrak.org/usage-policy.php) |
| Where the ISS at? | Live ISS position | Public, no authentication; roughly one request/second limit. Could use existing propagation for a coherent approximate live track, retaining epoch labels. [API docs](https://wheretheiss.at/w/developer) |
| OpenNGC / CDS VizieR / Gaia / Aladin | DSO catalogue, star fields, enrichment, survey previews | Keep with attribution, bounded/cached queries and failure states. OpenNGC uses CC BY-SA; survey images retain their own credits. Gaia is not a target-distance oracle |
| IAU/IMO / AAVSO VSX | Bundled meteor/variable-star material | These are maintained datasets in the app, not automatically fresh live APIs. Record edition, epoch, reference and update policy |
| Lorenz 2025 atlas | Regional sky-brightness tiles | Keep; distinguish model, year and conversion from measured Bortle. [Atlas](https://djlorenz.github.io/astronomy/lp/) |
| Nominatim | User place search/reverse lookup; ISS reverse lookup | Moderate user-triggered use only, aggregate app maximum 1 request/second, identification/attribution, caching; no autocomplete or systematic grid searches. Periodic moving-object geocoding is a poor fit. [Mandatory usage policy](https://operations.osmfoundation.org/policies/nominatim/) |
| ipapi.co / ipwho.is | Approximate IP-location fallback | Never treat IP location as the observing site without confirmation. Current ipwho.is docs say 1,000/day, shared by domain for CORS; no SLA. ipapi free capacity was not established from the docs inspected. [ipwho.is docs](https://ipwhois.io/documentation), [ipapi docs](https://ipapi.co/api/) |

The generic Open-Meteo credit in `credits.ts` says CC BY 4.0. Its current [UK Met Office documentation](https://open-meteo.com/en/docs/ukmo-api) specifies **CC BY-SA 4.0** for that dataset. Preserve provider-specific attribution and redistribution requirements when exposing or storing UKMO-derived results; “free API” does not imply one uniform data licence.

## Is there a better free weather API?

There is no defensible winner from one night. The same-time London comparison illustrates the more useful feature: **forecast disagreement**.

| UTC hour | Open-Meteo default cloud % | Explicit UKMO seamless % | MET Norway % |
|---|---:|---:|---:|
| 31 Oct 21:00 | 29 | 29 | 76.6 |
| 31 Oct 23:00 | 0 | 0 | 57.0 |
| 1 Nov 00:00 | 1 | 1 | 97.7 |
| 1 Nov 01:00 | 27 | 27 | 100 |
| 1 Nov 02:00 | 27 | 27 | 100 |

The default is identical to explicit UKMO in these hours; that does not establish the chosen underlying model for every variable/time. MET Norway returned a materially different forecast. These are predictions from independently updated products, not ground-truth comparisons.

| Option | Benefit to the observer | Cost/access and tradeoff | Recommendation |
|---|---|---|---|
| [Open-Meteo ensembles](https://open-meteo.com/en/docs/ensemble-api) | Show how many members support a usable two-hour window; distinguish stable from uncertain nights | Existing API family, multiple ensemble models; increased payload/call cost; ensemble frequency is not automatically a calibrated probability | Highest-value addition after correctness fixes |
| [MET Norway Locationforecast](https://docs.api.met.no/doc/locationforecast/datamodel.html) | Independent cloud forecast, fog and layer information where available; useful fallback | Public endpoint; identify client, follow cache/expiry and [terms](https://docs.api.met.no/doc/TermsOfService). Model coverage and variables vary; no accuracy guarantee | Evaluate as comparison/fallback, not automatic replacement |
| [Met Office DataHub](https://datahub.metoffice.gov.uk/pricing/site-specific) | UK-specific probabilistic forecasts for a saved observing site | Current free global spot tier 360 calls/day; blended probabilistic tier 55/day, one site, hourly, all parameters. Registration and protected shared caching needed | Useful London pilot; not unlimited global multi-user service |
| [7Timer ASTRO](https://www.7timer.info/doc.php?lang=en) | Specialist seeing/transparency categories for comparison | No API key documented; old documentation, GFS-derived product; live reliability and calibration not tested here | Experimental comparison only |

To establish a genuinely better provider, archive forecasts with issuance time and lead time, then compare against later observations across clear, broken-cloud, fog and rainy London nights. Evaluate missed usable windows, false “go” recommendations and cloud error at 0–12, 12–24 and 24–72 hours. Compare the same locations/times and distinguish low/high cloud. A provider should earn “better” through those results.

## Additional data and functionality worth adding

1. **“Can I set up safely, and for how long?”** Use already-fetched precipitation, gusts, dew margin and visibility consistently. Add UKMO near-surface fog/cloud, wind direction and pressure-level winds around 200/250 hPa where supported. This improves fog warnings, wind exposure and a jet-stream context panel. Upper-air wind alone is still not measured seeing. [Available variables](https://open-meteo.com/en/docs/ukmo-api)
2. **“Should I drive out tonight?”** Show model agreement, usable-window range and source age beside the stars. Compare a few user-saved observing sites with their existing sky-brightness model; do not scrape geocoding grids. Rank target-specific opportunities, not just clear skies in light-polluted central London.
3. **“Is an aurora worth checking now?”** Add [NOAA OVATION](https://www.spaceweather.gov/products/aurora-30-minute-forecast), a roughly 30–90-minute outlook, plus fresh solar-wind context. Combine it with darkness, cloud and a clear northern horizon. Do not label grid intensity as a London sighting probability. Keep three-day Kp outlook distinct from immediate alerts.
4. **“What is this target, and will it fit?”** Use the [NED object API](https://ned.ipac.caltech.edu/Docs::API/) for galaxies: identifiers, redshift-independent distances, morphology, diameter/bandpass and references. This directly replaces the misleading Gaia distance. Cache on demand; distinguish distance methods and uncertainty. Browser/CORS integration was not tested.
5. **“Which asteroid will be in my frame?”** Add an on-demand [IMCCE SkyBoT](https://ssp.imcce.fr/webservices/skybot/) cone search at the planned exposure time. It fits the existing field-of-view planner and can identify moving objects. Do not imply it predicts every satellite trail; satellite frame crossings need separate orbital geometry.
6. **“Which event is actually visible from here?”** Add per-event altitude/horizon, twilight-aware satellite lists, an exact reference time for diagrams, and sourced annual [IMO updates](https://www.imo.net/calendar/). More APIs are unnecessary for most of this benefit.
7. **Simpler place selection.** [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) can supply city/postcode matches and time zones. It is not a reverse-geocoder replacement. Retain coordinates and explicit site confirmation, especially after IP detection.

Do **not** plan a free future-cloud overlay around RainViewer: its [transition FAQ](https://www.rainviewer.com/api/transition-faq.html) says satellite IR and forecast/nowcast frames were removed from the public offering; the retained past-radar product is not an astronomy cloud forecast. Rain radar history might be optional context, but it does not address the core need.

## Suggested implementation order and acceptance criteria

1. **Trustworthy existing outputs:** NOAA fixtures from real captured schemas; stale-source states; precipitation eligibility; Gaia distance semantics; meteor sign, time labels, Jupiter altitude and twilight passes. Accept when missing/stale data never silently becomes zero/good/none, and each numerical finding above has a regression check.
2. **Provenance users can understand:** source, observation/model time, fetch time, validity interval, coverage, and estimated/measured status. Keep a failing optional source from blocking astronomy. Test real partial failure and offline cache cases.
3. **Weather decision support:** ensemble/model comparison, fog and equipment conditions. Measure forecast skill before changing providers or claiming accuracy.
4. **Focused enrichment:** OVATION, NED and SkyBoT, each lazy-loaded and cached. Migrate CelesTrak to OMM/JSON in parallel with satellite work.

Maintain a small London reference suite: fixed-date USNO/JPL comparisons with matched frames, actual API-schema fixtures, missing/null/stale variants, rainy-window consistency, signed meteor dates, below-horizon Jupiter events and twilight ISS cases. Separately sample DST transitions, southern latitudes and polar twilight before claiming global correctness. Avoid CI tests that depend on live network availability; run a scheduled source-health check with recorded schema/freshness failures instead.
