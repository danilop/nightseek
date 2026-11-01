# Magnitudes: sources, meaning and validation

`Magnitude`, `formatMagnitude`, `matchesMagnitudeLimit` and `useMagnitudeFilter` are
shared across target presentation and selection. Unknown/non-finite values display
**mag unknown**. A null limit means **All magnitudes**; every numeric limit, including
the slider maximum, excludes unknowns. Clearing the filter restores them. Overview,
Targets, Watchlist and Search use that same persisted filter. Search applies it before
capping deep-sky results. The Milky Way planner has no integrated magnitude and is
excluded from the filtered Targets list.

## Extended objects

A catalogue value must describe the whole object, not a nearby star, a nebula's central
star or one component of a galaxy pair. No generic SIMBAD photometry fallback is used:
those identity/measurement mismatches were found during the source review.

For securely matched Galactic globular clusters, prefer **Harris 1996 (2010 edition),
integrated apparent V magnitude V_t**. It is a specialist catalogue with an explicitly
whole-cluster measurement. Match an exact NGC/IC identifier, require the globular-cluster
type and verify the J2000 position within 2 arcminutes. Component identifiers do not match.
Other objects retain OpenNGC V, or B when V is missing; these bands are identified in
source details and are not silently converted. No made-up fallback magnitude is allowed.

- Original Harris catalogue: https://physics.mcmaster.ca/~harris/mwgc.dat
- Definitions / reference: https://heasarc.gsfc.nasa.gov/W3Browse/all/globclust.html
- OpenNGC field definitions: https://github.com/mattiaverga/OpenNGC/blob/master/NGC_guide.txt

The Harris file permits free redistribution with attribution to the original website.
The bundled subset records source, citation, band and SHA-256; target details link to
that source. Regenerate with `python3 scripts/fetch-harris-magnitudes.py` (or `--input`
for a reviewed local copy). This is a historical measurement catalogue, not live photometry.

### Comparison on 2026-11-01

Compared all 107 bundled Harris NGC/IC clusters with OpenNGC, using exact identity and
coordinates. All passed the spatial check. Forty had neither V nor B in OpenNGC and now
receive a value (38 NGC + 2 IC). Sixty-three had V measurements: 44 differed by more than
0.2 mag and the largest difference was 2.77. Four had B only. The discrepancy does not
prove every OpenNGC value wrong, but mixing these measurements would provide an
inconsistent cluster brightness scale. The specialist integrated-V catalogue is used
consistently for all 107 matches. Measurements remain approximate, not exact truth.

| Object | OpenNGC V | Harris integrated V | Decision |
| --- | ---: | ---: | --- |
| M10 / NGC6254 | 4.98 | 6.60 | Prefer Harris whole-cluster V |
| Omega Centauri / NGC5139 | 5.33 | 3.68 | Prefer Harris whole-cluster V |
| NGC6235 | 7.20 | 9.97 | Prefer Harris whole-cluster V |
| NGC6541 | unknown | 6.30 | Supply verified integrated V |
| M71 / NGC6838 | unknown | 8.19 | Supply verified integrated V |

NASA's independent public M10 description gives 6.4, broadly consistent with Harris
and substantially different from the old 4.98; no claim of agreement to hundredths:
https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-10/

## Moving objects and comets

Moving-object brightness is computed for the relevant night and shown as **est. mag**.
Comet detail identifies the MPC model, observing-window midpoint and catalogue retrieval
date when available. Retrieval date is not a photometric observation date. The existing
Data sources & freshness view exposes refresh failures and source age.

MPC CometEls supplies total absolute magnitude H and brightness exponent n:

`m = H + 5 log10(observer distance in AU) + 2.5 n log10(Sun distance in AU)`

The previous implementation omitted the 2.5 conversion and could seriously overstate
brightness far from the Sun. JPL's k1 is already a magnitude coefficient: `k1 = 2.5 n`.
Do not interchange the parameter conventions. Missing H/n or invalid distances produce
unknown, never defaults of 10. The browser and Node 24 data updater import one MPC parser;
fixed-width fields cannot consume digits from adjacent columns. Unnamed provisional
objects retain their complete unique designation.

Source checks:
- MPC fields: https://minorplanetcenter.net/iau/info/CometOrbitFormat.html
- MPC convention / independent implementation:
  https://github.com/Stellarium/stellarium/blob/master/src/core/modules/Comet.cpp
  (`getVMagnitude`), with unchanged MPC import in `plugins/SolarSystemEditor/src/SolarSystemEditor.cpp`.
- JPL formula and uncertainty: https://ssd.jpl.nasa.gov/horizons/manual.html

### Independent JPL comparison

Retrieved Horizons on 2026-11-01 for **2026-11-02 00:00 UTC**, geocentric, airless,
light-time-corrected geometry, quantities `1,9,19,20`, commands `DES=2P;CAP`,
`DES=67P;CAP`, `DES=C/2023 A3;CAP`. Total magnitude T-mag, not nuclear N-mag.

The following controlled comparison uses the *same JPL distances* with MPC photometric
parameters from the bundled 2026-10-31 snapshot, isolating formula/source differences:

| Comet | Old calculation | Correct MPC model | JPL model | Difference after fix |
| --- | ---: | ---: | ---: | ---: |
| 2P/Encke | 15.293 | 16.830 | 16.721 | +0.109 |
| 67P/Churyumov-Gerasimenko | 18.383 | 22.234 | 21.229 | +1.005 |
| C/2023 A3 | 14.376 | 18.918 | 18.952 | −0.034 |

These are predictions, not observations. The 67P difference remains because MPC and JPL
use different H/slope parameters; it is not hidden or averaged away. With equivalent
parameters, our formula reproduces each JPL T-mag to 0.001 mag (output rounding).
Independent regression fixtures also check the app's MPC two-body Sun/Earth distances
against all three JPL solutions within 0.03 AU; this is a test tolerance, not a precision
guarantee. Fixtures are pinned so future catalogue refreshes cannot invalidate history.

Recent observations can be checked in **COBS**, maintained by Crni Vrh Observatory:
https://cobs.si/. It distinguishes observation date and method. It is not currently
an ingested NightSeek feed. A future observational fallback must retain timestamp,
method/band, total-vs-nuclear classification and observer provenance, with age and
outlier checks. A fresh orbital solution does not guarantee fresh brightness parameters;
comet outbursts and fragmentation can invalidate even an authoritative prediction.
