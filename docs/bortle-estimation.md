# Decimal Bortle estimation

Reviewed 6 September 2026. Method version 1.

## Decision

Keep the Lorenz 2025 modeled zenith brightness and add a **brightness-derived Bortle
estimate**, displayed to one decimal. Use the quantitative convention published by
[LightPollutionMap.app](https://lightpollutionmap.app/), with a continuous dark endpoint.
Its FAQ explicitly describes decimal Bortle as a quantitative interpretation of
modeled SQM, rather than a traditional visual classification.

This fulfils the requested decimal estimate without claiming a precision that field
data does not establish. It is a deterministic comparison index, not a statistical
prediction calibrated against measured Bortle observations. A decimal is display
resolution, not a confidence interval or 0.1-class accuracy. Its scientific
limitation remains visible in the tooltip. No further downloads, keys or API are needed.

## Evidence and alternatives

- **Original Bortle classes:** [John Bortle, 2001](https://skyandtelescope.org/astronomy-resources/light-pollution-and-astronomy-the-bortle-dark-sky-scale/)
  describes visual, whole-sky categories. There is no official continuous formula.
- **Empirical calibration:** [Lorenz's NPS analysis](https://djlorenz.github.io/astronomy/lp/bortle.html)
  compares 397 observing nights and demonstrates overlapping brightness distributions.
  It explicitly says the sample for classes 7 and 8 is too small for conclusions.
  This does not support training or claiming a validated urban decimal predictor.
- **Stellarium/NELM:** [Stellarium's source](https://github.com/Stellarium/stellarium/blob/master/src/core/StelCore.cpp)
  implements Schaefer's 1990 limiting-magnitude equation for a typical observer and
  typical extinction, then categorizes that NELM. A continuous extension through its
  class-centre NELM values gives approximately 8.9 at 18.1 mag/arcsec², but 3.2 at
  the atlas's darkest possible sky (22). It cannot represent the full Bortle range
  for this dataset without an additional arbitrary observer adjustment. Rejected.
- **Common lookup table:** [handprint](https://www.handprint.com/ASTRO/bortle.html)
  provides the commonly used brightness boundaries, but does not distinguish classes
  8 and 9 with a complete continuous mapping. Used as provenance context, not as an
  independently calibrated physical law.
- **Existing decimal map:** the published client at
  [lightpollution-client.BeJmfFeB.js](https://lightpollutionmap.app/_astro/lightpollution-client.BeJmfFeB.js)
  supplies a complete urban endpoint and linear interpolation in magnitude units.
  We inspected it, implemented the arithmetic independently, and documented its
  convention. That version abruptly returns 1 at 21.99 while approaching 2 from
  below; NightSeek repairs this discontinuity instead of reproducing it.

## Adopted reference points

| Zenith brightness (mag/arcsec²) | Bortle estimate |
| --- | --- |
| 22.00 | 1.0 |
| 21.99 | 2.0 |
| 21.89 | 3.0 |
| 21.69 | 4.0 |
| 20.49 | 5.0 |
| 19.50 | 6.0 |
| 18.94 | 7.0 |
| 18.38 | 8.0 |
| 17.80 | 9.0 |

The 17.80 urban endpoint is an adopted map convention, not an observed universal
Bortle-9 boundary. The 22.00 natural-sky anchor is NightSeek's explicit extension.
Dark-end bins are very narrow: small brightness changes can produce large changes
in the index. This is another reason never to imply that a decimal guarantees accuracy.

Between adjacent points `(s0,b0)` and `(s1,b1)`, calculate
`b = b0 + (s0 - sky) / (s0 - s1) * (b1 - b0)`.
Use the full decoded atlas value; round only for display. Clamp at 1 and 9 outside
the reference range. Missing, nonfinite or negative inputs produce no estimate.

At exactly 18.1, the calculation is `8 + (18.38-18.1)/(18.38-17.8) = 8.48276`,
displayed as **Bortle 8.5 est.** A sky value rounded to 18.1 in the header can have
a slightly different Bortle result because the conversion uses unrounded data.
The tooltip shows brightness to two decimals to help explain this.

## Product and computation boundaries

Show both the estimated Bortle value and the physical brightness with its units.
Keep the atlas source/year and the estimate convention separate in About and the
tooltip, respecting the atlas author's distinction between zenith brightness and
observed Bortle class. Do not apply this display conversion to scoring: the Milky
Way planner continues to use physical brightness; DSO ranking is unchanged.

Tests cover reference points, interpolation, bounds, missing data, continuity,
monotonicity, and London-like sky values. Browser checks use local regional fixtures
and both live CSP layers, and confirm one request, cached reload and mobile layout.
