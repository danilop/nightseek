# Shared visual presentation

The app shows a compact visual summary first, with explanations under `ExplainSection`.
Warnings about missing data, short imaging windows, Moon interference and camera framing
remain visible. Eclipse viewing guidance also stays visible. Target magnitude labels and the
Targets magnitude-limit slider are primary information/controls and must stay visible by default.
`Magnitude` shares compact formatting across cards, recommendations, search, watchlists, detail,
variable stars, satellite passes and moving-object results. Unknown values show `mag unknown`; estimates
are marked `est.`. Negative and zero magnitudes are valid. Absolute magnitude (H) remains distinct.
Detailed positions, angular size, 45°/60° altitude intervals and lunar libration remain available
inside target details; reducing default text must not remove these facts.

## Sources of truth

- `TargetSummary` renders targets in Overview, category leaders, category cards and Search.
  It uses the existing target score, `getTargetRating` and `getTargetPhotoWindow`.
- `ImagingWindowSummary` formats that same window in cards and target detail. Visibility
  without weather is explicitly labelled. The altitude chart shades the same interval.
- `TargetFrameDiagram` uses `getFramePresentation`, which delegates to the scoring
  geometry and mosaic helpers. Its ellipse is an angular-size schematic with long axes
  aligned, not a photograph or camera-orientation prediction. Unknown minor axes are marked.
- `NightConditionsTimeline` uses existing twilight boundaries, Moon altitude samples,
  weather best time and observing blockers. Missing samples are grey, never clear/down.
  `timelinePosition` uses elapsed UTC time, including across daylight-saving transitions.
- `lib/utils/format.ts`, `lib/utils/units.ts` and telescope `formatFOV` own display formats.
  Temperature differences use `formatTemperatureDifference`, without the Fahrenheit offset.
- `lib/utils/rating.ts` owns quality colours. Stars inherit that colour; CSS must not override it.

Use sentence case for UI labels and preserve astronomical/catalogue names. Keep night
opportunity and target suitability labelled separately: they measure different things.
Search explicitly describes tonight; the forecast tabs describe the selected night.

## Validation

Run web type checking, Biome, Knip, Vitest coverage, web and mobile-wrapper builds, and
Playwright desktop/mobile flows. Regression coverage includes DST, absent weather and
angular dimensions, framing, disclosure keyboard controls, and equal card/detail window
text and star colours. Check narrow and desktop layouts in the browser as well.

`SiderealTimeCard` separates label, midpoint context and value in both Overview and Sky.
See [photometry policy and source comparisons](photometry.md) for shared filtering,
source priority, comet estimates and data-quality limitations.

`FrameFill` shows approximate catalogue dimensions and fit beside magnitude, using
`getFramePresentation` like the diagram. Long labels wrap on narrow screens; compact
diagrams do not repeat the same text. Area is secondary information inside target
rating details, explicitly described as an ellipse/frame ratio rather than visible
coverage. Unknown sizes show `FoV unknown`; unknown widths are explicit. Planets,
Moon and point-like moving objects do not receive this DSO tag. Sourced region
corrections are documented in [catalogue dimensions](catalogue-dimensions.md).

`NightRating` renders the same accessible opportunity stars in Overview and the night
selector. `NightOpportunitySummary` shows conditions, usable time, longest block and
confidence as compact visual tiles. `NightConditionsTimeline` shows all periods,
the recommended session and its strongest conditions. Details remain expandable.
See [the shared calculation](observing-windows.md) for the score's meaning.
