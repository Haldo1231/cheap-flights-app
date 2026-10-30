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

## Budget ("I want to go, max 300 EUR")

On the search form (step 5) and above every results list there is an optional **Max total budget** and a **Spending style**.
Results then show an estimated total (flight + what you spend there), mark trips "within budget" or "over budget" and put the
within-budget ones first. It works for round trips (including fly-back-to-another-airport), in exact dates, date range, whole month and Anywhere. It is **not** offered for one-way searches: the section is hidden, switching to One way clears it, and a budget in a one-way address is ignored, so it can never silently filter one-way results.

How a total is worked out (the same on every screen): **total = flight price + days of stay x cost of one day**.
The flight price is the cached Travelpayouts price (both flights of a round trip). Days of stay = the nights between the two
dates (at least 1). The cost of one day = accommodation + food + transport + other, taken from the
`destinations` table (`hostel_avg_price`, `food_avg_price`, `transport_avg_price`, `other_avg_price`) and multiplied for the style.

The three styles live in `app/budgetConfig.ts`. They are our **assumptions**, written as multipliers on the destination's numbers:

| Style | Accommodation | Food | Transport | Other | Picture |
| --- | --- | --- | --- | --- | --- |
| Ultra cheap | x 0.8 | x 0.6 | x 0.5 | x 0.3 | dorm bed, street food, walking, free sights |
| Middle | x 1 | x 1 | x 1 | x 1 | exactly the current estimate (hostel, cafés, public transport) |
| Rich | x 3 | x 2.5 | x 3 | x 3 | private room or hotel, restaurants, taxis, paid sights |

Example, Rome (hostel 30, food 25, transport 5, other 10 = 70 a day): Ultra cheap 45 a day, Middle 70, Rich 198.
To make a style cheaper or dearer, change its numbers in `app/budgetConfig.ts` (nothing else needs touching). The quick budget
buttons (150, 300, 500, 1000) are `BUDGET_CHIPS` in the same file.

Things to know:
- A destination that is missing any of the four cost numbers (or is not in the `destinations` table at all) has **no cost data**:
  the page shows the flight price only, says "No cost data" and never counts it as within budget. Only the 12 destinations in
  `app/destinationsList.ts` have cost data today, so many Anywhere cities show "No cost data".
- Not included in the estimate: activities and tours, shopping, travel insurance, bag and seat fees. Flight prices are cached.
- In the Anywhere country list, each country is judged by its cheapest-looking city (the one that is checked against your dates).
  Open a country to see every one of its cities ranked by total cost.
- The budget is kept in the address (`budget=300`, `level=ultra`, `within=true`) so links can be shared. It is not sent to the price
  provider, so changing it never causes new price requests.

## Dark mode colours

All dark colours are `--dark-*` variables in one block in `app/globals.css` (look for "DARK THEME VALUES"). For a lighter dark mode
raise `--dark-paper`, `--dark-surface`, `--dark-sand` and `--dark-line` together (each a bit lighter than the one before, so the page,
the cards and the borders stay clearly separate). For a darker one, lower them. `--dark-deep` is the header, footer and top bands.
Keep `--dark-slate` (secondary text) light enough to read: it should stay above a 4.5:1 contrast against `--dark-surface`.
The previous, darker values are written in the comment above the block.

## Flags

Flags are small SVG pictures in `public/flags/` (they come from the `flag-icons` package, MIT licence), so they also
show on Windows, where flag emoji turn into letters. To refresh them after updating the package: `npm run flags`.

## Trip reports and guides (the content section)

The site has two kinds of articles. They are plain text files in the `content/` folder, so there is no database and
nothing to log into:

- **Trips** (`/trips`): your real trips, with what they really cost. Files go in `content/trips/`.
- **Guides** (`/guides`): articles such as "Where to fly from: Košice vs Vienna vs Budapest". Files go in `content/guides/`.

The only trip that exists today is `content/trips/sample-trip.md`. It is a **fake sample** (marked `draft: true` and
"SAMPLE, NOT REAL"). It shows up when you run the site on your computer and is hidden on the live site.
Delete it when you have your first real trip.

### How to add a new trip

1. Copy `content/_templates/trip.md` to `content/trips/<your-slug>.md`. The file name must be the slug plus `.md`
   (for example `rome-with-a-friend.md`) and the `slug:` line inside must be the same word.
2. Fill in every line at the top (between the two `---` lines). The numbers are euro, per person.
   Below the second `---` write your story in Markdown (`## Heading`, `**bold**`, `- list`).
3. Add photos (see the next part). Every photo needs `alt:` (one sentence describing it, for blind visitors and Google).
4. Look at it on your computer: `npm run dev`, then open http://localhost:3000/trips. Drafts show up there with a
   "Draft, development only" label.
5. To publish: change `draft: true` to `draft: false` (or delete the line), run `npm run build`, commit and push.
   The live site only changes after you push, because the files are part of the website.

If a line is missing or misspelled, `npm run build` stops and tells you which file and which field, for example
`content/trips/rome.md: field "nights" is missing`. Nothing broken can go live.

The lines of a trip file:

| Line | Needed? | What it is |
| --- | --- | --- |
| `title`, `slug`, `date`, `country` | yes | name of the page, the web address word, `YYYY-MM-DD`, the country |
| `nights` | yes | number of nights (1 or more) |
| `days` | no | number of days; if left out it is nights + 1 |
| `travellers` | yes | for example `solo` or `with a friend` |
| `origin` | yes | 3-letter airport code you flew from, for example `KSC` |
| `airline` | yes | the airline you flew with |
| `flightPricePerPerson` | yes | euro, both ways, per person |
| `accommodationPerNight`, `foodPerDay`, `transportPerDay` | yes | euro per night / per day |
| `otherPerDay` | no | euro per day for tickets, tours, souvenirs |
| `destination` | no | one of the 12 destination words (rome, milan, ...). Turns on the "compare with our estimate" box and the flight search buttons |
| `description` | no | one sentence for Google and link previews (max 200 characters) |
| `tips`, `mistakes` | no | lists: "tips" and "what I would do differently" |
| `cover` | no | `src` (file name) and `alt` (description) |
| `photos` | no | list of `src`, `alt` (required), `caption` (optional) |
| `draft` | no | `true` hides it on the live site. Default is `false` |
| `language` | no | `en`, `sk`, `de` ... (default `en`) |

How the total is counted, so your numbers are easy to check:

- accommodation = price per night × nights
- food, transport and other = price per day × days
- total = flight + accommodation + food + transport + other, per person

The "Compare with our estimate" box on a trip page only shows a row when both your number and our estimate exist.
Nothing is guessed or filled in.

### How to add a new guide

Copy `content/_templates/guide.md` to `content/guides/<your-slug>.md`, fill in the lines (`title`, `slug`,
`description`, `date` are needed; `tags`, `relatedDestinations`, `cover`, `draft`, `language` are optional) and write the
article below the second `---`. Publishing works the same way as for trips. The `relatedDestinations` list adds a block
under the article with each destination's cheapest cached fare and a link to search flights.

### Photos for trips and guides

Your own photos go in `public/trips/<slug>/` (for guides `public/guides/<slug>/`). Phone photos are big and carry
hidden information, including **the GPS place where you took them**. The script below makes them website-sized and
removes that hidden information. Steps:

1. Create the folder `photos-inbox/<slug>/` and copy your original photos into it. This folder is ignored by git,
   so the originals are never uploaded.
2. Run `npm run optimize-photos -- <slug>` (for a guide add `--kind=guides`).
3. The ready photos (WebP, longest side 2000 px) appear in `public/trips/<slug>/`, and the script prints the lines to
   paste into your file under `photos:`. Replace each `TODO` alt text with a real description.
4. Anytime you want to double-check a folder: `npm run optimize-photos -- <slug> --check` says if any photo still contains
   location data.

If a photo listed in a file is missing in the folder, or has no `alt`, `npm run build` fails and names it.

Checklist before you publish a trip:

- [ ] No recognisable faces of other people without their consent (crop, blur or choose another photo).
- [ ] No car number plates, boarding passes, tickets, passport pages or the address of where you sleep.
- [ ] Every photo has a real description (`alt`).
- [ ] You ran `npm run optimize-photos` (no GPS data) and `npm run build` passes.
- [ ] The photos are yours, or you have permission to use them.

### Other things in this section

- The About page (`/about`) has marked TODO boxes where **you** write about yourself. While a TODO remains, the page is
  hidden from search engines and left out of the sitemap. Once it is written, delete the boxes and set `ABOUT_HAS_TODO` to `false` in `app/lib/aboutStatus.ts`: the page then appears in search engines and the sitemap.
- `/disclosure` explains that some flight links are affiliate links. A short note is also in the footer.
- Good to know: a draft page is hidden on the live site, but its photo files in `public/` can still be opened by someone who
  knows the exact web address. Do not put photos there that you would not show publicly.
- `/sitemap.xml` and `/robots.txt` are generated; they list only published (not draft) trips and guides.

## Where things are

See `AGENTS.md` for the map of the code, and `PROGRESS.md` for what was changed and why.
