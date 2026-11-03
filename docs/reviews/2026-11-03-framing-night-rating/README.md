# NightSeek framing and night-rating audit — 3 November 2026

Audited application commit: `37dca47a08596312eaabef76c369ed467922c1e1`.
This is an analysis of existing behaviour, not a deployed correction. Results are in [results.json](results.json). Controlled cases executed the real scoring, window selection, catalogue framing and forecast parser functions through Vitest; they are diagnostic probes, not assertions that the existing behaviour is desirable. The whole-night fixture does not supply the same seeing aggregate as the selected-window calculation, so its raw score must not be compared as a pure duration experiment.

## Western Veil: dimensions and meaning

| Source | Explicit NGC 6960 dimensions | Scope |
|---|---:|---|
| [Saguaro Astronomy Club, 110 Best of the NGC, printed p. 53](https://www.saguaroastro.org/wp-content/sac-docs/Book110BestNGC.pdf#page=60) | 70′ × 6′ | Western Veil |
| [Journal of the Royal Astronomical Society of Canada, April 2000, printed p. 68](https://www.rasc.ca/sites/default/files/publications/JRASC-2000-04.pdf#page=30) | 70′ × 6′ | Western Veil; also describes adjacent nebulosity extending farther |
| [Kopernik Observatory](https://www.kopernik.org/images/archive/n6960.htm) | 70′ long | Western loop; does not independently establish its width |
| [OpenNGC upstream CSV](https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv) | 210′ × 160′ | Record labelled NGC6960, axes attributed to LBN |

The two publications agree, but should not be described as two independent measurements. Nebula boundaries depend on brightness threshold, wavelength and whether associated emission is included. The 70′ × 6′ entry is a useful approximate footprint of the named filament, not a precise outline of all photographable emission.

OpenNGC's `MajAx:9|MinAx:9` traces the axes to HEASARC's Lynds Bright Nebulae catalogue, according to its [source guide](https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/NGC_guide.txt). NightSeek imports these axes without a region-scope check. The much larger LBN-derived footprint is inconsistent with the two Western Veil entries above; it must not be presented unqualified as the filament's dimensions. Establishing precisely which broader emission boundary the upstream entry represents requires further source reconciliation.

The app's DWARF Mini preset is 128′ × 72′. This audit uses that configured value; it does not independently certify the manufacturer's optical specification.

- Imported 210′ × 160′: `π/4 × 210 × 160 / (128 × 72) × 100 = 286.34%`.
- Filament 70′ × 6′: the same elliptical approximation gives **3.58% area**.
- Its bounding rectangle occupies **4.56% area**.
- Aligned along the long frame axis, the filament spans **54.69% of frame length** and **8.33% of frame width**.

Thus the arithmetic is correct for its inputs, but both the input scope and the interpretation of a single percentage are problematic. Neither 286.3% nor 3.6% alone is an adequate framing description. An elongated subject can make a substantial composition while occupying little area. Actual rotation, curvature, surrounding emission and crop are not represented by the ellipse.

### Ranking consequence

Changing only the axes to 70′ × 6′ gives size points 3/15 and a framing adjustment retaining approximately **33.15% of the pre-adjustment base score** (integer rounding applies in the final scorer). The imported axes get 15/15 and no small-target penalty. Correcting data alone therefore creates a severe demotion of a long, potentially worthwhile filament. Review size preference together with the data fix; use span, fit and resolvable width rather than treating area as photographic usefulness.

Dimension changes also affect derived surface brightness. A magnitude and a footprint referring to different regions or bands must not silently be combined.

A broader spot-check found another material discrepancy: OpenNGC NGC7000 is 120′ × 30′ while SAC gives 120′ × 100′. That changes the estimated ellipse/frame ratio from 30.68% to 102.27%. This is a flag for region/boundary reconciliation, not authority to override the whole catalogue. NGC6992 alone is 60′ × 8′ in both OpenNGC and SAC, whereas RASC lists the combined NGC6992/5 as 78′ × 8′: component identity matters.

## Why brief nights get five stars

The headline normally scores the selected best interval, not total night opportunity. Its base score is:

`round(0.35 × clouds + 0.20 × transparency + 0.15 × seeing + 0.15 × moon + 0.10 × dew + 0.05 × wind)`

Each factor is on a 0–100 scale. Five stars start at **75**, four at 50, three at 35 and two at 20. The duration penalty is only `round(max(0, 2 − hours) × 4)`: 6 points for 30 minutes, 4 for one hour, zero at two hours. Other weather, twilight and evidence caps then apply.

Controlled ten-hour dark-night cases used calm, dry weather, no moonlight, good seeing, aerosol-derived transparency 90 and otherwise overcast hours:

| Available clear interval | Headline score | Stars |
|---|---:|---:|
| 30 minutes remaining | 88 | 5 |
| 1 hour | 90 | 5 |
| 2 hours | 94 | 5 |
| 8 hours | 94 | 5 |

The 30-minute case starts halfway through a one-hour clear interval; the window list retains the full interval while the recommendation starts at the current-time cutoff. It demonstrates remaining opportunity, not a half-hour meteorological resolution.

The selector tries subintervals on 30-minute boundaries and maximises conditions score, using length only to break exact ties. In a case with two pristine hours and eight hours at 10% cloud, it recommended 2.5 hours despite all ten being usable. There is no meaningful reward for useful time beyond two hours, total usable fraction or fragmentation. Multiple windows are retained, but they do not determine the headline opportunity rating. Best-night badges and notifications inherit this interpretation.

## Other reproduced weaknesses

| Case | Actual outcome | Implication |
|---|---|---|
| Cloud cover 50% → 50.01%, otherwise favourable | 77 / 5 stars → 49 / 3 stars | Abrupt cap creates a disproportionate change |
| Cloud cover 60% → 60.01% | 49 → 34 | Another discontinuity |
| Missing temperature and dew point | 94 / 5 stars; dew factor 100 | Unknown dew conditions treated as no risk |
| Missing aerosol data outside the selected interval | Complete interval capped at 69 | Evidence coverage uses whole-night scope |
| Full moon at 60° altitude, otherwise favourable | 79 / 5 stars | Generic rating can overstate broadband deep-sky suitability; target/filter context matters |
| No best window, otherwise clear-night aggregates | 91 / 5 stars | Whole-night fallback can imply opportunity even when no recommended interval remains |
| Ten-hour darkness interval 20:30–06:30 with bracketing hourly data | Only nine usable hours | Parser drops boundary samples needed to cover dusk/dawn fragments |

The penalty explanation sorts unweighted factor deficits beside actual duration deductions. For example, good seeing appears as 25 lost points although its weighted score cost is only 3.75; a six-point duration deduction appears smaller. This does not faithfully explain the resulting score.

Simply switching the headline to the existing whole-night calculation is unsafe: any blocked samples invoke a cap of `34 × unblocked fraction`, severely penalising a night with a long useful interval and some bad hours. The replacement needs an explicit opportunity definition.

Seeing is a surface-weather heuristic, not a direct turbulence measurement; several of its inputs overlap other score factors. The weights and thresholds are product heuristics, not a calibrated probability of successful imaging. Model disagreement and forecast confidence need distinct treatment.

## Fresh London comparison

Public Open-Meteo forecast, air-quality and UKMO fog inputs retrieved on 3 November were passed through the real parser and astronomical calculations for London (51.5074, −0.1278). The Tuesday 3 November night scored **70 / four stars**, recommending **01:00–03:00 GMT on Wednesday**, within four usable hours. This fresh forecast does not reproduce the user's earlier forecast verbatim; forecasts change. The controlled cases above establish that five-star short windows are possible under the current formula. Full seven-night outputs are retained in results.json; raw live responses remain temporary diagnostic files, not a permanent forecast fixture.

## Recommended correction contract

1. Keep catalogue identity, region scope, axes, units, source and uncertainty together. Curated corrections must cite the evidence and distinguish a component from its wider complex.
2. Share one framing assessment across tags, diagrams and ranking. Lead with approximate dimensions and span/fit; make area an explicitly labelled secondary quantity. Do not infer target usefulness from area alone.
3. Share one night assessment across cards, calendar, ranking and alerts, exposing window conditions, total remaining usable time, longest continuous block and evidence confidence separately.
4. Make headline stars describe practical observing opportunity. Agree explicit duration/continuity criteria and validate them against short summer nights, long winter nights, fragmented windows and different imaging goals. Do not claim a new heuristic is physically calibrated without evidence.
5. Preserve all usable windows and distinguish the strongest conditions interval from the recommended session. Include duration in session utility, rather than only breaking ties with it.
6. Fix boundary clipping, expired-window fallback, missing-data handling and weighted explanations. Evaluate weather evidence over the same interval being scored. Avoid discontinuous cloud caps where small forecast changes cause large rating jumps.
7. Add regression scenarios for the failures above before implementing a replacement, then run all app checks and deployment verification when shipping the corrections.

Owning implementation: `web/src/lib/catalogs/opengc.ts`, `web/src/lib/scoring/index.ts`, `web/src/lib/telescopes/presets.ts`, `web/src/lib/weather/night-quality.ts`, `web/src/lib/weather/observing-windows.ts`, `web/src/lib/weather/open-meteo.ts`, `web/src/lib/utils/rating.ts`.

## Validation performed

The one-off diagnostic probe passed and produced the retained results. Existing targeted suites also passed: **141 tests across five files** (night-quality, observing-windows, open-meteo, scoring/index and scoring/mosaic-conditions). This is a baseline check, not proof that the rating semantics are correct. No application code changed and no deployment was performed for this audit.
