const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const yaml = require('js-yaml');

// Frontmatter parser using js-yaml for robust YAML support
function parseFrontMatter(content) {
  if (content.startsWith('---')) {
    // find closing --- on its own line
    const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (m) {
      try {
        const data = yaml.load(m[1]) || {};
        const body = content.slice(m[0].length);
        return { data, body };
      } catch (e) {
        console.warn('Failed to parse frontmatter YAML:', e.message);
      }
    }
  }
  return { data: {}, body: content };
}

function slugFromFilename(name) {
  return name.replace(/^(\d{4}-\d{2}-\d{2}-)?/, '').replace(/\.md$/i, '').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function formatDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Read templates
const root = path.resolve(__dirname, '..');
const postsDir = path.join(root, 'posts');
const templatesDir = path.join(root, 'templates');
const assetsDir = path.join(root, 'assets');
const outDir = path.join(root, 'docs');
// Clean output directory to avoid stale files from previous runs
if (fs.existsSync(outDir)) {
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}
ensureDir(outDir);

const indexTpl = fs.readFileSync(path.join(templatesDir, 'index.html'), 'utf8');
const postTpl = fs.readFileSync(path.join(templatesDir, 'post.html'), 'utf8');
const tagTpl = fs.readFileSync(path.join(templatesDir, 'tag.html'), 'utf8');

// Collect posts
const files = fs.existsSync(postsDir) ? fs.readdirSync(postsDir).filter(f => f.endsWith('.md')) : [];
const posts = files.map(f => {
  const full = path.join(postsDir, f);
  const raw = fs.readFileSync(full, 'utf8');
  const { data, body } = parseFrontMatter(raw);
  const slug = data.slug || slugFromFilename(f);
  const html = marked.parse(body);
  const title = data.title || (body.split(/\r?\n/).find(l => l.startsWith('#')) || f).replace(/^#+\s*/, '').trim();
  // normalize date to an ISO string so year extraction is reliable
  let dateIso = '';
  // 1) frontmatter date (YAML date object or string)
  if (data.date) {
    if (data.date instanceof Date && !isNaN(data.date)) {
      dateIso = data.date.toISOString();
    } else {
      // try parsing common string forms
      const tryParse = new Date(String(data.date));
      if (!isNaN(tryParse)) {
        dateIso = tryParse.toISOString();
      } else {
        // try M-D-YYYY or MM-DD-YYYY explicitly (e.g. 11-4-2025)
        const m = String(data.date).trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (m) {
          const [_, mo, da, yr] = m;
          const dt = new Date(Number(yr), Number(mo) - 1, Number(da));
          if (!isNaN(dt)) dateIso = dt.toISOString();
        }
      }
    }
  }

  // 2) fallback: filename prefix YYYY-M-D or YYYY-MM-DD
  if (!dateIso) {
    const mf = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (mf) {
      const [_, yr, mo, da] = mf;
      const dt = new Date(Number(yr), Number(mo) - 1, Number(da));
      if (!isNaN(dt)) dateIso = dt.toISOString();
    }
  }

  // 3) final fallback: now
  if (!dateIso) dateIso = new Date().toISOString();

  const date = dateIso;
  const excerpt = data.excerpt || body.split('\n').slice(0,3).join(' ').replace(/[#_*`]/g,'').slice(0,240);
  const tags = (data.tags || '').split(',').map(t=>t.trim()).filter(Boolean);
  const image = data.image || data.thumbnail || '';
  return { file: f, slug, title, date, html, excerpt, tags, image };
}).sort((a,b)=> {
  const ta = new Date(a.date).getTime() || 0;
  const tb = new Date(b.date).getTime() || 0;
  return tb - ta;
});

// Group by year for index
const byYear = {};
for (const p of posts) {
  const year = (new Date(p.date).getFullYear() || new Date().getFullYear()).toString();
  byYear[year] = byYear[year] || [];
  byYear[year].push(p);
}


// Generate per-post pages
ensureDir(path.join(outDir, 'posts'));
// prepare images output folder
const imagesOut = path.join(outDir, 'assets', 'images');
ensureDir(imagesOut);

for (const p of posts) {
  // handle image/frontmatter if present
  let imageHtml = '';
  if (p.image || p.image === '') {
    // if image was added to post object, that wasn't included above; rebuild from file frontmatter
  }
  // attempt to read frontmatter again to get image reliably
  const raw = fs.readFileSync(path.join(postsDir, p.file), 'utf8');
  const { data } = parseFrontMatter(raw);
  const image = (data && (data.image || data.thumbnail)) || '';
  let imageUrl = '';
  if (image) {
    if (/^https?:\/\//.test(image)) {
      imageUrl = image;
    } else {
      // local path: try relative to postsDir, then repo root
      const candidate1 = path.join(postsDir, image);
      const candidate2 = path.join(root, image.replace(/^\//,''));
      let found = null;
      if (fs.existsSync(candidate1)) found = candidate1;
      else if (fs.existsSync(candidate2)) found = candidate2;
      if (found) {
          const base = path.basename(found);
          const dest = path.join(imagesOut, base);
          try { fs.copyFileSync(found, dest); } catch(e){/* ignore */}
          // Use relative (no leading slash) paths so assets resolve correctly when the site
          // is hosted under a repository subpath on GitHub Pages (e.g. /owner/repo/).
          imageUrl = `assets/images/${base}`;
        }
    }
  if (imageUrl) imageHtml = `<div class="post-hero"><img class="post-hero-img" src="{{base}}${imageUrl}" alt="${p.title}"></div>`;
    // store the resolved image URL for index thumbnails
    p.imageUrl = imageUrl;
  }

  const outPath = path.join(outDir, 'posts', p.slug + '.html');
  const content = postTpl.replace(/\{\{title\}\}/g, p.title)
    .replace(/\{\{date\}\}/g, formatDate(p.date))
    .replace(/\{\{content\}\}/g, p.html)
    .replace(/\{\{tags\}\}/g, p.tags.map(t=>`<span class="tag"><a href="tags/${encodeURIComponent(t)}.html">${t}</a></span>`).join(' '))
    .replace(/\{\{excerpt\}\}/g, p.excerpt)
    .replace(/\{\{image\}\}/g, imageHtml);
  // Post pages live in /posts/, so asset links need a "../" prefix
  fs.writeFileSync(outPath, content.replace(/\{\{base\}\}/g, '../'), 'utf8');
}

// Generate index page that lists posts (title + excerpt linking to per-post pages)
let indexContent = '';
for (const year of Object.keys(byYear).sort((a,b)=>b.localeCompare(a))) {
  indexContent += `<h2 class="year">${year}</h2>\n`;
  for (const p of byYear[year]) {
    indexContent += `
    <article class="post-card">
      ${p.imageUrl ? `<div class="thumb"><img src="${p.imageUrl}" alt="${p.title}"></div>` : ''}
      <div class="meta">
        <a class="title" href="posts/${p.slug}.html">${p.title}</a>
        <div class="excerpt">${p.excerpt}</div>
  <div class="info">${formatDate(p.date)} • <a href="posts/${p.slug}.html">read</a></div>
        <div class="tags">${p.tags.map(t=>`<a class="tag" href="tags/${encodeURIComponent(t)}.html">${t}</a>`).join(' ')}</div>
      </div>
    </article>\n`;
  }
}

// Write index with base = '' (root)
const finalIndex = indexTpl.replace(/\{\{content\}\}/g, indexContent).replace(/\{\{base\}\}/g, '');
fs.writeFileSync(path.join(outDir, 'index.html'), finalIndex, 'utf8');

// Generate tag pages
ensureDir(path.join(outDir, 'tags'));
const tagMap = {};
for (const p of posts) {
  for (const t of p.tags) {
    tagMap[t] = tagMap[t] || [];
    tagMap[t].push(p);
  }
}

for (const tag of Object.keys(tagMap)) {
  const postsList = tagMap[tag].map(p => `
    <article class="post-card">
      <a class="title" href="index.html#${p.slug}">${p.title}</a>
      <div class="excerpt">${p.excerpt}</div>
      <div class="info">${formatDate(p.date)}</div>
    </article>`).join('\n');
  const content = tagTpl.replace(/\{\{tag\}\}/g, tag)
    .replace(/\{\{content\}\}/g, postsList)
    // tag pages are in /tags/, so use ../ for assets
    .replace(/\{\{base\}\}/g, '../');
  fs.writeFileSync(path.join(outDir, 'tags', `${tag}.html`), content, 'utf8');
}

// Generate RSS feed
function escapeXml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// Determine site URL used for RSS/sitemap/email absolute links.
// Editable options (in order): environment variable SITE_URL, package.json "homepage", fallback to example.com
const pkgPath = path.join(root, 'package.json');
let siteUrl = 'https://dmhs-tsa.github.io/Newsletter/';
if (fs.existsSync(pkgPath)) {
  try { const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); if (pkg.homepage) siteUrl = pkg.homepage; } catch(e){}
}
if (process.env.SITE_URL) siteUrl = process.env.SITE_URL;
// Normalize: remove trailing slash
siteUrl = siteUrl.replace(/\/$/, '');

  const rssItems = posts.map(p => `
  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${siteUrl}/posts/${p.slug}.html</link>
    <guid>${siteUrl}/posts/${p.slug}.html</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description><![CDATA[${p.excerpt}]]></description>
  </item>
`).join('\n');
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>TSA Blog</title>
  <link>${siteUrl}</link>
  <description>Blog feed</description>
${rssItems}
</channel>
</rss>`;
fs.writeFileSync(path.join(outDir, 'rss.xml'), rss, 'utf8');

// Generate sitemap (index + tag pages)
const urls = [];
urls.push(`${siteUrl}/index.html`);
// include tag pages
for (const tag of Object.keys(tagMap)) urls.push(`${siteUrl}/tags/${encodeURIComponent(tag)}.html`);
// include per-post pages
for (const p of posts) urls.push(`${siteUrl}/posts/${p.slug}.html`);
const sitemapItems = urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapItems}\n</urlset>`;
fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap, 'utf8');

// --- Generate search index JSON for client-side search ---
const searchIndex = posts.map(p => ({
  title: p.title,
  date: p.date,
  tags: p.tags,
  excerpt: p.excerpt,
  slug: p.slug,
  // strip HTML tags for content preview
  content: p.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}));
fs.writeFileSync(path.join(outDir, 'search-index.json'), JSON.stringify(searchIndex, null, 2), 'utf8');

// --- Generate newsletter email HTML(s) ---
ensureDir(path.join(outDir, 'newsletters'));
// find posts with newsletter: true or fallback to the latest post
const newsletterPosts = posts.filter(p => {
  const raw = fs.readFileSync(path.join(postsDir, p.file), 'utf8');
  const fm = parseFrontMatter(raw).data || {};
  return fm.newsletter === true;
});
if (!newsletterPosts.length && posts.length) {
  newsletterPosts.push(posts[0]);
}
  for (const p of newsletterPosts) {
  const raw = fs.readFileSync(path.join(postsDir, p.file), 'utf8');
  const fm = parseFrontMatter(raw).data || {};
  const subject = fm.email_subject || p.title;
  // p.imageUrl is stored as a relative path without a leading slash (e.g. assets/images/foo.jpg)
  const hero = (p.imageUrl) ? `<div class="hero"><img src="${siteUrl}/${p.imageUrl}" alt="${p.title}"/></div>` : '';
  const emailHtml = fs.readFileSync(path.join(templatesDir, 'email.html'), 'utf8')
    .replace(/\{\{subject\}\}/g, subject)
    .replace(/\{\{title\}\}/g, p.title)
    .replace(/\{\{date\}\}/g, formatDate(p.date))
    .replace(/\{\{hero\}\}/g, hero)
    .replace(/\{\{content\}\}/g, p.html)
    .replace(/\{\{siteUrl\}\}/g, siteUrl)
    .replace(/\{\{slug\}\}/g, p.slug);
  fs.writeFileSync(path.join(outDir, 'newsletters', `${p.slug}.html`), emailHtml, 'utf8');
}

// Copy assets
if (fs.existsSync(assetsDir)) {
  const copy = (src, dest) => {
    if (fs.statSync(src).isDirectory()) {
      ensureDir(dest);
      for (const f of fs.readdirSync(src)) copy(path.join(src,f), path.join(dest,f));
    } else {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  };
  copy(assetsDir, path.join(outDir, 'assets'));
}

// Copy public/ root files (favicon, etc.) into docs root
const publicDir = path.join(root, 'public');
if (fs.existsSync(publicDir)) {
  const copy = (src, dest) => {
    if (fs.statSync(src).isDirectory()) {
      ensureDir(dest);
      for (const f of fs.readdirSync(src)) copy(path.join(src,f), path.join(dest,f));
    } else {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  };
  copy(publicDir, outDir);
}

console.log('Build complete. Output in', outDir);
