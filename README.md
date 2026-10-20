# JGKIDD portfolio

The confirmed 2023 portfolio, ported to a standalone **TypeScript + Vite** static website. No PHP, WordPress server, database, jQuery or Elementor JavaScript is required. The original layout HTML, CSS, local fonts and media are preserved; browser interactions are implemented in TypeScript.

## Open and run

Open **this `jgkidd-portfolio` folder** in VS Code, rather than its parent folder containing the WordPress backups.

Install Node.js 24 LTS (the version is also recorded in `.nvmrc`), then run:

```sh
npm ci
npm run dev
```

Open the address printed by Vite. To check the production build:

```sh
npm run build
npm run preview
```

`npm run build` generates every page, checks TypeScript, builds the site and verifies local routes and assets. `npm test` checks category selection, email composition, metadata and the public route inventory.

## GitHub and Vercel

This folder is its own Git repository. In VS Code Source Control, commit the files and choose **Publish Branch** to create/push your GitHub repository. Build outputs, dependencies and local environment files are ignored.

1. In Vercel, choose **Add New → Project** and import that repository.
2. Use the **Vite** framework preset. The included `vercel.json` sets the build command to `npm run build` and the output directory to `dist`.
3. Deploy. Each page has its own HTML output, so direct links and refreshes work without a catch-all rewrite.
4. Under the Vercel project's **Settings → Domains**, add your domain and apply the DNS records Vercel gives you.
5. Set the optional `SITE_URL` environment variable to your final `https://` domain and redeploy for canonical URLs and the sitemap. Before that, builds on Vercel use its production URL automatically.

Reference: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Vercel domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

Do not upload the surrounding WordPress backups, SQL files or the `node_modules` folder.

## Edit the site

| File or folder | Purpose |
| --- | --- |
| `src/content/pages/` | Editable HTML for the published portfolio pages. |
| `src/content/pages.json` | Typed page inventory: URLs, titles, descriptions, page styles and social images. |
| `src/content/layout/header.html` | Shared header. |
| `src/content/layout/footer.html` | Shared footer. |
| `src/site.ts` | Site details and shared behavior helpers. |
| `src/main.ts` | Filters, image viewer, contact draft, tabs, video embeds and article contents. |
| `src/carousel.ts` | Autoplaying, looping carousels with touch/trackpad swipes and mouse dragging. |
| `src/styles/site.css` | Static layout adjustments, responsive behavior and accessibility. |
| `public/assets/` | Local images, fonts and preserved design styles. |
| `scripts/generate.ts` | Creates the multi-page HTML inputs for Vite. |
| `scripts/verify.ts` | Checks the final deployable output for broken local URLs and leftover backend references. |

HTML content changes reload in the development server. Restart `npm run dev` after changing the page inventory or generator. To add a page, add its HTML and a matching record to `pages.json` using an existing record as a guide. Reuse the shared page styles or add your own CSS file under `public/assets/styles`.

For local production metadata, copy `.env.example` to `.env` and set `SITE_URL`. On Vercel, set the variable in the project's environment settings instead.

The imported selectors retain their original `elementor-*` names to preserve the existing design. They are ordinary CSS and HTML now; they do not require the plugin.

## Migration decisions

- Five published case studies plus the Bud personal concept, the AI and design-systems articles, About, Contact, the earlier Home page, and two Fabric experiments are included.
- `/` is the project grid; `/projects` redirects to `/`. Retained project and article URLs are preserved; unfinished draft routes are excluded.
- The Contact page is a simple links page for LinkedIn, Instagram (@jg.kidd), and email. Its Email button opens `mailto:joshgriffey@gmail.com`.
- WordPress account login and protected client pages are not part of a public static site. Both the “contact” and “available” header buttons open `/contact/`; the old `/login` URL redirects there too.
- Figma prototypes and YouTube videos remain external embeds. They require the original content to remain available and permitted for embedding.
- The Fabric pages are retained as component experiments and marked `noindex`. Global WordPress preview popups that were being inserted into every page have been removed.
- All carousels autoplay and loop, with touch/trackpad swipes and mouse dragging. The About experience and testimonial carousels have pink/grey pagination bars; the logo carousel and other carousels have no visible controls. Add `data-carousel-pagination="bars"` to a carousel to enable these indicators. Swiping resumes autoplay after a short delay. Keyboard users can use the arrow keys and press Space to pause/play; reduced-motion preferences disable autoplay.
- The earlier `/home/` page's Revolution Slider is now a native scrolling gallery using its original artwork.
- WordPress admin data, account records, draft/revision history, plugin code and license credentials are not copied into this project.

## Asset provenance

The local artwork, photographs, fonts and layout styles were recovered from the supplied `jg-portfolio-2023-bkup` backup. Existing stylesheet license notices are retained. `src/content/asset-manifest.json` maps old asset paths to their new local filenames. No asset license or authorship is changed by this migration.

`scripts/import-wordpress.ts` is the one-time migration utility. Normal editing, builds and deployment **never** require WordPress or that utility. It accepts a directory of rendered public HTML plus the original WordPress public-file directory; it does not read a database.

## Content recovery (October 2026)

Recovered the published AI article and Seekers product explanation from the live 2023 database. Seekers now uses historical wording and the confirmed January 2021 closure date. Bud is included as a personal concept, with four original app screens; draft testimonials and unverified research claims are omitted.

Arrow and Midjourney are excluded from `pages.json`, public listings and generated routes. Their HTML is retained for future editing, with metadata in `src/content/draft-pages.json`. Do not re-import them as published pages. The SQL export is not included in this repository or build.

The design-systems article was restored at the owner’s request, with a finished conclusion replacing placeholder text.
