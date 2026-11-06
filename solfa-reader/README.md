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

## Publish the website (one time, repository owner)
1. Merge this work into `master`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `master` that changes `solfa-reader/` rebuilds and publishes the site at
   `https://<your-user>.github.io/<repository>/` (workflow: `.github/workflows/solfa-reader.yml`).

Any static host also works (Netlify, Vercel, Cloudflare Pages): root directory `solfa-reader`,
build command `npm run build`, output directory `dist`.

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
