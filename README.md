# TSA Blog — Static Site

This repository contains a tiny static-site generator that converts markdown files in `posts/` into a styled static site in `docs/`. It's designed to be built by GitHub Actions and deployed to GitHub Pages.

What you'll find here

- `posts/` — markdown files (each may contain minimal YAML frontmatter)
- `templates/` — HTML templates used by the build script
- `assets/` — CSS and static assets copied into `docs/assets`
- `scripts/build.js` — Node.js script that generates the site into `docs/`
- `.github/workflows/pages.yml` — GitHub Actions workflow to build and deploy

Quick run (Windows PowerShell)

1. Install dependencies:

```powershell
npm ci
```

2. Build locally:

```powershell
npm run build
```

3. Preview: open `docs/index.html` in your browser.

GitHub Pages / Actions

The included workflow builds the site on push and deploys the `docs/` folder to the `gh-pages` branch (you can configure Github Pages to serve from `gh-pages` or `docs/` depending on your preference).

Notes

- Posts support a minimal frontmatter block with `title`, `date`, `image`, `tags`, `excerpt`.
- The build script uses `marked` to convert markdown to HTML.

Filename convention and year grouping

- Post filenames may optionally start with a date prefix in the form `YYYY-MM-DD-`, for example:
	- `2024-12-31-japan.md` -> slug becomes `japan` and date defaults to `2024-12-31` if frontmatter `date` is not present.
	- `my-post.md` -> slug becomes `my-post` and the build will use the `date` value from frontmatter (if present) or fall back to the current date.
- The site groups posts by year for the index page using the post's date. The build decides the post date by this order of precedence:
	1. `date` in frontmatter (supports YAML date values)
 2. Date parsed from the filename prefix `YYYY-MM-DD` (if present)
 3. Fallback to the current year when neither exists

Editing the site base URL (used for RSS, sitemap, and email links)

- The generator needs a site base URL to produce absolute links in the RSS feed, sitemap, and newsletter emails. You can set it in either of two places (checked in order):
	1. Set the environment variable `SITE_URL` before running `npm run build` (overrides package.json):

```powershell
$env:SITE_URL = 'https://yourdomain.com'
npm run build
```

	2. Add a `homepage` field to `package.json` (used if `SITE_URL` is not set), for example:

```json
{
	"homepage": "https://yourdomain.com"
}
```

- If neither is provided the generator defaults to `https://example.com` (you should change this before publishing).

Other useful tips

- To create a newsletter-ready HTML for a post, add `newsletter: true` in the post frontmatter. If no post is flagged that way the build will produce a newsletter for the latest post.
- For thumbnails, set `image: path/to/image.jpg` in frontmatter. Local images are copied into `docs/assets/images/` at build time (the build looks for the image next to the post or under the project root path you specify).

