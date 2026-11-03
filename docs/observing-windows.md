# Observing opportunity and windows

The same `calculateHeadlineNightQuality` assessment supplies Overview, the night
selector, best-night badges and native alerts. Stars describe **remaining observing
opportunity**, while the visual summary separates recommended-session conditions,
total usable time, longest continuous block and forecast confidence. No weather means
unknown opportunity, not zero known clear hours. No supported remaining period means
no window; a whole-night average cannot resurrect an expired session.

## Time and evidence

`weather/hourly-slices.ts` defines the time interpretation shared by timelines,
window selection, night ratings and target calculations. A sample describes the
interval up to the next adjacent sample. Missing hours break coverage; the final
sample cannot establish conditions beyond itself. The parser retains bracketing
samples at dusk and dawn, then clips them. Averages, rainfall, dew duration and
coverage use elapsed time, including DST transitions. Isolated observations can
supply conditions but cannot establish a usable duration.

`collectWeatherWindows` retains continuous periods inside the observing night and
excludes shared cloud/rain/wind/fog/visibility blockers. Missing optional inputs
are unknown, never proof of good conditions. Coverage is checked over the interval
being assessed. Unknown dew stays unknown. Complete inputs are not a guarantee of
accuracy: confidence also distinguishes near-term from longer-lead forecasts.

## Conditions and session selection

`calculateWindowNightQuality` combines 0–100 factors with weights: clouds 35%,
transparency 20%, seeing proxy 15%, moonlight exposure 15%, dew 10%, wind 5%.
Cloud and moonlight limits are continuous: `max(0,100−1.2×cloudPercent)` and
`100−0.4×moonlightExposure`. Blocked duration reduces the interval score; incomplete
evidence caps it at 69. Existing twilight restrictions still apply. Factor
explanations use their weighted deductions, rather than unweighted deficits.
These are dark-sky imaging heuristics, not measured seeing or calibrated success
probabilities. Narrowband and planetary imaging can tolerate more moonlight.

Candidate sessions are at least 30 minutes, sampled on a half-hour grid including
clipped boundaries. The shared night/target session comparator maximises
`duration × (max(0, conditionsScore−20)/80)²`, then conditions, duration and earlier
start break ties. The 20-point floor prevents long poor conditions dominating a
short useful opportunity. This is planning utility, not an exposure/SNR model.
There is no arbitrary three-hour limit or dawn buffer.

All usable periods remain visible in blue; the recommended remaining session is
green. A white outline identifies the highest-rated conditions within that session,
with longer equal-score intervals preferred. Expired periods are grey. Time buttons
inspect any period. The provider advances the plan each minute, even after the
previous recommendation has expired.

## Night opportunity

Within each remaining usable block, half-hour samples contribute
`hours × (conditionsScore/100)²`. The block with most quality-weighted time earns
full credit; other blocks earn half credit to represent repeated setup/reacquisition.
The headline score is `round(min(bestConditions, 100×sqrt(effectiveQualityHours/4)))`.
Four continuous hours at constant conditions reach that conditions score. Additional
usable time cannot reduce opportunity, and fragmented nights receive less credit
than uninterrupted nights with the same conditions and duration. The score uses
absolute integration time rather than penalising short summer nights again through
a fraction-of-night rule. These product parameters are explicit and testable, not
claimed to have scientific calibration.

Controlled clear, dry, moon-free cases (conditions score 94):

| Remaining clear time | Opportunity score | Stars |
| --- | ---: | ---: |
| 30 minutes | 33 | 2 |
| 1 hour | 47 | 3 |
| 2 hours | 66 | 4 |
| 8 hours | 94 | 5 |

Target windows additionally account for altitude, airmass, Moon separation and the
user's horizon. Their retained samples are integrated again after time/horizon
clipping before the same session comparator ranks surviving fragments. Target
suitability remains distinct from night opportunity.

Regression coverage includes fragmentation, monotonicity when usable time is
added, short/pre-dawn periods, expired intervals, moonrise, cloud continuity,
missing dew/aerosols, selected-interval evidence, weighted explanations, boundary
hours and DST. Browser tests exercise shared ratings, framing, timeline inspection,
progressive disclosure and magnitude filters across desktop/mobile engines.
