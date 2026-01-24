# Analyzer Refactoring Notes

## Original analyzer.py Structure (976 lines)

### Dataclasses (lines 30-73):
1. `Conjunction` - Close approach between celestial objects
   - Properties: object1_name, object2_name, separation_degrees, time, description
   - Method: is_notable (< 5 degrees)

2. `NightForecast` - Forecast for a single night
   - Properties: night_info, planets, dsos, comets, dwarf_planets, asteroids,
     milky_way, moon, weather, conjunctions, meteor_showers

3. `VisibilityScore` - Legacy compatibility score
   - Properties: object_name, score, reason

### VisibilityAnalyzer Class Methods:

#### Initialization (__init__, lines 79-119):
- Sets up SkyCalculator and Catalog
- Initializes planets dict with 7 planets
- Loads filtered comets, dwarf planets, asteroids

#### Comet Pre-filtering (_load_filtered_comets, lines 121-214):
- Loads comets from catalog with generous magnitude filter
- Two-pass filtering:
  1. Filter by declination (cheap check)
  2. Filter by apparent magnitude (expensive calculation)
- Uses comet magnitude formula: m = g + 5*log10(Δ) + k*log10(r)

#### Main Analysis:

**analyze_forecast (lines 216-246):**
- Multi-night loop with progress callback
- Calls _analyze_single_night for each night

**_analyze_single_night (lines 248-538):**
- Gets night info from calculator
- Analyzes each object type:
  - Planets (264-304): visibility + apparent diameter
  - DSOs (306-329): visibility + surface brightness
  - Comets (331-367): visibility + apparent magnitude
  - Dwarf planets (369-429): visibility + apparent diameter
  - Asteroids (431-489): visibility + apparent diameter
  - Milky Way (491-499): simple visibility
  - Moon (501-507): simple visibility
- Gets weather data
- Detects conjunctions and meteor showers
- Returns NightForecast

#### Scoring:

**rank_objects_for_night (lines 540-691):**
- Scores all visible objects using score_object()
- Calls select_best_objects() for merit-based selection

**rank_objects_legacy (lines 693-710):**
- Wrapper for backwards compatibility

**_get_quality_description (lines 712-728):**
- Simple altitude -> quality string mapping

#### Event Detection:

**_detect_meteor_showers (lines 730-827):**
- Checks METEOR_SHOWERS_2026 for active showers
- Handles year-crossing showers
- Calculates radiant altitude and moon separation

**_detect_conjunctions (lines 829-943):**
- Detects planet-planet conjunctions
- Detects planet-Moon conjunctions
- Returns sorted by separation

#### Best Nights:

**get_best_dark_nights (lines 945-975):**
- Scores nights by moon + cloud cover
- Returns sorted indices

---

## Refactoring Plan

### Phase 1: Extract Event Detection (self-contained)
Create `event_detection.py`:
- Move `Conjunction` dataclass
- Move `_detect_conjunctions` method -> `detect_conjunctions()` function
- Move `_detect_meteor_showers` method -> `detect_meteor_showers()` function

### Phase 2: Extract Comet Filtering (self-contained)
Move `_load_filtered_comets` logic to catalog.py or new `comet_filter.py`

### Phase 3: Simplify _analyze_single_night
Extract helper functions for each object type analysis

---

## Progress

### Phase 1: COMPLETE - Event Detection Extracted
- Created `event_detection.py` (256 lines)
- Moved `Conjunction` dataclass
- Moved `detect_conjunctions()` function
- Moved `detect_meteor_showers()` function
- analyzer.py reduced from 976 to 745 lines (-231 lines, -24%)
- All 20 tests pass

## Validation Checklist

After refactoring, verify:
- [x] All 20 tests pass
- [x] `nightseek` command works with location
- [x] Conjunctions are detected (Saturn near Neptune shown)
- [x] Meteor showers are detected (not active in test date)
- [x] All object types appear in output (DSOs, planets, etc.)
- [x] Scoring still works correctly

## Summary

**Before refactoring:** analyzer.py had 976 lines
**After refactoring:** analyzer.py has 745 lines, event_detection.py has 256 lines

The event detection logic (conjunctions and meteor showers) was successfully
extracted to its own module without losing any functionality. The comet
filtering logic was kept in analyzer.py as it's tightly coupled to the
analyzer's state (calculator, catalog, mag thresholds).

Further refactoring could extract:
- Object analysis helpers (planet, DSO, comet visibility calculation)
- Ranking/scoring logic to a separate module

But the current split achieves a good balance between modularity and simplicity.
