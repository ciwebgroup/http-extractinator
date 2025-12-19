# URL Rewriting Regex Issues - Analysis

## Test Results Summary
- **Score**: 29/33 URLs rewritten (87.9% success)
- **Remaining Issues**: 4 critical patterns
- **Total Unrewritten URLs**: 25

## Critical Issues Found

### 1. Double Slash Problem (HIGHEST PRIORITY)
**Pattern**: `/assets/images//static.cdn-website.com/path/file.js`

**Root Cause**: The regex is matching and replacing part of the URL but leaving the domain path intact.

**Example Failures**:
```html
<!-- Before -->
<script src="https://static.cdn-website.com/mnlt/production/6000/_dm/s/rt/dist/scripts/test-file.js?v=1.2.3"></script>

<!-- After (WRONG) -->
<script src="/assets/styles//static.cdn-website.com/css/main.css"></script>
```

**Why It Happens**: The replacement is happening but the domain isn't being stripped from the path.

**Fix Needed**: Ensure the regex captures the full URL and the replacement only uses the filename, not the full path.

---

### 2. Query Parameters and Fragments
**Pattern**: URLs ending with `?v=1.2.3` or `#fragment` aren't matched properly

**Example Failures**:
```html
<!-- These work -->
https://static.cdn-website.com/script.js

<!-- These fail -->
https://static.cdn-website.com/script.js?v=1.2.3
https://static.cdn-website.com/script.js#fragment
```

**Current Regex**: `(?=['"\\s>\\)])`  
**Problem**: Doesn't account for `?` or `#` as URL terminators

**Fix Needed**: Add `?` and `#` to the lookahead: `(?=['"\\s>\\)?#])`

---

### 3. Data Attributes Not Rewritten
**Pattern**: `data-bg`, `data-src`, `data-image-url` attributes contain full CDN URLs

**Example Failures**:
```html
<div data-bg="https://lirp.cdn-website.com/8f128abb/dms3rep/multi/opt/data-bg-image.jpg?cache=false"></div>
<div data-src="https://static.cdn-website.com/lazy-load-image.png#anchor"></div>
<div data-image-url="https://irp.cdn-website.com/8f128abb/dms3rep/multi/opt/gallery+3-640w.jpg"></div>
```

**Current Behavior**: These are completely ignored by the regex

**Fix Needed**: Add separate regex patterns for data attributes or make the existing patterns more generic

---

### 4. JavaScript String Literals
**Pattern**: URLs inside `<script>` tags in JavaScript variables

**Example Failures**:
```javascript
rtCommonProps["common.resources.cdn.host"] = 'https://static.cdn-website.com';
rtCommonProps["common.resources.folder"] = 'https://static.cdn-website.com/mnlt/production/6000';
rtCommonProps["background.image"] = "https://lirp.cdn-website.com/8f128abb/dms3rep/multi/opt/Design-roof-services-1.jpg";

const imageUrls = [
    "https://irp.cdn-website.com/8f128abb/dms3rep/multi/Metal-Roofing-9.JPG",
    "https://lirp.cdn-website.com/8f128abb/dms3rep/multi/opt/gallery+4-640w.jpg?ts=1234567890"
];
```

**Current Behavior**: Not rewritten at all

**Fix Needed**: This is complex - may want to:
- Option A: Leave these as-is (they're runtime config, not asset loading)
- Option B: Add specific patterns for common JS variable patterns
- Option C: Use a more aggressive "any string literal" pattern

---

## Additional Issues

### 5. CSS url() in Inline Styles
**Pattern**: `style="background-image:url(https://...)"` with no spaces

**Status**: Partially working but needs testing with minified HTML

---

### 6. SVG Image References
**Pattern**: `<image href="..." />` and `<image xlink:href="..." />`

**Example**:
```html
<svg>
    <image href="https://irp.cdn-website.com/8f128abb/dms3rep/multi/opt/svg-image.png" />
    <image xlink:href="https://static.cdn-website.com/8f128abb/dms3rep/multi/opt/svg-xlink-image.jpg?v=1" />
</svg>
```

**Status**: Not being rewritten

---

### 7. Form Actions and Nested URLs
**Pattern**: URLs that contain other URLs as query parameters

**Example**:
```html
<form action="https://www.designroofservicesllc.com/submit?redirect=https://static.cdn-website.com/success.html">
```

**Status**: The nested URL isn't being rewritten

---

## Recommended Fix Priority

1. **Fix double slash issue** (breaks page functionality)
2. **Add query param/fragment support** (very common)
3. **Add data attribute support** (common in modern frameworks)
4. **Decide on JavaScript variables** (may not need fixing)
5. **SVG image references** (less common)
6. **Nested URLs** (edge case)

---

## Testing Commands

```bash
# Run the regex test suite
deno task test:regex

# Test with limited pages
deno task copy https://www.designroofservicesllc.com --max-pages=5

# Check for remaining CDN URLs
grep -r "static\.cdn-website\.com" sites/www.designroofservicesllc.com --include="*.html" | wc -l
```

---

## Current Regex Patterns (copy.ts)

### Images
```regex
https?:\/\/(?:www\.)?${domain}\/(?:[^\/]+\/)*([^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp))(?=['"\\s>])
```

### Scripts
```regex
https?:\/\/(?:www\.)?${domain}\/(?:[^\/]+\/)*([^"']+\.(js))(?=['"\\s>])
```

### Styles
```regex
https?:\/\/(?:www\.)?${domain}\/(?:[^\/]+\/)*([^"']+\.(css))(?=['"\\s>])
```

### Fonts
```regex
https?:\/\/(?:www\.)?${domain}\/(?:[^\/]+\/)*([^"']+\.(woff|woff2|ttf|otf|eot))(?=['"\\s>])
```

### Icons
```regex
https?:\/\/(?:www\.)?${domain}\/(?:[^\/]+\/)*([^"']+\.(ico))(?=['"\\s>])
```

---

## Notes

- The `(?:[^\/]+\/)*` pattern correctly handles multiple directory levels now (fixed earlier)
- The lookahead `(?=['"\\s>])` needs to include `?`, `#`, and `)` for better coverage
- Consider using `[^"'?#\s>)]+` instead of `[^"']+` for the filename capture to stop at query params/fragments

