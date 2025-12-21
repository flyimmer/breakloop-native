# AI Integration Documentation

**BreakLoop - Google Gemini AI with Real-Time Search**

Last Updated: December 2024

---

## Overview

BreakLoop uses **Google Gemini 2.0 Flash (Experimental)** with **Google Search Grounding** to provide real-time, accurate activity suggestions. This document covers all AI integration improvements, prompt engineering strategies, and implementation details.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Google Search Integration](#google-search-integration)
3. [Prompt Engineering](#prompt-engineering)
4. [Anti-Hallucination Strategies](#anti-hallucination-strategies)
5. [Location Intelligence](#location-intelligence)
6. [Fail-Safe URL Generation](#fail-safe-url-generation)
7. [Configuration](#configuration)
8. [Testing](#testing)

---

## Architecture

### Files Involved

```
src/
├── utils/
│   └── gemini.js                    # API integration with Google Search
├── components/
│   └── PlanActivityModal.jsx        # Prompt construction & response processing
```

### API Configuration

**Model:** `gemini-2.0-flash-exp`
- Experimental model with best Google Search support
- Faster than Pro, supports grounding

**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`

**Key Settings:**
```javascript
{
  generationConfig: {
    temperature: 0.1  // Extremely low to prevent hallucination
  },
  tools: [
    {
      googleSearch: {}  // Enables real-time search
    }
  ]
}
```

---

## Google Search Integration

### Implementation (`src/utils/gemini.js`)

```javascript
const requestBody = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.1,  // Maximum factuality
  },
  tools: [
    {
      googleSearch: {}  // Simple signature enables search
    }
  ]
};
```

### What It Does

- AI automatically searches Google when it needs current information
- Finds real movie showtimes, restaurant hours, event schedules
- Verifies venues are currently open
- Checks weather, seasonal factors

### Evolution

1. **Initial Attempt:** `googleSearchRetrieval` with `dynamicRetrievalConfig` → ❌ Not supported
2. **Second Attempt:** Snake_case fields → ❌ Invalid syntax
3. **Final Solution:** Simple `googleSearch: {}` → ✅ Works perfectly

---

## Prompt Engineering

### Structure

The prompt is split into two parts:

1. **System Instruction** - Rules, strategies, output format
2. **User Prompt** - Specific request with user inputs

### Key Sections

#### 1. PRIMARY REQUIREMENT - Topic Match

```
The user wants: "Dinner with my friends"
YOU MUST search ONLY for events matching this topic.
- If topic is "Dinner" → Search ONLY for restaurants
- If topic is "Movie" → Search ONLY for cinemas
- ALL 3 suggestions MUST match the topic. NO exceptions.
```

**Why:** Prevents AI from mixing activity types (e.g., showing movies when user wants dinner)

#### 2. Location Intelligence

```
INPUT CONTEXT:
• User Location: "Gertrud-Grunow-Str. 12" (USER'S starting point, NOT venue address)

SEARCH STRATEGY:
1. ANALYZE LOCATION: If it's a street, search in the city, not at that address
2. FIND VENUE ADDRESS: Must find REAL venue address
3. NO MIRRORING: NEVER copy user's address into output
```

**Why:** Prevents AI from returning user's home address as the venue location

#### 3. Date-Aware Schedule Reading

```
CRITICAL INSTRUCTION FOR TABLES:
Search results show weekly schedules (Mon, Tue, Wed...).
You MUST look for the column matching "Sonntag" (2025-12-21).
DO NOT use times from adjacent columns.
```

**Why:** Cinema schedules are often in table format; AI must read the correct day column

#### 4. JSON-Only Output

```
CRITICAL OUTPUT REQUIREMENT:
- Return ONLY a valid JSON array
- NO conversational text like "Okay", "Here are"
- Start with [ and end with ]
- If no events found, return empty array: []
```

**Why:** Prevents JSON parsing errors from conversational text

---

## Anti-Hallucination Strategies

### 1. Temperature: 0.1

**Default:** 1.0 (creative, can hallucinate)
**Our Setting:** 0.1 (factual, deterministic)

**Effect:** AI sticks to facts from search results, doesn't invent times

### 2. Day Name Calculation

```javascript
const dateObj = new Date(date || new Date());
const dayName = dateObj.toLocaleDateString('de-DE', { weekday: 'long' });
// Returns: "Sonntag", "Montag", etc.
```

**Injected into prompt:**
```
You MUST look for column matching "Sonntag" (2025-12-21)
```

**Why:** German cinema schedules use German day names; explicit matching prevents confusion

### 3. Exact Match Rules

```
RULES:
1. EXACT DATE MATCH: Only times listed under "Sonntag"
2. NO DUPLICATES: Same movie at same cinema only once
3. ACCURACY OVER QUANTITY: If unsure, don't show it
4. REAL TIME CHECK: "19:30" ≠ "19:00" - verify minute exactness
```

### 4. Robust JSON Extraction

```javascript
// Remove markdown code blocks
cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/g, "").replace(/\s*```$/g, "");

// Extract only JSON array (removes conversational text)
const firstBracket = cleanedResponse.indexOf('[');
const lastBracket = cleanedResponse.lastIndexOf(']');
if (firstBracket !== -1 && lastBracket !== -1) {
  cleanedResponse = cleanedResponse.substring(firstBracket, lastBracket + 1);
}
```

**Handles:**
- `"Okay, here are suggestions: [...]"` → `[...]`
- ` ```json\n[...]\n``` ` → `[...]`
- `"[...] Hope this helps!"` → `[...]`

---

## Location Intelligence

### Problem

User enters: `"Gertrud-Grunow-Str. 12, Munich"`
AI was returning: `"location": "Gertrud-Grunow-Str. 12"` ❌ (user's home, not venue)

### Solution

**Three-Tier Location Understanding:**

1. **City** (e.g., "Munich") → Search entire city (20km radius)
2. **Neighborhood** (e.g., "Schwabing") → Search area + adjacent (10km radius)
3. **Street Address** → Search in that city/neighborhood (10km radius)

**NO MIRRORING Rule:**
```
3. NO MIRRORING: NEVER copy "Gertrud-Grunow-Str. 12" into output.
   BAD: "location": "Gertrud-Grunow-Str. 12"
   GOOD: "location": "Mathäser Filmpalast, Bayerstr. 5, Munich"
```

### Search Strategy

```
If user location is a street:
→ Search "Cinema program in [City]"
→ NOT "Cinema at [Street]"

Example:
Input: "Gertrud-Grunow-Str. 12"
Search: "Kino Programm München"
Result: Finds all Munich cinemas ✅
```

---

## Fail-Safe URL Generation

### Problem

AI-generated URLs often lead to 404 errors:
- Hallucinated deep links
- Outdated event pages
- Made-up booking URLs

### Solution: Always Generate Our Own Links

**Never trust AI URLs. Always construct Google Search links.**

```javascript
// Query format: "Avatar Munich 2025-12-21 tickets showtimes"
const queryParts = [
  sug.title,              // "Avatar Fire and Ash"
  suggestionLocation,     // "Cinema Filmtheater Munich"
  date,                   // "2025-12-21" (CRITICAL)
  "tickets",
  "showtimes"
];

const query = queryParts.filter(Boolean).join(" ");
const safeLink = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
```

### Why Include Date?

**Without Date:**
```
Query: "Avatar Munich tickets"
Result: Shows general schedule (all days mixed) ❌
```

**With Date:**
```
Query: "Avatar Munich 2025-12-21 tickets"
Result: Shows schedule specifically for Dec 21 ✅
```

### Why Exclude Time?

**Including Time (Bad):**
```
Query: "Avatar 2025-12-21 20:15"
Problem: Cinema shows "8:15 PM"
Result: No matches (format mismatch) ❌
```

**Excluding Time (Good):**
```
Query: "Avatar 2025-12-21 showtimes"
Result: Shows all showtimes for that date ✅
User picks: 18:30, 20:15, or 22:00
```

### Example Generated URLs

**Movie:**
```
https://www.google.com/search?q=Avatar%20Fire%20and%20Ash%20Cinema%20Filmtheater%20Munich%202025-12-21%20tickets%20showtimes
```

**Restaurant:**
```
https://www.google.com/search?q=Dinner%20at%20Hofbr%C3%A4uhaus%20Munich%202025-12-21%20tickets%20showtimes
```

**Result:** 100% working links, never 404 ✅

---

## Configuration

### Environment Variables

```bash
# .env file
REACT_APP_GEMINI_KEY=your_api_key_here
```

**Get API Key:** https://makersuite.google.com/app/apikey

### API Costs

- **Model:** gemini-2.0-flash-exp (experimental, free during preview)
- **Google Search:** May have additional costs after preview period
- **Temperature 0.1:** Uses fewer tokens (more deterministic)

### Fallback Behavior

If API fails or key is missing:
```javascript
// Returns generic wellness suggestions
getFallbackSuggestions(inputs)
```

---

## Testing

### Test Scenarios

#### 1. Topic Matching
```
Input: "Dinner with friends"
Expected: ALL 3 suggestions are restaurants
Not Expected: Movies, concerts, or other activities
```

#### 2. Location Intelligence
```
Input: "Gertrud-Grunow-Str. 12, Munich"
Expected: Real venue addresses (cinemas, restaurants in Munich)
Not Expected: User's home address in results
```

#### 3. Date Accuracy
```
Input: Sunday, Dec 21, 2025
Expected: Only Sunday's showtimes
Not Expected: Monday's or Saturday's times
```

#### 4. Time Format
```
Input: "Evening" preference
Expected: Times between 18:00-23:00
Not Expected: Morning times (08:00-12:00)
```

#### 5. URL Reliability
```
Action: Click "View details & book tickets"
Expected: Google Search with relevant results
Not Expected: 404 error or broken page
```

### Console Debugging

Check browser console for:
```
✅ "Gemini API returned null, using fallback" - API key issue
✅ "Gemini API Error: {...}" - API error details
✅ Response parsing logs (if debugging enabled)
```

---

## Prompt Evolution History

### Version 1: Initial (Verbose)
- ~3000 words
- Detailed instructions for each activity type
- Multiple formatting sections
- **Issue:** Too long, slow, expensive

### Version 2: Optimized
- ~150 words (95% reduction)
- Concise critical rules
- Simple output format
- **Issue:** Not specific enough, mixed activity types

### Version 3: Topic-Prioritized (Current)
- PRIMARY REQUIREMENT section at top
- Topic is Rule #1 (NON-NEGOTIABLE)
- Explicit examples (Dinner → Restaurants only)
- **Result:** ✅ Accurate topic matching

---

## Known Limitations

1. **Experimental Model:** `gemini-2.0-flash-exp` may change or be deprecated
2. **Search Quality:** Depends on Google Search results quality
3. **Language:** Optimized for German locations (Munich, Berlin, etc.)
4. **Date Format:** Uses ISO format (YYYY-MM-DD) which may not match all sources
5. **Real-Time Data:** Limited to what Google Search can find

---

## Future Improvements

### Potential Enhancements

1. **Caching:** Cache results for same query within 5 minutes
2. **Fallback Models:** Try gemini-1.5-pro if flash fails
3. **Multi-Language:** Support for English, German, other languages
4. **Venue Verification:** Cross-check venue addresses with Google Places API
5. **User Feedback:** Learn from user selections to improve suggestions

### Monitoring

Track:
- API success rate
- Fallback usage frequency
- Average response time
- User satisfaction (save rate)

---

## Troubleshooting

### Issue: Getting Fallback Suggestions

**Symptoms:** Generic "Mindful Activity Session" suggestions

**Causes:**
1. API key not set
2. API quota exceeded
3. Network error
4. Model unavailable

**Solution:**
1. Check `.env` file has `REACT_APP_GEMINI_KEY`
2. Restart dev server after adding key
3. Check browser console for errors
4. Verify API key at https://makersuite.google.com

### Issue: Wrong Activity Type

**Symptoms:** Asked for "Dinner", got "Movie"

**Causes:**
1. Topic not clear in input
2. AI misunderstood topic
3. Caching issue (old results)

**Solution:**
1. Be specific: "Dinner" not "evening activity"
2. Refresh page to clear state
3. Check prompt includes topic correctly

### Issue: Wrong Date

**Symptoms:** Sunday requested, got Monday's times

**Causes:**
1. AI reading wrong schedule column
2. Date calculation error
3. Timezone mismatch

**Solution:**
1. Check `dayName` calculation in code
2. Verify date format in prompt
3. Clear browser cache

### Issue: 404 Links

**Symptoms:** "View details" leads to broken page

**Causes:**
- Should never happen with current implementation
- All links are Google Search (always work)

**Solution:**
- If this occurs, check URL generation code
- Verify `safeLink` construction includes all parts

---

## Code References

### Main Files

**`src/utils/gemini.js`** - API Integration
- Lines 27-41: Request body with Google Search tool
- Line 30: Temperature 0.1 configuration
- Lines 36-40: Google Search tool configuration

**`src/components/PlanActivityModal.jsx`** - Prompt & Processing
- Lines 30-77: System instruction (prompt rules)
- Lines 87-93: User prompt (specific request)
- Lines 97-113: Response cleaning (JSON extraction)
- Lines 120-153: Fail-safe URL generation with date

---

## Summary

**Key Achievements:**

✅ **Real-Time Data:** Google Search integration provides current information
✅ **No Hallucination:** Temperature 0.1 + strict rules = factual responses
✅ **Location Smart:** Understands user location ≠ venue location
✅ **Date Accurate:** Reads correct day from schedule tables
✅ **Topic Focused:** All suggestions match requested activity type
✅ **100% Working Links:** Fail-safe URL generation never leads to 404

**Result:** Reliable, accurate, real-time activity suggestions that users can immediately book! 🎯

