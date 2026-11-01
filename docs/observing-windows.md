# Observing windows

The night timeline shows every usable weather period in blue, the recommended
remaining interval in green, and elapsed periods in grey. Time buttons inspect
that period. Reasons and the timeline key stay in the collapsed night explanation.

`weather/hourly-slices.ts` defines the forecast time interpretation shared by the
night timeline, window selection, night ratings and target imaging calculations.
A known hourly sample covers the interval to the next adjacent sample. Missing
hours break coverage; the final sample does not establish conditions beyond it.
Times are estimates from hourly forecasts, not minute-accurate promises.

`weather/observing-windows.ts` collects continuous periods inside the observing
night, excluding the shared cloud/rain/wind/fog/visibility blockers. It compares
intervals of at least 30 minutes on a half-hour grid, including clipped boundaries,
without a three-hour cap or an artificial buffer before dawn. Equal-quality
intervals favour longer integration time, then earlier start.

Selection uses `calculateWindowNightQuality`, the same weather, Moon exposure,
seeing proxy, transparency and dew calculation used for the headline rating.
Weather averages and dew exposure are weighted by elapsed time. Short sessions
receive only a modest duration penalty. The uncertainty cap still applies to the
displayed rating, but does not flatten the underlying conditions used to compare
candidates. This distinction avoids treating two differently affected periods as
equally good merely because both forecasts are incomplete.

The app provider updates the remaining recommendation each minute and recomputes
the best-night badges with the same shared night ranking. Full-night periods remain
visible for context. Target windows add altitude, airmass, Moon separation and local
horizon constraints. Their retained quality samples are integrated again after
horizon/time clipping, before ranking the surviving fragments. Target details show
alternative periods on the altitude chart and list their times on demand.

Regression tests cover split nights, a single clear hour, all-night clarity,
short/pre-dawn periods, moonrise, missing hours, rain, elapsed intervals, clipped
target scores, and the shared visual time inspector. Browser tests use a deterministic
three-period weather fixture rather than depending on the live forecast.
