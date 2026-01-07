# URL Rewriting Patterns - Compressed Reference

---

## 1. Script src
```regex
(<script[^>]+src=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.js(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<script src="...">` tags

---

## 2. Link stylesheet (standard)
```regex
(<link[^>]+rel=["']stylesheet["'][^>]+href=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.css(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<link rel="stylesheet" href="...">` (rel before href)

---

## 3. Link stylesheet (reversed)
```regex
(<link[^>]+href=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.css(?:\?[^"']*)?(?:#[^"']*)?)(["'][^>]+rel=["']stylesheet["'])
```
Matches `<link href="..." rel="stylesheet">` (href before rel)

---

## 4. Link preload font
```regex
(<link[^>]+rel=["']preload["'][^>]+href=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(woff|woff2|ttf|otf|eot)(?:\?[^"']*)?(?:#[^"']*)?)(["'][^>]+as=["']font["'])
```
Matches `<link rel="preload" href="..." as="font">`

---

## 5. Image src
```regex
(<img[^>]+src=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<img src="...">`

---

## 6. Image srcset
```regex
(<img[^>]+srcset=["'])((?:https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?(?:\s+\d+w)?,?\s*)+)(["'])
```
Matches `<img srcset="url 640w, url 1920w">`

---

## 7. Source srcset
```regex
(<source[^>]+srcset=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?(?:\s+\d+w)?)(["'])
```
Matches `<source srcset="...">` in picture elements

---

## 8. Meta og:image
```regex
(<meta[^>]+property=["']og:image["'][^>]+content=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<meta property="og:image" content="...">`

---

## 9. Meta twitter:image
```regex
(<meta[^>]+name=["']twitter:image["'][^>]+content=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<meta name="twitter:image" content="...">`

---

## 10. Link icon
```regex
(<link[^>]+rel=["']icon["'][^>]+href=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.ico(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<link rel="icon" href="...">`

---

## 11. Link apple-touch-icon
```regex
(<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<link rel="apple-touch-icon" href="...">`

---

## 12. Inline style background-image
```regex
(style=["'][^"']*background-image:\s*url\(["']?)(https?:\/\/(?:www\.)?${domain}\/[^"')]+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"')]*)?(?:#[^"')]*)?)(["']?\))
```
Matches `style="background-image: url('...')"`

---

## 13. CSS url() function
```regex
(url\(["']?)(https?:\/\/(?:www\.)?${domain}\/[^"')]+\.(woff|woff2|ttf|otf|eot|avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"')]*)?(?:#[^"')]*)?)(["']?\))
```
Matches `url(...)` in CSS (fonts and images)

---

## 14. Data attributes
```regex
(data-(?:image-url|src|bg)=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `data-image-url`, `data-src`, `data-bg` attributes

---

## 15. Source src (media)
```regex
(<source[^>]+src=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(mp4|webm|ogg|mp3|wav)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<source src="...">` for video/audio

---

## 16. Video poster
```regex
(<video[^>]+poster=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<video poster="...">`

---

## 17. Input type=image src
```regex
(<input[^>]+type=["']image["'][^>]+src=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<input type="image" src="...">`

---

## 18. SVG image href
```regex
(<image[^>]+href=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<image href="...">` in SVG

---

## 19. SVG image xlink:href
```regex
(<image[^>]+xlink:href=["'])(https?:\/\/(?:www\.)?${domain}\/[^"']+\.(avif|jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?(?:#[^"']*)?)(["'])
```
Matches `<image xlink:href="...">` (legacy SVG)

---

## 20. Universal pattern (experimental)
```regex
https?:\/\/(?:www\.)?${domainPattern}\/(?:[^/\s"'>\(\)]+\/)*?([^/\s"'>\(\)?#]+\.(?:${exts}))(?:(?:\?[^\s"'>\(\)]*)|(?:#[^\s"'>\(\)]*))?
```
Generic pattern matching URLs anywhere (use with caution)

---

## Asset Type Mapping

| Extension | Asset Folder |
|-----------|--------------|
| `.js` | `/assets/scripts/` |
| `.css` | `/assets/styles/` |
| `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot` | `/assets/fonts/` |
| `.avif`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp` | `/assets/images/` |
| `.ico` | `/assets/icons/` |
| `.mp4`, `.webm`, `.ogg`, `.mp3`, `.wav` | `/assets/media/` |

