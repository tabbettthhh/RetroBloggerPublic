# My Corner

Your own little social media in four eras of computing: an XP home feed, an old-iPhone leather journal with passport stamps, a retro Mac atlas, a retro Android guestbook, and a full XP desktop on bigger screens.

Every post is a plain Markdown file in a Cloudflare R2 bucket that you own. The website is only a skin that reads those files, so you can redesign it, move it, or download everything as a zip at any time. You name the site yourself in the back office.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tabbettthhh/RetroBloggerPublic)

New here? [Get your own](#get-your-own-about-20-minutes-no-coding) takes about 20 minutes and no coding, and an AI assistant can walk you through it.


## How this was made

Designed by me and partly vibe coded with Claude (Anthropic's AI).


## Get your own (about 20 minutes, no coding)

You don't need to know anything about code. You'll click through two websites, copy two things from one to the other, and that's it. If you get stuck, an AI assistant can talk you through it: see [Get an AI to help](#get-an-ai-to-help) below.

**You'll need:**

- a free [Cloudflare](https://dash.cloudflare.com/sign-up) account (this is where your site lives);
- a free [GitHub](https://github.com/signup) account (or [GitLab](https://gitlab.com/users/sign_up)). The button copies the site's public template into it, and Cloudflare updates your site from that copy. You'll never need to open it or touch the code, but Cloudflare's button can't work without one;
- your email address.

### Step 1: put your site online (one button)

1. Click this button: [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tabbettthhh/RetroBloggerPublic)
2. Sign in to Cloudflare, and connect your GitHub (or GitLab) account when it asks. That's only so Cloudflare has somewhere to keep your copy.
3. You'll see one page of settings. Keep the suggested names. Four settings (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAIL` and `CONTACT_EMAIL`) want a value: type `none` in each, or leave it if it already says `none`. Step 2 fills them in properly. Then press the button at the bottom to deploy.
4. Wait a minute or two. When it says it's done, open the address it gives you, something like `https://my-corner.yourname.workers.dev`. You'll see your site's welcome screen.

If Cloudflare asks you to turn on **R2** (where your posts and photos are kept), say yes. It may ask for a card even though a personal site stays well inside the free allowance (10 GB). You won't be charged for normal use.

### Step 2: lock your back office (about ten minutes)

The back office, at `/admin` on your site, is where you write posts and change everything. Until you lock it, it's shut for everyone, including you.

**Easiest way:** open your site, add `/admin` to the end of the address, and follow the steps on that page. It fills in your own site's address for you, and gives you a ready-made message for an AI helper.

Or follow the same steps here:

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Zero Trust**. The first time, choose a team name (for example `mycorner`) and the **Free** plan. Your **team domain** is then `mycorner.cloudflareaccess.com`.
2. Go to **Access controls › Applications** (older dashboards say **Access › Applications**). Create a **Self-hosted** application called `Back office`.
3. Add your site's address with the path `admin`. Then add the same address again with the path `admin/*`. (If the form splits the address in two, for `my-corner.yourname.workers.dev` the subdomain is `my-corner` and the domain is `yourname.workers.dev`.)
4. Add a policy: **Allow**, include **Emails**, and type your own email address. Save.
5. Open the application again and copy its **Application Audience (AUD) Tag** (a long string of letters and numbers).
6. Go to **Workers & Pages**, open your site, then **Settings › Variables and Secrets**. Change the four settings that say `none`:
   - `ACCESS_TEAM_DOMAIN`: your team domain, like `mycorner.cloudflareaccess.com`
   - `ACCESS_AUD`: the tag you copied
   - `ADMIN_EMAIL`: your email (only this email gets in)
   - `CONTACT_EMAIL`: your email, which the map's place search asks for (or leave it as `none`)

   Save, and deploy when it asks.
7. Open `/admin` again. Cloudflare emails you a code; type it in and you're in.

These settings live only in your Cloudflare account, never in the code. Your site also double-checks Cloudflare's signature on every back-office request.

### Step 3: make it yours

In the back office:

- **Site & wishlist:** set your site's name and your own name. The site name appears on the welcome screen, every title bar, the browser tab and the home-screen app.
- **Themes:** pick one of twenty-nine looks for the whole site, or make your own colours, wallpaper, stickers and mouse pointer.
- **Designs:** the visa in your passport and the keepsakes are examples you can swap (see [Designs you can swap](#designs-you-can-swap)).
- **Posts › Add example posts:** fills the site with samples so you can see every page. Delete them whenever you like.

### Step 4: keep AI crawlers out

In the Cloudflare dashboard, open **AI Crawl Control** and block the AI crawlers it lists. Your site already asks them to stay away; this makes it a firm block for the ones that say who they are.

### Your own domain (optional)

Your site starts at an address like `my-corner.yourname.workers.dev`. You can give it a domain of your own, like `myname.com`, now or at any time later. Nothing is lost either way: your posts stay where they are, and the old address keeps working.

**1. Get the domain into Cloudflare.**

- **Easiest: buy it from Cloudflare.** In the dashboard, go to **Domains** and buy one there (Cloudflare Registrar sells domains at cost). It's ready to use straight away, with nothing to set up.
- **Bought it somewhere else** (GoDaddy, Namecheap, IONOS, 123 Reg…)? Add it to Cloudflare: **Domains › Onboard a domain**, type the domain, and pick the **Free** plan. Cloudflare then gives you two "nameservers". Log in where you bought the domain, find its nameserver setting, and replace what's there with Cloudflare's two. If that site has **DNSSEC** switched on, switch it off first. Cloudflare emails you when the domain is active, usually within an hour (sometimes up to a day). If you use email on that domain, check Cloudflare kept your email (MX) records when it scanned them.

**2. Point it at your site.** Go to **Workers & Pages**, open your site, then **Settings › Domains & Routes › Add › Custom Domain**. Add `myname.com`, then add `www.myname.com` the same way. Cloudflare sets up the address and its padlock (https) for you; give it a few minutes.

**3. Let the back office open there.** In **Zero Trust › Access controls › Applications**, open `Back office` and add your domain with the path `admin`, and again with `admin/*`. Keep the workers.dev entries too.

**4. Tell your site its new address.** Open `https://myname.com/admin` and go to **Friends**. It asks **Has your site moved?**: tap **Move my site to myname.com**. (If it doesn't ask, look under **My site's address**: if it already shows `https://myname.com`, you're set. If not, type it there.) Now:

- visitors who go to your old workers.dev address, or to `www.myname.com`, are sent to `myname.com`, so old links and bookmarks still work;
- friends' sites are told and follow you (if any couldn't be reached, Friends says so and **Tell them again** retries);
- the back office still opens at the old address as well, so you can't lock yourself out.

**Setting up for the first time with a domain you already have?** Do step 1 here, then **Step 1: put your site online** above as normal (it starts on workers.dev), then steps 2 to 4 here. In **Step 2: lock your back office**, put your own domain in the `Back office` application as well as the workers.dev address.

Leave the workers.dev address switched on. It costs nothing, and it's what keeps old links working and lets friends who haven't heard you've moved still reach you.

### Getting updates

Your site keeps itself up to date with the template it was made from. Every night, a small job called **Update my site** brings in the latest version, keeping your own settings (your site's name, your storage and your address). Cloudflare then puts it live, as it does for any change. Your posts, photos and theme live in your Cloudflare storage, so an update never touches them. To update straight away, open your site's repository on GitHub, go to **Actions › Update my site** and press **Run workflow**.

**Made your site before updates were added?** Your copy doesn't have the job yet. Add it once, and it looks after itself from then on:

1. Open your site's repository on GitHub (the one the Deploy button made for you).
2. Press **Add file › Create new file**. For the name, type `.github/workflows/update.yml` (the slashes make the folders).
3. Open [the job in the template](https://github.com/tabbettthhh/RetroBloggerPublic/blob/main/.github/workflows/update.yml), press the **Copy raw file** button (two overlapping squares), and paste it into your new file.
4. Press **Commit changes…**, then **Commit changes** again.
5. Go to **Actions** (at the top). If GitHub asks, press the green button to turn workflows on. Pick **Update my site** and press **Run workflow**. A minute later your site is up to date, and Cloudflare puts it live a minute or two after that.

If it stops with a message about permission, go to **Settings › Actions › General**, choose **Read and write permissions** under "Workflow permissions", save, and run it again.

Changed a file by hand and want to keep your version? List it in a file called `.keep-mine` (one file or folder per line), and updates leave it alone.

### If something goes wrong

When the back office won't open, the page you see says why, in plain words, and what to fix. The usual ones:

| The page says | What to do |
| --- | --- |
| Your site is online. One more step! | The lock isn't set up yet: follow step 2. |
| This address didn't go through the Cloudflare sign-in | The Access application doesn't cover this exact address. Check it has both `admin` and `admin/*` for the address you're using. |
| Couldn't check your sign-in with Cloudflare | `ACCESS_TEAM_DOMAIN` is mistyped. It should look like `yourteam.cloudflareaccess.com`. |
| This sign-in is for a different application | Copy the AUD tag again into `ACCESS_AUD`, and deploy. |
| Signed in, but not as the owner | You signed in with a different email from `ADMIN_EMAIL`. |
| (your new domain) "This site can't be reached" or a security warning | The domain isn't active on Cloudflare yet, or the Custom Domain was added moments ago. Wait an hour and try again. |
| "Your site doesn't answer at … yet" (when moving) | Add the domain as a Custom Domain first (step 2 of "Your own domain"), wait a few minutes, then move. |

After changing a setting, remember to **deploy** (Cloudflare asks when you save).

### Get an AI to help

Paste this into an AI assistant (Claude, ChatGPT, Gemini…) and it will guide you one step at a time. Put your site's address in place of `YOUR-SITE-ADDRESS`. (The back office page in step 2 gives you this message with your address already filled in.)

```text
I've just put my own website online with Cloudflare, using the open-source "My Corner" blog
(https://github.com/tabbettthhh/RetroBloggerPublic). Its address is https://YOUR-SITE-ADDRESS.
I'm not technical, so please guide me one small step at a time and wait for me to say
"done" before the next one.

The goal: lock the back office (the /admin part of my site) so only I can get in, using
Cloudflare Zero Trust Access (free plan). The rest of the site stays public. The project's
README, "Get your own" section, has the steps.

Cloudflare changes its menus now and then, so please check the current documentation:
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/

What needs doing:
1. In the Cloudflare dashboard open Zero Trust. If it asks, choose a team name and the
   Free plan. Note the team domain (like myteam.cloudflareaccess.com).
2. Create a self-hosted Access application named "Back office" for my site's address with
   the path admin, and add the same address again with the path admin/* (two entries).
3. Give it an Allow policy that includes only my own email address, and sign in with a
   one-time PIN sent by email.
4. Copy the application's Application Audience (AUD) Tag.
5. In Workers & Pages, open my site (the Worker), then Settings > Variables and Secrets,
   and set: ACCESS_TEAM_DOMAIN = my team domain; ACCESS_AUD = the AUD tag;
   ADMIN_EMAIL = my email (or none); CONTACT_EMAIL = my email (or none). Save and deploy.
6. Visit my site's address with /admin on the end. Cloudflare should email me a code; once
   I'm in, we're done. If the page says the back office is locked, it explains why: help
   me fix what it says.

Please never ask me to paste passwords, one-time codes or API tokens into this chat.
The team domain, AUD tag and my site address are fine to share.
```

Moving to your own domain? Paste this one instead:

```text
I run my own website with Cloudflare, using the open-source "My Corner" blog
(https://github.com/tabbettthhh/RetroBloggerPublic). It's at https://YOUR-SITE-ADDRESS and I want it
to live at my own domain, YOUR-DOMAIN (bought from: WHERE YOU BOUGHT IT). I'm not technical,
so please guide me one small step at a time and wait for me to say "done" before the next.
Please check Cloudflare's current documentation as we go, because menus change:
- https://developers.cloudflare.com/fundamentals/manage-domains/add-site/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

What needs doing (the project's README, "Your own domain", has the details):
1. If the domain isn't on Cloudflare yet, add it (Free plan) and change its nameservers where
   I bought it. If DNSSEC is on there, turn it off first. Wait until Cloudflare says active.
2. Add YOUR-DOMAIN and www.YOUR-DOMAIN as Custom Domains on my site's Worker
   (Workers & Pages > my site > Settings > Domains & Routes).
3. In Zero Trust, open my "Back office" Access application and add YOUR-DOMAIN with the path
   admin, and again with admin/*. Keep the existing entries.
4. Open https://YOUR-DOMAIN/admin, go to Friends, and tap "Move my site to YOUR-DOMAIN".
Leave the workers.dev address switched on: the site forwards visitors from it.

Please never ask me to paste passwords, one-time codes or API tokens into this chat.
```

If your AI assistant can use a web browser for you (some can), it can click through the Cloudflare dashboard while you watch. Sign in yourself, and don't give it your password.

---

## Posting

**From your phone:** open `/admin`, tap **New post**, pick Thought, Place, Photos, List or Quote, and publish. For places, search or tap **Near me**; the map position, city, country and that day's weather are filled in for you. Photos are shrunk to a 2000s-digicam size (1600px on the long side, about half a megabyte each) and stripped of all hidden data before upload. Tap **Filter…** under a photo to give it a look (Digicam '05 with an orange date stamp, Disposable, Grunge, Flip phone, Black & white, Instant, Lomo or Sepia), with a live preview; **Use on all new photos** applies the same one to the rest. Add `/admin` to your home screen and posting is one tap. If an iPhone washes out the top bar when the site or the back office is opened from the home screen (it puts its clock over the page and fades out what's beneath), choose more **Room at the top** in **Site & wishlist** › **On a phone's Home Screen**: a little more, more or lots more. It only changes things when opened from the home screen.

**A font of its own:** under **Font for this post**, pick any of the fonts (handwritten, pixel, typewriter, elegant and the rest) and the writing box shows it as you type. That post is written in it everywhere it appears: the feed, its own page, the places journal and reviews. Left on the site's font, it follows your theme. In a file, it's `font: handwritten`.

**From Obsidian or an AI:** a post is just a Markdown file. Paste one of these into an AI with your notes and ask it to "turn this into a post in exactly this format", then upload the file under **Export & files > Import posts**.

A thought:

```markdown
---
date: 2026-10-22 16:08
font: handwritten      # optional: this post's own font; leave it out to use the theme's
---
Whatever is on your mind.
```

A place:

```markdown
---
date: 2026-10-21 11:30
title: Example Café
area: Digbeth, Birmingham
city: Birmingham
country: United Kingdom
country_code: GB
lat: 52.4751
lon: -1.8840
category: coffee        # food, coffee, sights or nature
rating: 4
would_return: true
weather: 12°C, light rain
photos: [1.jpg, 2.jpg]
stamp: postmark       # optional: a country code or a design name; leave it out and one is picked for you
---
What you ordered, the vibe, who you went with.
```

Photo dumps, lists and quotes use `photos:`, `title:` and `source:` the same way. Only `date` is required; anything left out simply isn't shown.

Every photo from every post also lands in the **Photo album** (`#/album`): an old 90s magnetic album, newest first, a page or two per month, with the camera date in orange on each print. Tap a print to flick through the whole album in the picture viewer. Nothing to set up.

- **Schedule a post:** give it a future date and time. It appears on its own within five minutes.
- **Passport stamps:** every city you review gets a stamp in your passport. The first city in each country gets that country's own stamp; to choose a different one, press **Change stamp** when editing a place and pick any country's stamp or another design. From a journal entry, **Passport** opens at that city's stamp and **Map of everywhere** at that place's pin.
- **Pin a post:** tick **Pin it to the top** in the editor, or press **Pin** next to it in the Posts list (or add `pinned: true`). Pinned posts get a red pushpin and sit at the top of the feed, their section and their shelf.
- **Place categories:** Food, Coffee, Drinks, Shopping, Sights, Culture, Nature and Stays are built in. Make your own from a place's **Type** with **+ New category** (name and colour); they're kept in `categories.md` (`- Bookshops, #8a4f26`), work everywhere (map pins, atlas filters, journal) and can be recoloured or removed in Site settings. Floppy has things to say about each kind, and names your own ones.
- **Journals by year:** the Places Journal is one notebook per year. It opens on your newest place; **All my journals** shows the shelf of yearly notebooks (thicker the more places), each opening to a contents page listing that year's places newest first (this month at the top) with page numbers. Page 1 is always the latest place; Older › turns on back in time, and at the end leads to the previous year's notebook.
- **Journal scrapbook:** under the map (and photos) each place can have keepsakes stuck in: tick them under **Keepsakes in the journal** in the back office. A till receipt of what you ordered (`ordered:` list like `- Flat white — £3.40`), a shop receipt of what you bought (`bought:`), an entry ticket with a tear-off stub (`tickets:`, a list, or `true` for a plain "admit one") a little card travel ticket (`rides:`), an exhibition ticket (`gallery:`), a red-and-gold theatre ticket (`theatre:`), an invitation with a wax seal (`invite:`) a boarding pass to the place (`boarding:`, just the place and the day: no flight numbers, seats or booking codes), a cinema stub (`cinema:`), a cloakroom ticket (`cloakroom:`), a festival wristband (`wristband:`), a postcard that turns over when tapped, with your first photo on the front or a painted scene (`postcard_scene:` seaside, city, countryside, forest, mountains or lakeside; without a photo or a choice it picks one to suit the place) (`postcard:`), a fortune cookie slip (`fortune:`), a luggage tag (`luggage:`), a matchbook (`matchbook:`), a beer mat (`coaster:`), a hotel room key (`roomkey:`), a pressed flower (`flower:`), and for the outdoors a campsite pitch tag (`pitch:`), a torn trail map (`trailmap:`), a park pass (`parkpass:`), a woven patch (`patch:`), a summit sticker (`summit:`), a wooden signpost (`signpost:`), a leaf or feather (`leaf:`), a toasted marshmallow (`marshmallow:`), a tide times card (`tides:`) and a compass (`compass:`, with N, NE, SW… on the first line to set the needle); for concerts the wristband, a gig ticket (`gig:`), a setlist (`setlist:`), a guitar pick (`pick:`), a backstage pass (`backstage:`), a lighter in the air (`lighter:`), a hand stamp (`handstamp:`), a glow stick (`glowstick:` pink, green, blue, yellow, orange or purple), a gig flyer (`flyer:`), a tour T-shirt with the dates down the back (`tourtee:`), foam earplugs (`earplugs:`), a drumstick (`drumstick:`), a button badge (`buttonbadge:`), the seating plan with your seat circled (`seatplan:`) and a tin of throat sweets (`lozenge:`); for events a race bib (`racebib:`, a number on the first line), an order of service (`ceremony:`), confetti (`confetti:`), a party balloon (`balloon:`), a match ticket (`matchday:`), a fairground token (`funfair:`), a rosette (`rosette:` 1st red, 2nd blue, 3rd yellow), a "Hello, my name is" badge (`namebadge:`) and a sparkler (`sparkler:`); and for the stage and comedy 🎭 the comedy and tragedy masks (`masks:`), a theatre programme (`stageprog:`), a comedy night ticket (`comedyticket:`), a microphone (`mic:`), an interval ice cream (`interval:`, the flavour on the first line), opera glasses (`operaglasses:`), a curtain call (`curtain:`), a laugh-o-meter (`laughmeter:`, 0 to 10 on the first line) and the best line, in your own words (`joke:`). **Reliving a memory:** tick it on a thought or photo dump and say when it was (`memory: 2019`, `2019-07` or `2019-07-14`); it turns into an old, sepia-toned card with film grain, faded prints and a "Reliving a memory · July 2019 · 7 years ago" ribbon (bigger on its own page), and gets a **Memories** tab of keepsakes: film negatives of your photos (`negatives:`), an old print with the date on the back (`oldprint:`), a calendar page (`calendar:`), a home video tape (`vhstape:`), an old airmail letter postmarked that year (`envelope:`), then and now (`thennow:`) and a rewind button with a tape counter of the years (`rewind:`). Thoughts also get a **Sky** tab of Polaroids (`skysunrise`, `skygolden`, `skyrainbow`, `skystorm`, `skysnow`, `skystars`, `skymoon`, `skyaurora`, `skyclouds`, `skyfog`, `skyplane`, `skypink`, each with your caption), a **Gym** tab, shared with the journal (a workout stamp, `workout:` with cardio, hypertrophy, strength, mobility, HIIT, endurance, yoga, leg day or rest day on the first line; a gym pass, `gympass:`; a personal best, `personalbest:`; a dumbbell, `dumbbell:`; a step counter, `steps:`; a protein shaker, `shaker:`; heart rate, `heartrate:`; a training log, `setsheet:`; a finisher medal, `medal:`; a water bottle, `waterbottle:`) a **Study** tab (a flashcard, `flashcard:` question then answer; highlighted lines, `highlighter:`; page tabs, `pagetabs:`; a revision timetable, `timetable:`; an exam slip, `examslip:`; a pomodoro timer, `pomodoro:`; a desk lamp, `desklamp:`; a library pass, `librarypass:`; marked work with the grade in red pen, `grade:`; a case card, `casecard:` with "v" in the name; a mind map, `mindmap:`; a revision checklist, `revisionlist:`; a pencil, `pencil:`; a calculator, `calculator:`; a graduation cap, `gradcap:`; a certificate, `diploma:`; a study stopwatch, `stopwatch:`; lecture notes, `lecturenotes:`; a do-not-disturb sign, `doordnd:`; a reading list, `readinglist:`; books share the flashcard, highlighter, page tabs, case card and reading list), a **Work** tab (an ID badge, `idbadge:`; a time card, `timecard:` with "9:02 – 17:45"; a meeting invite, `meetinginvite:`; an out-of-office note, `outofoffice:`; a business card, `businesscard:`; an inbox count, `inboxzero:`; a laptop, `laptop:`; a briefcase, `briefcase:`; a desk name plate, `deskplate:`; a red stapler, `stapler:`; paperclips, `paperclips:`; a typed memo, `memo:`; working-from-home slippers, `wfh:`; a Friday stamp, `tgif:`; a deadline circled on the calendar, `deadline:`; employee of the month, `employeemonth:`) and a **Times of day** tab (an alarm clock, `alarmclock:`; rise and shine, `riseshine:`; first coffee, `firstcoffee:`; lunch break, `lunchbreak:`; tea time, `teatime:`; night owl, `nightowl:`; a sleep mask, `sleepmask:`; a red digital clock, `ledclock:`; a time like 6:30 on the first line sets the clocks, otherwise they show when you posted). Thoughts can have keepsakes along the bottom of their card: a polaroid of the sky as it was when you posted (`sky:`), a diary page (`diary:`), a mood ring (`moodring:` calm, happy, stormy, love, sad, excited, sleepy or curious), a doodle (`doodle:` heart, star, cloud, spiral, sun or flower), a paper fortune teller (`cootie:`), a weather report clipping (`forecast:`), a song scrap (`lyric:`), and the fortune slip, sticky note and matchbook. Books, films, TV, podcasts and music get keepsakes of their own, shown around the review: a bookmark (`bookmark:`), a library card stamped with due dates (`librarycard:`), a bookplate (`bookplate:`), a popcorn box (`popcorn:`), 3D glasses (`glasses3d:`), a video rental sticker (`rental:`), a TV guide clipping (`tvguide:`), a remote (`remote:`), headphones (`headphones:`) and a sticky note (`note:`), plus the cinema stub for films, the travel ticket for books and podcasts, and the shared concert, event and stage and comedy keepsakes. Music also gets an **Awards & charts** tab (all made-up designs, no real awards or chart brands): a framed disc award (`discaward:` silver, gold, platinum or diamond), a trophy (`trophy:`), a chart clipping (`chartno1:`, with the position it got to), an "And the winner is…" card (`winnercard:`), a golden microphone (`goldmic:`), a signed photo (`autograph:`), a fan club card (`fanclub:`), a jukebox title strip (`jukebox:`), a radio request (`radiorequest:`), a magazine review with your stars (`magreview:`), a year-on-repeat card (`yearonrepeat:`) and a 7-inch single in its sleeve (`sevenninch:`); podcasts share the trophy, chart, golden mic and year on repeat. In the back office they're folded away under **Keepsakes in the journal**, grouped into tabs. **Every keepsake is one shared pool:** a journal entry, a thought, a photo dump and every book, film, TV, podcast and music review can use any of them (a till receipt on a thought, a gig ticket on a book, a mood ring on a place), with the tabs made for that kind of post shown first and the rest after. Tickets, invitations and passes can be a list of lines or `true` for a plain one. Receipts add up the total when every line has a price. The map always comes first. Then photos and keepsakes take turns, the first one or two photos leading, and they follow the writing: in a long read they're spread evenly all the way through (in the page margins on a computer or tablet, between paragraphs on a phone); in a short one, whatever hasn't a place gathers together straight after the writing, then on scrapbook pages, always at its own size and never needing a scroll. Each is shown once. Floppy doodled in the margin saying one of your journal lines for that place (`floppy_journal:`, kept separate from his screensaver lines) or one of his own, and a paper-clipped "Also in <city>" note linking three of your other places there, picked at random. On a computer, iPad, tablet or unfolded foldable the journal is a thick open book (page edges pile up on the left the further in you are) and long entries carry on over more pages: turn with the curled corner, the arrow keys or a swipe, or drag the corner (or, on a tablet, the page) and the paper bends over the spine with your finger; later pages get the weather, Floppy, a postmark, photos or your stars tucked into the margin. Phones scroll one page. In the feed, very long posts fold with **Keep reading**. On tablets, reading columns stay a comfortable width.
- **Screensaver:** after two minutes idle on a computer (or from the Start menu), or from **Explore** on a phone (where it never starts by itself), bits of the site drift across a night sky with shiny 3D pipes growing behind: photos, book covers, film tickets, tapes, records, passport stamps, thoughts on sticky notes, quotes, lists, your status and the flight log, swapped one at a time and mixed so no one kind takes over. Floppy flies about too, poking things and saying something unhelpful about each. Any post can take `floppy:`, a line (or a list of lines, picked at random) for him to say about it (the folded **Floppy** section at the bottom of the post editor, with **+ Add another line**; places get a second tab for the journal margin); otherwise he picks from his lines for that kind of thing, which mention authors, artists, your best-rated episode and how far through a book you are. All his lines are in `public/js/floppy-lines.js` to change or add to. It's only downloaded the first time it's started, and it stops as soon as you tap, move the mouse, or the screen goes off.
- **Notifications:** the bell tab in the back office collects reader suggestions, guestbook signatures waiting for approval and nudges in one list, newest first, with a red badge (and the browser tab title) counting what is new since you last looked. Approve, add to a shelf or wishlist, or delete straight from there.
- **Status:** like an old messenger. In the back office (the **Status** tab, right after the bell) pick **Online, Away, Be right back, Out to lunch, Busy or Appear offline** (the dot changes colour), write a personal message with emoticons (`:)`, `:D`, `(storm)`, `(coffee)`… or tap them in the picker), and optionally add a **countdown** ("12 days until my birthday") that disappears once the day has passed. The bar also shows when you last changed it, and what you're listening to, watching and reading from the shelves (switch that off if you like). Every new status is kept in `status-log.md`, so visitors can tap your status to see earlier ones; delete lines there to remove them. Visitors can **Nudge** you: their screen shakes, and the back office shows how many nudges you've had (only a total is kept). When you post anything, tick **Update my status too** by the Publish button: a quick box opens with a status to start from ("Watching … (tv)", "Listening to … (music)", the first line of a thought) that's posted along with it; drafts and posts set for later leave the status alone.
- **Profile grid:** tapping your picture by your name opens your About page: your bio, then your photos as a grid in an XP "My Pictures" window (thumbnails or a list, counts at the top, XP's blue selection on hover). Put a post with photos on it with **To grid** in the back office's post list, or **Show it on my profile grid** in the editor (`profile: true`); it shows each post's first photo (or, for a post with several, the one you tap under **Thumbnail on the grid** in the editor, saved as `grid_photo: 2.jpg`), newest first, and tapping one opens the post.
- **Finding posts:** the back office's post list shows your ten newest, then folds the rest away by month (newest first); the search box above it finds posts by title, words, kind of post, place or who.
- **Photos:** tap any photo to open it in an XP-style picture viewer, with Previous / Next (or the arrow keys, or a swipe on a phone), best fit, actual size, zoom, rotate and a slide show.
- **Search:** visitors can search everything (posts, places, books, films, podcasts, music and the wishlist) from the magnifier in the top bar, the Mac menu bar, **Search** in the Explore menu, or by pressing `/` on a computer. It runs in their browser, so nothing they type is sent anywhere. Floppy, a little floppy disk, pops up on the search page with confidently unhelpful tips and gossip about your newest posts (with a **Show me** button that opens the post); tap him for another, or **Go away, Floppy** to hide him for the rest of the visit. His lines are in `public/js/helper.js` if you want to write your own.
- **Time of day:** the home screen's sky follows the visitor's clock, and the same light falls faintly on every other part too: soft in the morning, warmer at sunset, a lamp on at night.
- **Every wallpaper through the day:** every theme's wallpaper (and your own picture or emoji) takes the time of day too, like a phone's dynamic wallpaper: a warm morning, the day as it is, a golden evening, and night with stars and a moon. Dark mode always has the night. To keep one look all day, choose **Stays the same all day** in Themes › Wallpaper.
- **Quick on old phones:** feeds show twenty posts and add more as you scroll; the map, the picture viewer and the screensaver load the first time they're needed; phones with 2 GB of memory or less skip the paper blotches, the visa shimmer and the fade between sections.
- **Drafts:** add `draft: true`, or tick "Keep as a draft".
- **Nothing you write gets lost:** what you're typing in the back office is also kept in your browser as you go, so if the tab closes, the phone restarts or a save fails (no signal, or your sign-in ran out), **Carry on writing** brings it back next time (new photos need adding again). Opening another post asks first if the one you're on isn't saved.
- **Header mistakes:** the part between the `---` lines has to be read by the site. If something there can't be read (most often a colon inside a value, like `title: Rome: day one`; put such text in "double quotes"), the back office won't save it and says which line is wrong, so a post can never vanish from the site by accident. A file with a mistake that got into the bucket some other way opens as text with the problem shown.
- **Time zone:** post times are read as UK time, summer time included. Change `TIMEZONE` in `wrangler.jsonc` if you live elsewhere.

## Books, films, TV, podcasts and music

Five shelves, each in its own style: a wooden **Bookshelf**, a **Cinema** of ticket stubs, **TV** shows as video tapes in front of an old set, **Podcasts** on cassette tapes, and a **Record crate** of album sleeves and 7-inch singles. Covers are drawn by the site with the title only.

In the back office pick **Book**, **Film**, **Podcast** or **Music** under New post. Each has the maker (author, director, host or artist), the year, where you are with it (for example reading, read, want to read or put down), stars, a "Recommended" stamp and a favourite quote. Reviews with words also appear in the home feed; ones without stay on the shelf.

```markdown
---
date: 2026-10-12 21:30
title: The Lighthouse Almanac
author: Example Author        # director: / host: / artist:
year: 1998
status: read                  # reading, read, want, dropped (or watched, listening, on repeat…)
rating: 4                     # half stars like 3.5 are fine
recommend: true
quote: "Every light is a promise that someone stayed awake."
---
Your review.
```

Music also takes `format: album` or `format: song`, and `album:` for a song. Podcasts can take `episode:`. Books can take `pages:` (how long it is) and `page:` (where you're up to), shown as a progress bar on the cover and the review, and a reading log under `reading_log:` (each with `date`, `from`, `to`, and optional `chapter` and `note`); in the back office, tap **+ Log reading**. TV shows use `creator:`, and can take `season:`, `episode:` (the episode you're up to) and `network:` (where you watched it). They can also keep an episode diary, shown as an episode guide under the review; in the back office, tap **+ Log an episode** (or **+ Log a binge** for several at once), or write it by hand:

```yaml
episodes:
  - season: 2
    ep: 3
    title: Handover
    rating: 4
    date: 2026-10-19
    note: The cliffhanger!
  - season: 2
    ep: 4
    to: 7        # a binge: episodes 4 to 7 in one go
    rating: 5
```

Write `[book]`, `[film]`, `[podcast]` or `[music]` in your status line (for example "reading [book]") and it fills in with whatever you've marked as reading, watching or listening to.

**Bringing your history:** under **Export & files** you can import a Goodreads export (the .csv) or a Letterboxd export (the .zip). Only titles, authors, years, dates, ratings, shelves and your own reviews are used. Goodreads private notes, Letterboxd profile and account details, and links back to either site are left out. Anything already on your shelf is skipped.

## Comments

Visitors can comment on any post, or reply to someone else's comment, with just a name: any name they like, so they can stay anonymous. Nothing else about them is asked for or kept. On a post's own page the comments sit under it with a form to leave one; places in the journal and reviews on the shelves have a **Comments** button that opens them in a little window; and each card in the feed shows how many comments it has.

Every comment waits in the back office (the **Comments** tab, and your notifications) until you **Approve** it. Once it's on the site you can **reply**: your reply shows under their comment, marked as yours. **Delete** removes one. Untick **Let visitors comment on posts** to hide them all and stop new ones (nothing is deleted). Deleting a post deletes its comments too, and comments never go to friends' sites. The same bot protection as the guestbook applies.

## Guestbook and suggestions

Visitors can sign the guestbook and suggest a place (on the wishlist page), a book, a film, a podcast or music (on each shelf). Nothing they write appears until you approve it under **Guestbook** or **Suggestions** in the back office, so spam never reaches the site. Add a suggested place to your wishlist, or a suggested book, film, podcast or album straight onto its shelf as "want to…". The visitor's name goes on a **Suggested by** stamp when you review it; for places, the editor offers to add the stamp when the place is on your wishlist.

## Friends

If friends run their own copy of this site, you can follow each other. Under **Friends** in the back office:

1. Tap **My friend code** and send it to anyone you want as a friend (a message, an email). It stays the same and never runs out, so you can give it to as many friends as you like. **Make a new code** swaps it (the old one stops working; friends you have stay friends) and **Switch it off** stops anyone new adding you.
2. They paste it under **Add a friend** on their site. That's it: your two sites now follow each other.

Your site then gets a **Friends** tab next to Home: your friends' posts as one feed you can scroll, newest first, with your friends listed at the top (tap one to see only theirs). Each post looks just as it does on your friend's own site: the post card they chose (one design for every post, the one it drew from their mix, or a card they made themselves, in their colours), its keepsakes (their own designs too), a memory's ribbon, its font, ratings and photos, with who it's from along the top and a link to see it on their site. Everything is checked by your own site first, so a friend's post can never run anything or reach outside it. (A friend whose site hasn't been updated yet shows as a simpler card until it is.) The back office lists your friends with how they are (online, away, busy…) and their status, and new posts from friends show in your notifications. When you post (or edit, delete or change your status), your site tells your friends' sites straight away, so it shows on theirs within moments. A post scheduled for later is shared when it goes live. Your site also checks theirs every 10 minutes, in case one was offline, or straight away when you tap **Check now**. A page that's already open (like the site saved to a phone's home screen) picks up new posts when you come back to it.

It's following only, with no messages. Only published posts are shared: drafts and posts scheduled for later stay private. Every friendship gets its own secret, known only to those two sites, and every request between them is signed with it, so nobody else can read your friend feed or pretend to be your friend. Friends' photos come through your own site, so visitors' browsers never connect to theirs. Secrets and the copies of friends' posts are kept apart from your files and are never in the export. **Remove buddy** unfollows both ways.

**Who sees your friends** is up to you, under **Who sees your friends on your site?**:

- **Everyone:** a Friends tab with their posts, and your friends list on your About page.
- **Just my friends list:** your friends' names on your About page, linking to their sites. Their posts stay in your back office.
- **Only me:** nothing about your friends on your site. You still see everything in the back office.

Your friends get a say too. Untick **Let friends show my posts on their sites** and your posts never appear on a friend's site for their visitors (your friends still see them in their own back office). Their sites hear about it straight away.

**Your site's address.** Friends know your site by one address: the one you were using the first time you opened Friends (it's under **My site's address**, and it's the address inside your friend code). Opening the back office from another address doesn't change it. It's also your site's main address: visitors who arrive at your workers.dev address, or at the www version of your domain, are sent there.

When your site moves to a domain of your own, follow [Your own domain](#your-own-domain-optional). Its last step, **Move my site to …** under Friends, tells each friend's site. Each one checks that your site really is at the new address, then switches over. Your old address keeps working for them as well, so nothing breaks. If a friend's site can't be reached just then, Friends says so, and **Tell them again** tries later. Friend codes you'd sent out before still work.

## Travel stats (optional)

Fill in your totals under **Travel stats** in the back office and a boarding-pass page plus a "flight log" visa in your passport appear. They're saved as `travel.md`, a Markdown file like everything else:

```markdown
---
flights: 64
distance_km: 118400
hours: 172
airports: 23
countries: 14
per_year:
  2025: 19
  2026: 9
top_airlines: [British Airways, easyJet]
top_aircraft: [Airbus A320]
---
An optional note, shown under the boarding pass.
```

**Countries you've been to:** list them under **Travel stats › Countries you've been to** (or as `visited:` in `travel.md`) and each one gets a stamp in your passport, at its capital unless you name another city. Add a month to print a date on the stamp.

```markdown
visited:
  - country: GB
    city: London
  - country: FR        # no city: the capital is used
    date: 2019-07      # optional
```

Add `hidden: true` (or tick the box in the back office) to hide the stats for a while, or press **Remove** to delete them. Keep it to totals: never flight numbers, booking codes, seats or exact times.

## Designs you can swap

The visa and the keepsakes that come with the site are examples. Under **Designs** in the back office you can make them yours, and the settings are saved as two small files like everything else:

- `passport.md` holds the visa: `design:` (central, classic, mountains, seaside, city or botanical; without it, the original), `ink:`, `accent:` and `highlight:` colours (`"#2a4b8d"`), `strip:` (kilim, waves, checks, stripes or none), `emblem:` (globe, compass, star, plane, leaf or none), `words:` (a list of "visa" in other languages), and `picture:` (a picture you uploaded, which takes the place of the drawn scene).
- `keepsakes.md` holds `hidden:`, the built-in keepsakes you've switched off (they leave the editor; a post that already has one keeps it), and `custom:`, keepsakes you've designed: a name, a shape (ticket, card, tag, badge, sticker, note, or just your picture), paper, ink and accent colours, a heading, an optional picture (a scan of a real ticket, a drawing, a cut-out), which kinds of post it can go on, the editor tab it sits in, and whether its lines have prices. A post sticks them in under `custom_keepsakes:` (`{ferry-ticket: [Return — £8.50]}`); if you delete a design, posts keep their lines but it no longer shows.

Pictures for designs live in the `design/` folder and are cleaned of hidden data like every photo.

## Themes

Under **Themes** in the back office you can dress the whole site in your own style. The layout stays exactly the same; the colours, wallpaper, little charms and even the mouse pointer change. Thirty-four come with the site, in four groups that fold away so the list stays short (only the group with your current theme is open; tap another to unfold it). Cute and colourful: **Classic** (the original blue skies), **Bunny Hop**, **Matcha**, **Y2K Chrome**, **Night Arcade**, **Lemonade**, **Cherry Soda**, **Cloud Nine**, **Froggy Pond**, **Boba**, **Peach Fizz** and **Moonlit**. Bold and loud, nothing minimal: **Neon Boulevard** (pink neon, palm trees and a striped 80s sunset over a glowing grid), **Empire** (emerald stripes, gold laurel wreaths and ivory), **Rococo** (sugared pastels, gilt scrolls, pearls and a hand fan), **Disco Inferno** (a mirror-ball wallpaper, magenta and gold, confetti falling), **Pop Art** (comic dots and POW! bursts in primary colours), **Memphis Party** (squiggles, zigzags and clashing shapes), **Wild Thing** (leopard print, hot pink and a kiss), **Velvet Opera** (crimson velvet, gold damask and a chandelier), **Block World** (a blocky landscape of grass, dirt and stone under pixel clouds, with a pickaxe) and **Big Top** (circus tent stripes, bunting and showtime). Each comes with its own fonts, name style and effects to match, and every part can still be changed. The four seasons, each with its own wallpaper, and its season settling on the bars, the posts and the desktop: **Winter Frost** (snowy hills and fir trees, snow falling), **Spring Bloom** (blossom branches, bees and a row of tulips, petals falling), **Summer Days** (sun, sea and sand, gulls and an ice lolly) and **Autumn Leaves** (maple leaves, acorns and a leaf pile with a pumpkin, leaves falling), plus **Through the year**, which wears whichever season it is and changes by itself (the other way round if you've set the seasons to south of the equator). Calm and neutral: **Graphite**, **Paper**, **Slate**, **Sand**, **Olive**, **Navy** and **Mono**, with plain wallpapers (plain, dots, pinstripes, graph paper, linen, contour lines, grain), simple charms (dot, ring, diamond, plus, asterisk, chevron), a plain pointer in the theme's colours, and modern, system, monospace and condensed fonts. Your real site is previewed beside them, on a phone or a computer, and nothing changes for visitors until you save.

**Make it your own** changes any part of a theme: three colours (main, accent and background, plus the journal's leather), a wallpaper (the sky that follows the time of day, a pattern, or your own picture), a charm on every title bar, and the charm that rides along on the mouse pointer. Every other shade on the site is worked out from your colours, so a theme you make yourself always matches, and words on a pale colour turn dark so they stay easy to read. Visitors can still switch to dark mode.

**Emoji wallpaper:** pick **Emoji** as the wallpaper, choose up to three emoji (from your keyboard or the suggestions) and a layout (neat rows, scattered, or big and small), and they repeat across the background, like a phone's emoji wallpaper.

**Stickers:** add up to sixteen little extras, each an emoji or one of the drawings (a bunny friend, a rainbow, twinkles, hearts and more), in places that suit them: the title bars, the bottom corners of the window, your profile picture, the corner of every post, next to the clock, or anywhere on the computer desktop (drag them into place). Pick a size and a tilt for each. They never get in the way of tapping or clicking.

**Every level, like a Rockbox theme.** Under **Make it your own**, each part of the theme has its own tab:

| Tab | What you can change |
| --- | --- |
| Colours | Main, accent and background colours, the journal's leather, and the highlight on menus (a solid bar, a gradient bar, a pointer, an outline, or inverted). **Colours from a picture** finds the colours in a photo you love (or your wallpaper) and offers four sets made from them; the picture never leaves your device |
| Wallpaper | The sky, a pattern, emoji, or your own picture |
| Fonts | The words and the titles: classic, rounded, bubbly, pixel, terminal, comic, handwritten, typewriter or elegant (titles can also be arcade or tiny pixel), and the text size |
| Bars & corners | Title bars glossy, flat, striped or in pixel steps; corners classic, square or round |
| Post cards | How every post's card is dressed: **Classic**, **Polaroid** (its date written along the bottom), **Scrapbook** (washi tape), **Notebook** (lined, with holes), **Postcard** (airmail border, stamp and postmark), **Sticky note**, **Ticket**, **Torn page**, **Comic panel**, **Neon**, **Letter** (with a wax seal), **Film frame**, **8-bit** and **Chrome glass**, all in the theme's colours. **Festive ribbons** go on posts written on a festive day you've ticked or one of your own days ("Posted on Diwali", in its colours and drawings), and **a mark in the corner** shows the season a post was written in, or the theme's charm. Any post can also have a design of its own and a ribbon of your own words (a folded banner, a corner sash, a rubber stamp, a neon sign or a round sticker), chosen under **Dress this post** when you write it. **Make a card** of your own (up to twelve) from parts: the paper (any colour; plain, lined, grid, dots, kraft, linen or halftone), its edge (a thin line, thick ink, dashed, double, airmail stripes, a glow, pixel steps or a torn bottom), the corners, a shadow, something on top (washi tape, a strip of tape, a pushpin, a paperclip, a stamp or a wax seal with your theme's charm, or sparkles), the heading (plain, a solid colour, halftone dots, stripes or blended in), the colours of each, a font and a little tilt, with a live preview. Yours are offered alongside the others, for every post or one. Or **mix them up at random**: each post draws one of the designs you tick (the site's and your own) and keeps it every time it's shown; **Shuffle** deals them out again, and a post dressed in a design of its own keeps that one. Whichever you choose, the seasons and festive days settle on every card: snow along the top in winter, and the season's or festive day's drawing by the date. In dark mode the papery designs (and cards of your own on pale paper) stay light, with their dates, links and Comment button drawn for the paper; a card of your own on dark paper does the same in light mode. |
| Feed | Posts as cards or as a list with lines, how close together they sit, and what's behind them: **Layered** (the usual: the theme's colours, its pattern or your emoji or picture, and the season's or festive day's drawings, with the posts frosted on top), the pattern faintly, the whole wallpaper, just the theme's colours, or plain white, showing softly, medium or strongly |
| Profile header | A banner, a card, minimal, or hidden; and which parts it shows (last post, status, now playing, countdown, Nudge button) |
| Menu | Which five sections are in the main bar, in what order, and which sections to leave out of the menus altogether |
| Taskbar & scrolling | The taskbar at the top or bottom on computers, whether it shows the clock and your status, and scroll bars usual, in the theme's colours, thin or hidden |
| Icons & sounds | Icons in full colour, soft, or black and white; sounds classic, soft, chiptune, bubbly, or off until a visitor turns them on |
| Charms & pointer | The charm on the title bars and the one on the mouse pointer |
| Effects | Your name in rainbow, glitter, glow, WordArt, outline or chrome letters; a pointer trail (sparkles, hearts, stars, bubbles, rainbow or pixel dust); and something gently falling over the page (snow, petals, hearts, stars, leaves, confetti, or bubbles rising) |
| Floppy | Floppy, the site's little helper, can dress for the seasons and festive days (a bobble hat and scarf in winter, a flower crown in spring, a sun hat and sunglasses in summer, a beret and umbrella in autumn, a festive hat at Christmas, a witch's hat at Halloween, and something for every festive day, holding the day's drawing), or wear an outfit you put together: a hat, glasses, something round his neck, something to hold (any drawing or emoji), the outfit's colour and his own. A picture shows him as he'll look |
| Words | Your own words on the buttons: rename any section (everywhere it shows: the menus, the desktop icons and the Explore menu) and the site's buttons (Explore, Others, Search, Leave, Nudge, Open in journal, Read the review, and the welcome screen's Visitor and Tap to come in). Leave a box empty to keep the usual words |
| Seasons & festive days | Gentle touches for the time of year, in every theme (see below). Pick a season or a festive day yourself, or choose **Automatic** and your site follows the date |
| Tab icon & after dark | The little picture on your browser tab and bookmarks (a drawing or any emoji), and another theme for after dark: from 7pm to 7am, wherever your visitor is, the site changes into that theme's colours, wallpaper, charm and pointer. Preview either in the editor |
| Apps | Each app's own look (see below) |
| Stickers | See above |
| Share | Download your theme as a file, install a friend's theme file, or swap theme codes |

**Each app's own look.** Under **Apps**, every app (the places journal, the passport, the atlas, the wishlist, the guestbook, the bookshelf, the cinema, podcasts, the record crate, TV and the photo album) has the same four choices: as the theme has it, its original era look, in the theme's colour, or a colour of its own. Some apps have settings only they have: the journal and passport's paper (aged, cream, crisp white, brown kraft, graph paper or dotted) and handwriting, the atlas's and journal's map (soft, black and white, old paper or night), and each app's **Font**: its own era lettering (the default), the theme's font, or any of the fonts. **Every app's font** sets them all at once. The journal and passport keep their handwriting under its own setting, and a post with a font of its own keeps it inside any app. **Show it** opens that app in the preview.

Each built-in theme comes with fonts and shapes that suit it, and you can change any of them. Switching to another theme keeps your stickers, emoji, menu, layout, effects, tab icon, after-dark, season and festive-day choices.

**Seasons and festive days.** Under **Seasons & festive days**, pick a season or a festive day yourself, or choose **Automatic** and your site follows the date (north or south of the equator). Everything is gentle and never gets in the way:

- **Winter:** a light snowfall; snow settling on the title bars of every app, on the desktop icons, along the taskbar and the foot of the desktop, and on each post; icicles under the phone's menu; a snowman in the window's corner.
- **Spring:** drifting petals; petals resting on the title bars, blossom on the icons, grass and flowers by the taskbar and on the desktop, a little garland under the menu.
- **Summer:** a warm glow with glints of sunshine; a golden sheen on the title bars, glints on the icons, a little sun peeking over some posts, bunting, and a meadow along the desktop.
- **Autumn:** falling leaves; leaves resting on the title bars, icons and some posts, leaf litter by the taskbar and piles on the desktop, and a garland of leaves under the phone's menu.

On a phone, every app's top bar gets the season (the bookshelf, cinema, record crate, album, guestbook and the rest, not only the plain windows), just below the clock and battery so it's never hidden behind them.

Festive days come from around the world. From East Asia: Lunar New Year, cherry blossom, Children's Day, the Dragon Boat Festival, Tanabata and the Mid-Autumn Festival. From South and Central Asia and the Middle East: Nowruz, Holi, Ramadan (just a quiet lantern), Eid al-Fitr, Eid al-Adha, Diwali and Yalda Night. From Latin America: Día de Reyes, Carnival and Día de Muertos. From Europe and beyond: St Patrick's Day, Easter, Midsummer, Bonfire Night, Halloween, Hanukkah and Christmas.

On Automatic, tick the ones you celebrate and each comes round on its days. Each one shows when it's next due, and **Change the date** sets your own dates for that year (when Eid is seen a day later where you are, say); other years keep the usual dates. Dates on lunar calendars come from published tables up to 2035 or from the browser's own calendars. Make **your own days** too: a birthday, an anniversary, a festival that isn't here yet, with a name, dates (every year), a drawing or any emoji, and something falling if you like.

The decorations are only the kind people put up at home: no places of worship, scripture, flags or emblems.

**Festive days and your own days settle across the site too**, in their own drawings and colours: along every app's title bar, on the desktop icons and posts, as a garland along the taskbar and under the phone's menu, and in a row at the foot of the desktop (on festive days these take the place of the season's).

**Your profile header and the apps' top bars dress up too.** While a season or festive day is on, bunting in its colours runs along the top of your profile header, and a few of its drawings sit beside "Last post" like stickers. Bunting also hangs under every app's top bar, with stickers on the bar's corner. Quiet days keep to a single small drawing and no bunting. Under **On the apps' top bars**, choose for each app (the windows, the journal, passport, atlas, wishlist, guestbook, bookshelf, cinema, podcasts, record crate, TV and photo album):

- **The day's drawings** (the usual, while a season or festive day is on);
- **Different ones every day**, picked at random from all the drawings;
- **My own**: up to three drawings or emoji of your choice, all year round;
- **Nothing**.

**Your profile header** is also one of the places a season can settle, so it can be ticked off like the others.

**Make every day your own.** Under **Your own touches, day by day**, pick any season or festive day and change:

- its drawings: any drawing or emoji, up to eight;
- what falls;
- where its drawings go: the window's corner, the title bars, your profile picture, every post, next to the clock, or anywhere on the desktop;
- where it settles: title bars, desktop icons, along the taskbar, the foot of the desktop, posts, or under the phone's menu.

**Seasonal glass** (an extra, if you like) puts a pane of glass over the places you tick: photos, thoughts, the journal, passport and atlas, the wishlist, the guestbook, and the covers on the shelves. In winter it's frost, in spring petals and a soft bloom, in summer a sun flare, in autumn raindrops and a fallen leaf, and on festive days sparkles with the day's drawing. Photos and covers get the whole pane; thoughts only the corners, so the words stay clear. Choose **With the season or festive day** or a style of its own (frost, petals, sun flare, raindrops, sparkles or plain glass, which then shows all year), and how strong it is.

**Surprise me** remixes every part of the theme at random. Colours come from a random scheme, so they still go together. The rest covers the wallpaper (emoji ones too), fonts, bars, corners, highlight, header, icons and sounds, and the optional extras: effects, tab icon, an after-dark look, the seasons or a festive day, glass, stickers, each app's look and font, and Floppy's outfit. Your menu, renamed words, hidden sections, own days and own picture stay as they are. Keep pressing until you love one; **Undo** steps back through them. **Undo** steps back one change at a time, and **Discard changes** goes back to what's on your site.

Moving effects stay still for visitors who've asked their device for less motion (and on low-powered phones), pause when the page isn't showing, and never catch a tap or a click.

The theme is saved as `theme.md`, so you can send it to a friend and they can drop it into their own copy:

```markdown
---
theme: bunny          # one of the themes above
main: "#3a8fb7"       # only the parts you changed
wallpaper: hearts
decoration: star      # the charm on the title bars
pointer: frog         # the charm on the pointer
stickers: [{"what": "🐰", "where": "corner-bl", "size": "l", "tilt": -8}]
font: rounded         # and any of the settings above, by name
name_style: glitter
falling: petals
tab_icon: "🐰"         # a drawing's name or one emoji
night_theme: moonlit  # another theme from 7pm to 7am
seasons: auto         # off, auto, a season (winter…) or a festive day (nowruz…)
glass: [photos, thoughts, books]   # seasonal glass, and where
glass_style: season                 # or winter, spring, summer, autumn, festive, gloss
looks: {"winter": {"charms": ["snowman", "⛄"], "where": ["corner-br", "title"], "settle": ["bars", "taskbar"]}}
floppy: {"dress": "auto"}           # or {"dress": "own", "own": {"hat": "crown", "held": "🎈"}}
festivals: [nowruz, eid_al_fitr, yalda]   # on Automatic, the festive days you celebrate
festival_dates: {"eid_al_fitr": {"from": "2027-03-10", "to": "2027-03-12"}}   # your dates, that year
labels: {"thoughts": "Diary", "explore": "Start"}   # your own words on the buttons
my_days: [{"name": "Mum's birthday", "from": "06-19", "to": "06-19", "what": "🎂", "falling": "confetti"}]
menu: ["home", "thoughts", "music", "friends"]
apps: {"journal": {"look": "custom", "colour": "#2f6f6a", "paper": "grid", "font": "theme"}, "books": {"font": "typewriter"}}
---
```

## Your data, always

- **Export:** **Export & files > Download everything** gives you every post, photo and setting in the same folders, however many photos there are. **Posts and settings only** is a tiny zip without the photos, handy as a regular backup. Both open straight in Obsidian.
- **Photos carry no hidden data:** every photo loses all of its metadata (location, camera, phone model, date taken, comments, colour profile, thumbnails) three times over: the back office re-draws it before upload, the server strips it again before storing it, and again every time the site shows it. Even a photo put straight into the bucket some other way reaches visitors clean. iPhone HEIC/HEIF photos work in any browser: Safari opens them itself, and other browsers download a small converter the first time one is added. Either way they are turned into clean JPEGs before upload; the server itself only stores JPEG, PNG, WebP and GIF, the formats it can clean.
- **Privacy:** no cookies, no trackers, no Google Fonts or CDNs. Fonts and the map library are served from your own site. Map tiles come from OpenStreetMap, which requires the small credit in the map corner.
- **Search engines and AI:** every response carries `X-Robots-Tag: noindex`, and `robots.txt` asks AI crawlers to stay out. These keep you out of search results and away from well-behaved bots, but the site itself is open to anyone with the link, so post nothing you'd mind a stranger reading.

## What's in the folder

| Folder | What it is |
| --- | --- |
| `public/` | The design: pages, styles, fonts, cursors, the map library. No posts live here. |
| `public/admin/` | The back office. Locked behind Cloudflare Access. |
| `src/` | The small server (a Cloudflare Worker) that reads your files and serves the site. |
| `content/` | The example posts, shelves and travel stats the back office can add for you. |
| `wrangler.jsonc` | The Worker name, the bucket name and the time zone. Nothing personal. |
| `scripts/` | Small tools: setting up, importing, and `update-from-template.mjs`, which brings a copy of the site up to date. |
| `.github/workflows/` | **Update my site**, the nightly job that keeps a copy up to date (see "Getting updates"). |

Everything visual lives in `public/css/`: `xp.css`, `leather.css`, `mac.css`, `android.css` and `desktop.css`, one file per era, plus `visa.css` and `keepsake-maker.css` for the designs you can swap. A redesign never touches your posts.

## For developers

```sh
npm install
echo "DEV_ADMIN=true" > .dev.vars   # opens /admin without a login, on localhost only
npm run seed:local                  # example posts into the local bucket
npm run dev                         # http://localhost:8787
```

`npm run deploy` publishes from your machine. After editing `content/`, run `npm run examples` to refresh the back office's example pack.

**Checks:** `npm test` runs the end-to-end checks in `tests/` against a fresh local copy of the site for each group: every kind of post saved, edited and re-saved in the back office without losing anything, photos (sideways, HEIC, twenty at once), the export zip, Goodreads imports, long journal entries split into pages, every page on a phone, a tablet and a desktop filled with awkward content, then with none, and two local sites becoming friends (port 8801 for the second). They need Playwright once: `npm i --no-save playwright && npx playwright install chromium`. `npm test -- admin journal` runs just those groups.

**Caching:** browsers keep the fonts, cursors, icons and map library (`public/fonts`, `cursors`, `icons`, `vendor`) for a month without asking again. If you change one of those files, give it a new name and update whatever points to it, or returning visitors keep the old one for a while. Pages, styles and scripts are checked on every visit, so changes to them show at once. Photos are kept by a visitor's browser for three hours at most, so a deleted photo is gone for everyone within three hours.

## Licence

MIT, see `LICENSE`. The fonts (SIL Open Font License) and Leaflet (BSD 2-Clause) keep their own licences, listed there too.
