---
# TRIP TEMPLATE. Copy this file to content/trips/<your-slug>.md and fill in every line.
# The file name must be the slug plus ".md" (for example rome-with-a-friend.md).
# Lines starting with # are notes and can be deleted.

title: "Your title"
slug: your-slug                  # lowercase letters, numbers, dashes; same as the file name
date: 2026-03-14                 # YYYY-MM-DD (when you went, or when you wrote it)
destination: rome                # optional; one of: rome, milan, barcelona, athens, paris, london, berlin, amsterdam, lisbon, warsaw, krakow, madrid. Switches on the "compare with our estimate" box
country: Italy
nights: 4
days: 5                          # optional; leave out to use nights + 1
travellers: solo                 # for example: solo, with a friend
origin: KSC                      # 3-letter airport code you flew from
airline: Ryanair
flightPricePerPerson: 0          # euro, both ways, per person
accommodationPerNight: 0         # euro per night, per person
foodPerDay: 0                    # euro per day
transportPerDay: 0               # euro per day
otherPerDay: 0                   # optional; euro per day (tickets, tours, souvenirs ...)
description: "One sentence for search engines and link previews (optional, max 200 characters)."
tips:
  - "A tip that helped you."
mistakes:
  - "Something you would do differently."
cover:                           # optional; the file is in public/trips/<slug>/
  src: cover.webp
  alt: "One sentence describing the cover photo"
photos:                          # optional; every photo needs a description (alt); caption is optional
  - src: 01-street.webp
    alt: "One sentence describing the photo"
    caption: "Optional caption"
draft: true                      # true = hidden on the live site. Change to false (or delete the line) to publish
language: en                     # two-letter code: en, sk, de ...
---

Write your story here in Markdown. Use ## for section headings.
