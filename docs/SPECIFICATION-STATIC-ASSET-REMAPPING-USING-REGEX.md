# Specification for Remapping Scraped Static Assets using Regular Expression 

The extractinator downloads and catalogs static assets by file type.  This requires the HTML of the webpage to be rewritten to properly resolve the asset location relative to the root (/) of the domain.


## Requirements

1. Minification Proof
2. Attribute Order
3. Mismatched Quotes
4. Srcset Limitations
5. Ensure support for these extensions tool: .mjs, .cjs, .heic, .tiff, .m4v, .flac
6. Preserves JSON-LD
7. Modified JS is still parsable
8. Renders without Console Errors
9. Fault Tollerant


## Before and After Testing and Validation

The following are things to check for after running the Asset Remapping Regex:

- Tag Count
- Validation
- Console Errors


## Suggestions

1. Minification Support:  `[^>]+` to `\s[^>]*?`
2. Tag Boundries
3. Expand File Format Support
4. Use non-capturing groups and word boundaries (\b) to make patterns more robust against minification and varying attribute orders.



## Principles

- Each pattern MUST specify what comes before (attr=) and after (quote)
- Use non-greedy quantifiers (.+?) for path matching
- Exclude <> from character classes to prevent crossing tag boundaries
- Handle query params (?) and fragments (#) explicitly




## Asset Types

All assets are saved to `/assets/{type}/{filename}.{ext}` with flattened paths.


### Scripts

**Folder:** `/assets/scripts/`  
**Extensions:** `.js` `.mjs` `.cjs`

**Embedding Patterns:**
```html
<script src="https://cdn.example.com/app.js"></script>
```

---

### Stylesheets

**Folder:** `/assets/styles/`  
**Extensions:** `.css`

**Embedding Patterns:**
```html
<link rel="stylesheet" href="https://cdn.example.com/styles.css">
```
```css
@import url('https://cdn.example.com/base.css');
```

---

### Images

**Folder:** `/assets/images/`  
**Extensions:** `.jpg` `.jpeg` `.png` `.gif` `.webp` `.svg` `.bmp` `.avif` `.tiff` `.heic`

**Embedding Patterns:**
```html
<!-- Standard img tag -->
<img src="https://cdn.example.com/photo.jpg" alt="...">

<!-- Responsive srcset -->
<img srcset="https://cdn.example.com/img-1x.jpg 1x, https://cdn.example.com/img-2x.jpg 2x">
<source srcset="https://cdn.example.com/hero.webp">

<!-- Social meta tags -->
<meta property="og:image" content="https://cdn.example.com/share.jpg">
<meta name="twitter:image" content="https://cdn.example.com/card.jpg">

<!-- Apple touch icon -->
<link rel="apple-touch-icon" href="https://cdn.example.com/icon-180.png">
```
```html
<!-- Inline CSS -->
<div style="background-image: url('https://cdn.example.com/bg.png')"></div>
```
```css
/* CSS file */
.hero { background-image: url('https://cdn.example.com/bg.jpg'); }
```

---

### Icons

**Folder:** `/assets/icons/`  
**Extensions:** `.ico` `.svg` `.png`

**Embedding Patterns:**
```html
<link rel="icon" href="https://cdn.example.com/favicon.ico">
<link rel="shortcut icon" href="https://cdn.example.com/favicon.ico">
```

---

### Fonts

**Folder:** `/assets/fonts/`  
**Extensions:** `.woff` `.woff2` `.ttf` `.otf` `.eot`

**Embedding Patterns:**
```css
@font-face {
  font-family: 'CustomFont';
  src: url('https://cdn.example.com/font.woff2') format('woff2');
}
```

---

### Video

**Folder:** `/assets/videos/`  
**Extensions:** `.mp4` `.webm` `.ogg` `.m4v` `.mov` `.avi`

**Embedding Patterns:**
```html
<video src="https://cdn.example.com/intro.mp4"></video>
<video poster="https://cdn.example.com/poster.jpg">
  <source src="https://cdn.example.com/video.webm" type="video/webm">
</video>
```

---

### Audio

**Folder:** `/assets/audio/`  
**Extensions:** `.mp3` `.wav` `.ogg` `.flac` `.aac` `.m4a`

**Embedding Patterns:**
```html
<audio src="https://cdn.example.com/track.mp3"></audio>
<audio>
  <source src="https://cdn.example.com/sound.ogg" type="audio/ogg">
</audio>
```

---

### SVG (Inline)

**Folder:** `/assets/images/`  
**Extensions:** `.svg`

**Embedding Patterns:**
```html
<!-- Inside inline SVG elements -->
<svg>
  <image href="https://cdn.example.com/graphic.svg" />
  <image xlink:href="https://cdn.example.com/legacy.svg" />
</svg>
```

---

### Other / Documents

**Folder:** `/assets/other/`  
**Extensions:** `.pdf` `.zip` `.json` `.xml` `.txt` `.map`

**Embedding Patterns:**
```html
<a href="https://cdn.example.com/doc.pdf" download>Download PDF</a>
<embed src="https://cdn.example.com/doc.pdf">
<object data="https://cdn.example.com/doc.pdf"></object>
```

---

> **Note:** Assets can appear in multiple contexts. Always test patterns against all common usages shown above 