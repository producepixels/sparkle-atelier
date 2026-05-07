# Sparkle Atelier

Diamond painting pattern converter. Upload a photo, get a printable pattern with DMC color codes, numbered cells, and a tight grid that matches your canvas size exactly.

A free tool by [Produce Pixels](https://producepixels.com).

## Features

- **240+ DMC colors** with perceptual (CIE Lab) color matching
- **Auto-sizing grid** — set canvas inches + drill mm, grid math is exact
- **Numbers and letters** instead of confusing symbols
- **Printable pattern** with cover page, full legend, and tiled chart pages
- **Mobile-friendly** — works on phones and tablets

## Local development

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
```

Outputs to `dist/`. Cloudflare Pages auto-detects this.

## Deployment

Hosted on Cloudflare Pages. Pushes to `main` auto-deploy.
