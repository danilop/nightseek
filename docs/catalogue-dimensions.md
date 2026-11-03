# Catalogue dimensions and framing

`lib/catalogs/dimensions.ts` owns curated, region-specific corrections. Provenance
travels with the catalogue entry into target visibility and is linked in expanded
target details. Every tag, schematic and score consumes those same axes. Catalogue
and forecast caches are versioned so previously imported incorrect dimensions are
not reused after this release.

## Verified corrections (3 November 2026)

| Target region | Imported OpenNGC axes | Adopted approximate axes | Sources |
| --- | --- | --- | --- |
| NGC 6960, Western Veil filament | 210′ × 160′ | 70′ × 6′ | [SAC, printed p. 53](https://www.saguaroastro.org/wp-content/sac-docs/Book110BestNGC.pdf#page=60); [JRASC April 2000, printed p. 68](https://www.rasc.ca/sites/default/files/publications/JRASC-2000-04.pdf#page=30) |
| NGC 7000, North America Nebula | 120′ × 30′ | 120′ × 100′ | [SAC, printed p. 54](https://www.saguaroastro.org/wp-content/sac-docs/Book110BestNGC.pdf#page=61); [RASC Calgary, Cygnus](https://calgary.rasc.ca/constellations/cygnus.htm) |

The two references for each correction agree but are not asserted to be independent
measurements. These approximate footprints describe the named region, not all faint
associated emission. The RASC Western Veil entry explicitly describes adjacent
nebulosity extending farther. Kopernik Observatory independently supports its
[70′ length](https://www.kopernik.org/images/archive/n6960.htm), but does not establish
its width. Camera rotation, exposure depth and wavelength affect actual framing.

OpenNGC attributes these imported axes to source 9 (Lynds Bright Nebulae). We preserve
OpenNGC as the general catalogue; curated overrides resolve identified region/scope
conflicts rather than assuming every LBN association is wrong. NGC6992's 60′ × 8′
agrees with SAC and is unchanged; the combined Eastern Veil NGC6992/5 is a different
region (78′ × 8′ in JRASC). No blanket catalogue accuracy claim is made.

Correcting axes must not silently recompute surface brightness using an integrated
magnitude whose aperture/region may differ. Surface brightness is therefore unknown
for these corrected records. Catalogue magnitudes retain their original band/source;
this correction does not invent new photometry.

## Framing policy

With the app's DWARF Mini preset (128′ × 72′), the Western Veil spans 54.7% of the
long frame axis and 8.3% of the short one. Its schematic ellipse is only 3.58% of the
frame area. That small area is not evidence of an uninteresting or unresolved subject.
The default tag is `70′ × 6′ · Fits in frame`, accompanied by a schematic. Area is
available in expanded details, with its meaning and limitations.

`getFrameGeometry` shares span, width, area and composition estimates. Composition
credit is `min(1, lengthSpan) × min(1, widthSpan/0.05)³`; the five-percent width
threshold is a framing preference, not a sensor resolution measurement. The square
root supplies the size bonus and the existing base-score adjustment. Thus the
Western Veil earns 11/15 size points and retains about 78% of its pre-adjustment
score, rather than the old area-based retention of 33%. Tiny compact targets still
receive little credit. Oversized targets keep explicit crop/mosaic guidance.

Regression tests pin the source-backed values, distinguish components from complexes,
check invalid axes, verify ingestion and surface-brightness handling, and compare
framing labels, area, span and ranking. Browser checks include the Western Veil in
Search and large-target label wrapping on mobile.
