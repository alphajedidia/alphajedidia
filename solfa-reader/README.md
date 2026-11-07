# Solfa Reader 🎶

**Alaivo sary ny solfa, henoy ny feonao.** Take a photo of a tonic sol-fa score and hear every
choir voice — Soprano, Alto, Tenor, Bass — together or one by one, so you can learn your part by ear.

* Free, no account, no advertising.
* Works in the phone's browser and can be **installed on the home screen**; works **offline**
  after the first visit.
* The photo is read **on your phone** (nothing is uploaded).
* Malagasy, English and French.

## How to use
1. **Scan**: tap *Scan a score* → take a photo (good light, flat page, fill the screen with the
   music) → crop → wait a few seconds.
2. **Check**: the app shows each line it read under the matching strip of the photo. Fix anything
   wrong with the sol-fa keypad (uncertain characters are highlighted).
3. **Listen**: tap *Play*. Choose your voice and tap **Focus** (your voice loud, others soft) or
   **Solo**. Slow the tempo, loop difficult bars.
4. **Share** with your choir: *Share* creates a link (the song is inside the link) to send by
   WhatsApp, Messenger or SMS.

You can also **type** a song. The format is described in [docs/SOLFA_FORMAT.md](docs/SOLFA_FORMAT.md);
short version:

```
key: G
S: | m  :m  :f  :s  | s  :f  :m  :r  |
A: | d  :d  :l, :t, | d  :l, :d  :t, |
T: | s  :s  :f  :r  | m  :r  :s  :s  |
B: | d, :d, :r, :s, | d, :f, :d, :s, |
```

## Publish the website (free, one time)

The site is plain static files, so any free static host works. GitHub Actions cannot be used on
this account right now (GitHub: "account is locked due to a billing issue"), so use a host that
builds the site on its own machines:

**Cloudflare Pages (recommended — free, unlimited traffic, has a data centre in Antananarivo)**
1. Sign up at https://dash.cloudflare.com (free, no card needed) → *Workers & Pages* →
   *Create* → *Pages* → *Connect to Git* → choose GitHub → repository `alphajedidia/alphajedidia`.
2. Settings: **Production branch** `master` (or `claude/solfa-reader-apk-2frj02` to publish now),
   **Framework preset** None, **Build command** `npm run build`, **Build output directory**
   `dist`, **Root directory** `solfa-reader`.
3. *Save and Deploy*. The site appears at `https://<project-name>.pages.dev`; every push updates it.

**Netlify (alternative)**: *Add new site → Import an existing project → GitHub →* the repository,
**Base directory** `solfa-reader` (the rest is read from `solfa-reader/netlify.toml`).

**GitHub Pages (once the GitHub billing lock is solved)**: merge into `master`, then
*Settings → Pages → Source: GitHub Actions*; `.github/workflows/solfa-reader.yml` publishes to
`https://<user>.github.io/<repository>/`.

## For developers
```
cd solfa-reader
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
npm run e2e        # browser smoke tests (needs Playwright + Chromium)
```
Start with [CLAUDE.md](CLAUDE.md) and the [docs](docs/). The project is built by a team of
Claude Code agents (`../.claude/agents/`); `/solfa-continue` resumes the work.
