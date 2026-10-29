# cheapflights

Flight comparison site for travellers from Bratislava (BTS), Vienna (VIE), Budapest (BUD), Košice (KSC) and Prague (PRG).
Built with Next.js (App Router), TypeScript, Tailwind CSS, Supabase and Vercel. Prices come from the free,
cached Travelpayouts data, and flight links earn a small affiliate commission through Aviasales.

Live: https://cheap-flights-app.vercel.app

## Run it on your computer

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The keys the site needs live in a file called `.env.local` (never commit it):

| Name | What it is for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | hostels and weekly deals |
| `TRAVELPAYOUTS_TOKEN` | flight prices |
| `CRON_SECRET` | protects the daily deals job |
| `UNSPLASH_ACCESS_KEY` | only for `npm run images` (country photos) |
| `PEXELS_API_KEY` | optional: only used by `npm run images` when Unsplash is unavailable |

Before you publish a change, run `npm run build` and `npm run lint`. Both should finish without errors.

## Country photos

The Anywhere results show one photo per country. The photos are chosen **ahead of time** by a script and saved in
`data/country-images.json`, so visitors never wait for (or use up the limits of) a photo website.

```bash
npm run images                   # fetch every country that has no photo yet
npm run images -- --wait         # when the hourly limit is hit, wait and carry on by itself
npm run images -- --only=IT,ES   # only these countries (use --refresh to replace existing ones)
```

What you need to know:

1. Create a free app at https://unsplash.com/developers, copy its **Access Key** and add the line
   `UNSPLASH_ACCESS_KEY=your-key` to `.env.local`. (The secret key is not needed.)
2. A new Unsplash app may make **50 requests an hour**, and each country needs 2 to 4. So one run does about 12 to 25
   countries, most likely destinations first, and then stops politely. Run it again later and it **continues where it
   stopped**. With `--wait` it waits for the next hour by itself (leave the window open).
   Applying for "production" status in the Unsplash dashboard raises the limit to 5000 an hour.
3. Optional: a free key from https://www.pexels.com/api/ saved as `PEXELS_API_KEY=your-key`. If Unsplash is unavailable
   (wrong key, limit reached), the script carries on with Pexels.
4. The script skips photos that mention people, picks landscapes and landmarks, and writes
   `data/country-images-review.md`: a list with a link to every chosen photo. Skim it once. To replace a bad pick, delete
   its entry in `data/country-images.json` and run `npm run images -- --only=CODE`.
5. Commit `data/country-images.json` and `data/country-images-review.md`, and push. That is what puts the photos on the site.

The rules of the photo sites are followed: photos are loaded straight from their servers, every photo shows
"Photo by NAME on Unsplash" (or Pexels) with links, and each photo Unsplash picks is reported to its download endpoint.
A country without a photo shows a gradient with its flag, so nothing ever looks broken.

## Flags

Flags are small SVG pictures in `public/flags/` (they come from the `flag-icons` package, MIT licence), so they also
show on Windows, where flag emoji turn into letters. To refresh them after updating the package: `npm run flags`.

## Where things are

See `AGENTS.md` for the map of the code, and `PROGRESS.md` for what was changed and why.
