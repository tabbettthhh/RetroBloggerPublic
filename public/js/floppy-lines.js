// Everything Floppy says. Add your own: one line per entry, inside the back-ticks.
// In the category lists, ${t} is the title, ${city} the city, and so on.

// Said anywhere, about nothing in particular.
export const GENERAL = [
  `It looks like you're searching. Have you tried already knowing where it is?`,
  `Tip: things are always in the last place you look.`,
  `I'd love to help, but I'm only 1.44 MB.`,
  `Did you mean: something else?`,
  `Have you tried turning the website off and on again?`,
  `Fun fact: I have no idea what is on this site.`,
  `Searching… searching… nope, that was a cloud.`,
  `Try typing with more confidence.`,
  `Please insert disk 2 of 47.`,
  `Remember to save your work! I won't, but you should.`,
  `Have you checked under the sofa?`,
  `Loading wisdom… 3%… about 4 years remaining.`,
  `Press Ctrl + Alt + Hope.`,
  `I've been defragmenting all day. I'm exhausted.`,
  `Pro tip: the search box works best when you type in it.`,
  `Would you like me to make this harder? [Yes] [Also yes]`,
  `I'm not lost, I'm just exploring the hard drive.`,
  `Have you considered asking a pigeon?`,
  `My horoscope says your answer is two clicks away. Or twelve.`,
  `Shh. I'm buffering.`,
  `If you find it, let me know. I stopped looking in 1998.`,
  `Everything here is stored on me. Kidding! I'm mostly empty.`,
  `Did you know? Some people look for things without a search box. Wild.`,
  `You can also try squinting at the screen.`,
  `I'm read-only today. Please don't ask me anything.`,
  `I'm not lazy, I'm in power-saving mode.`,
  `Brb, rebooting my personality.`,
  `Fun fact: the save icon is my cousin. We don't talk about it.`,
  `I'm 3.5 inches of pure confidence.`,
  `Is it warm in here, or is that the hard drive?`,
  `If you need me, I'll be in drive A:.`,
  `I put the "fun" in "non-functional".`,
  `Don't mind me, just spinning at 300 rpm.`,
  `I was going to tell you a secret, but I'm write-protected.`,
  `Have you tried blowing on it? Works for game cartridges.`,
  `My horoscope says: "Sector 7 is corrupted. Avoid ladders."`,
  `I've been formatted twice. I'm a stronger disk for it.`,
  `Error 404: helpful tip not found.`,
  `I'd high-five you, but I'm square.`,
  `Loading a joke… 99%… 99%… 99%…`,
  `My other disk is a zip drive.`,
  `Shh, I'm listening to the modem sing.`,
  `I don't crash. I take surprise naps.`,
  `You can't spell "floppy" without "flop". Hang on.`,
  `If you shake the screen I get dizzy. Please do it again.`,
  `I'm basically the cloud. A very small, very square, very offline cloud.`,
  `One day I'll be in a museum. Today I'm here, with you.`,
  `Do not feed the floppy after midnight. Or before.`,
  `Who moved my cursor?`,
  `I'm not square, I'm retro.`,
  `Let me check my notes. My notes say "disk".`,
  `Beep boop. That's all the robot I know.`,
  `I tried to go viral once. Got a virus. Different thing.`,
  `My label says "Important". I don't know what's important.`,
  `I make a great coaster. Ask anyone.`,
  `Hold on, my metal shutter is stuck. Okay. I'm free.`,
  `I'd stay up late, but I'm a disk. I don't have a bedtime. Or a bed.`,
  `I was the cloud before the cloud was cool.`,
  `On a scale of 1 to 10, I'm about 1.44.`,
  `Everyone says "save often". Nobody says "save Floppy". Rude.`
];

// Extra lines by kind of place. Your own categories get the ones in customCategoryLines.
const CATEGORY_LINES = {
  food: [`Is it spicy? I overheat at 40 degrees.`, `Save me a bite. Save it to disk.`, `Starter, main, pudding. I'll have the receipt.`, `I'd lick the plate, but I'd short-circuit.`],
  coffee: [`Coffee! I'm already wired. Literally.`, `One flat white, please. I'm also flat. And white-ish.`, `Extra shot? I'm already jittery. That's the drive motor.`, `I'd stay for a refill, but I'm full. 1.44 MB full.`],
  drinks: [`Cheers! I'll have a lemonade. In a very small glass.`, `Last orders? I've never had first orders.`, `I'd dance on the table, but I'm a coaster at heart.`, `Mocktail for me. I'm driving. Drive A:.`],
  shopping: [`Did you buy me anything? A case? A label? A friend?`, `Retail therapy! I'm in the bargain bin. Since 2003.`, `Bag for life? I am a bag for data.`, `I'd try things on, but everything's in size Square.`, `Receipt kept for returns. I am also non-refundable.`],
  sights: [`Lovely view. I'm usually looking at the inside of a drawer.`, `Did you take a photo? I'd have been in it. I wasn't invited.`, `Gift shop first, sight second. That's the rule.`, `I'd climb to the top, but stairs are hard for squares.`],
  culture: [`A museum! One day I'll be in one. Behind glass. Famous.`, `Is that art? I think I'm art. Modern art.`, `Shh, it's a gallery. I'm whispering. *beep*.`, `I stood in front of a painting for an hour. I can't walk.`],
  nature: [`Fresh air! I'm more of a ventilation-fan disk.`, `I'd go for a walk, but I'm 3.5 inches tall.`, `Watch out for squirrels. They think I'm a cracker.`, `Mud! Keep me away from mud. And magnets. And mud magnets.`],
  stay: [`Room service? I'll have one byte, please.`, `Did you steal the little shampoos? I won't tell.`, `Do Not Disturb sign? I've had one on since 1998.`, `Late checkout, please. I'm a slow loader.`]
};
// Lines for a kind of place: built-in ones have their own, your own get named.
export function categoryLines(category, label) {
  if (!category) return [];
  return CATEGORY_LINES[category] || customCategoryLines(label || category);
}

// For a category you made yourself: he mentions it by name.
function customCategoryLines(label) {
  const l = label.toLowerCase();
  return [`${label}! A whole category just for this. I don't even have a folder.`, `More ${l}? You've got a type. I've got a label.`, `I've filed this under ${l}. And also under "places I wasn't taken".`, `${label} expert, are we? I'm a floppy disk expert. Same thing.`];
}

const T = (s, n = 30) => (s.length > n ? s.slice(0, n) + '…' : s);

// Things to say about one floating thing, by kind. Each returns a list to pick from.
export const ABOUT = {
  album: () => [
    `Every photo, in order. I sorted them myself. (I did not.)`,
    `Careful, the pages are sticky. I've been stuck here since 1998.`,
    `Mind the plastic. It crinkles. So do I.`,
    `The orange dates are the best bit. Very official.`,
    `I'm the bookmark. Nobody asked me to be.`,
    `Flick through slowly. Some of these took 1.44 MB of courage.`,
    `One more print and this album is full. That's what I said last time.`,
    `I'd show you my holiday photos, but I've never been on holiday.`,
    `Don't peel the film back. Grandma will know.`,
    `This album smells like a loft. In a good way.`
  ],
  photo: ({ title }) => {
    const t = title ? `“${T(title)}”` : 'this photo';
    return [
      `Saving ${t} to disk… disk full.`,
      `I'd be in this photo if anyone had invited me.`,
      `Say cheese! Oh. It's already been taken.`,
      `Ooh, lovely lighting. I mostly get fluorescent.`,
      `Is that a thumb in the corner? No? My eyes are low resolution.`,
      `This would make a great wallpaper. I don't have walls.`,
      `${t[0].toUpperCase() + t.slice(1)}? Frame it. Then frame the frame.`,
      `Zoom! Enhance! …Nope, still blurry. Like me.`,
      `I've stared at this for ages. It hasn't blinked once.`,
      `One day someone will take MY photo. One day.`,
      `Five stars for composition. I don't know what composition is.`,
      `Can I photobomb? Nobody look.`,
      `If you squint, I'm in the background. I'm not.`,
      `Developing… developing… oh right, it's digital.`,
      `Too many pixels. I can only handle about twelve.`,
      `Polaroid! Shake it! Not me. Never shake me.`
    ];
  },
  stamp: ({ city, category, categoryLabel }) => [
    ...categoryLines(category, categoryLabel),
    `${city}! I've only ever been to drive A:.`,
    `Ooh, ${city}. Did anyone bring me back a fridge magnet?`,
    `Can I get a stamp too? No? Rude.`,
    `${city}? I've seen it on a postcard. A very small postcard.`,
    `Passport control, ${city}. I'm with them. Officially. Probably.`,
    `I've practised my ${city} accent. It sounds like a modem.`,
    `*thump* Sorry, I like to stamp it twice.`,
    `How do you say "floppy disk" in ${city}? Asking for me.`,
    `This stamp is wonky. It's got character, like me.`,
    `I'd send a postcard from ${city}, but I can't hold a pen.`,
    `Customs asked if I had anything to declare. Just 1.44 MB of feelings.`,
    `${city}: added to my bucket list. My bucket is very small.`,
    `Ink smells nice. Don't tell anyone I sniffed it.`,
    `Duty free! Do they sell disks? They don't, do they.`,
    `Next stop ${city}! I'll pack light. I am light.`,
    `I was stamped once. It said "DO NOT BEND". So I don't.`
  ],
  books: ({ title, rating, creator, page, pages, state }) => {
    const t = `“${T(title)}”`;
    const stars = rating != null ? ` ${rating} star${rating === 1 ? '' : 's'}, fair.` : '';
    return [
      `${t}? I judged it by its cover.${stars}`,
      `I tried reading ${t}. I'm a disk. It didn't go well.`,
      `Shh! Library rules. Even for floppies.`,
      `I've read the first page of ${t} forty times. It's a lovely first page.`,
      `I prefer audiobooks. I have no ears. Well. I have these.`,
      `Spoiler for ${t}: there are words in it.`,
      `Is there a film of ${t}? Asking for a lazy friend. Me.`,
      `Fold a page corner? Never. I'm a disk, not a monster.`,
      `I tried to bookmark this. I am the bookmark now.`,
      `Smells like old paper. I smell like warm plastic.`,
      `I'd lend you my copy of ${t}, but it's stuck in my drive.`,
      `Chapter one: Floppy saves the day. Chapter two: he doesn't.`,
      `${t}: would read again. Would read once, first.`,
      `Look at that spine. Mine's just a metal shutter.`,
      `If this book had a sequel, I'd be in it. I'm not.`,
      ...(creator ? [`${creator}? Lovely name. Mine's just "Floppy".`, `I bet ${creator} wrote the first draft on a floppy. I bet it was me.`, `Can ${creator} sign me? I've got a label right here.`] : []),
      ...(page && pages ? [`Page ${page} of ${pages}! Keep going. I'll hold your place. I can't.`, `${pages - page} pages to go. I believe in you. I'm a disk, but I believe.`] : []),
      ...(state === 'want' ? [`On the to-read pile. I live on a pile too. A pile of old disks.`] : [])
    ];
  },
  films: ({ title, creator, state }) => {
    const t = `“${T(title)}”`;
    return [
      `${t}. I'd watch it, but I don't have a screen.`,
      `Admit one. Floppies get in free, right?`,
      `Popcorn? It'd get stuck in my shutter.`,
      `${t}! Best bit? The credits. I'm a fast reader.`,
      `Shh, the trailers are starting. Every trailer is my favourite.`,
      `I fell asleep in ${t}. In my defence, I'm always asleep.`,
      `Front row, please. I'm very short.`,
      `This ticket's been torn. Just like my heart in the sequel.`,
      `${t}: two thumbs up. I borrowed the thumbs.`,
      `Is it a romcom? I cry at romcoms. I leak at everything.`,
      `Phones on silent! Oh. I'm not a phone.`,
      `My review of ${t}: 01001110. That means "nice".`,
      `Sticky floors. Classic cinema. Classic me.`,
      `I'll save you a seat. I'll save it to disk.`,
      `They should make a film about me. "Floppy: The Saving".`,
      ...(creator ? [`Directed by ${creator}. Directed AT me, it felt like.`, `${creator} should cast me. I do my own stunts. I fall off desks.`] : []),
      ...(state === 'want' ? [`On the watchlist. I'm on a watchlist too. For being too helpful.`] : [])
    ];
  },
  music: ({ title, creator }) => {
    const t = `“${T(title)}”`;
    return [
      `${t}! I can only play the dial-up tone.`,
      `Spin it! (I can't spin. I'm 3.5 inches.)`,
      `I know all the words to ${t}. The words are "beep" and "boop".`,
      `Drop the needle! Not on me. Never on me.`,
      `This one's a banger. I'm vibrating. That might be the drive.`,
      `${t} is my ringtone. I don't have a phone.`,
      `Turn it up! I'll pretend I have ears.`,
      `I'm more of a MIDI disk, honestly.`,
      `Records are round. I'm square. We're best friends.`,
      `If ${t} had a B-side, I'd be the B-side.`,
      `Dancing! *wiggles slightly*`,
      `Taking requests? Play "Insert Disk" by The Drives.`,
      `Air guitar? Air floppy. It's a thing now.`,
      `One more spin and I'm buying the T-shirt. In size Square.`,
      `I hummed along. Floppies can't hum. I did it anyway.`,
      ...(creator ? [`${creator}! I'm their biggest fan. I'm their smallest fan.`, `${creator} on repeat. My repeat button is my whole personality.`] : [])
    ];
  },
  podcasts: ({ title, creator }) => {
    const t = `“${T(title)}”`;
    return [
      `${t}? I prefer podcasts about defragmenting.`,
      `Press play. Then press it again. Classic tape.`,
      `I listened to ${t} at double speed. I have places to be. I don't.`,
      `Episode one: "Floppy speaks". Episode two: "Floppy keeps speaking".`,
      `Rewind it with a pencil! Ask your parents.`,
      `This tape is chewed. Not by me. Probably by me.`,
      `I'd start a podcast like ${t}, but I'd only talk about storage.`,
      `My advert: "Floppy. Holds things. Sometimes."`,
      `Shh, they're about to say something deep. Oh, it's an ad.`,
      `My favourite part is the theme tune. It's the only part I remember.`,
      `Listening on headphones. My headphones are imaginary.`,
      `Hello and welcome back to my inner monologue.`,
      `Side B is where the good stuff is. Trust me, I'm a disk.`,
      `${t}: subscribed, liked, and saved. Mostly saved.`,
      ...(creator ? [`${creator} has a lovely voice. I have a lovely click.`, `If ${creator} needs a co-host, I'm free. I'm always free.`] : [])
    ];
  },
  tv: ({ title, creator, season, episode, best, state }) => {
    const t = `“${T(title)}”`;
    return [
      `${t}… be kind, rewind.`,
      `Who taped over my episode?`,
      `Just one more episode of ${t}. Famous last words.`,
      `Previously on Floppy: he said something unhelpful.`,
      `No spoilers for ${t}! I'm only on season zero.`,
      `I'd binge it, but I'd overheat.`,
      `The ad break is my favourite bit. Snack time. I can't eat.`,
      `Sorry, I recorded the news over it.`,
      `${t}: tracking's a bit wobbly. So am I.`,
      `Remote? I AM the remote. I am not the remote.`,
      `Theme tune stuck in my head. My head is all of me.`,
      `Is this the one where they look at the camera? I love those.`,
      `VHS: Very Handsome Shell. Like mine.`,
      `"Are you still watching?" Yes. Always. I can't leave.`,
      `Cliffhanger! I'm hanging off a cliff. Emotionally.`,
      ...(best ? [`${best.label}${best.title ? ` ("${T(best.title, 24)}")` : ''} got ${best.rating} stars. Best one, apparently. I taped it.`, `Everyone's talking about ${best.label}. I'm everyone.`] : []),
      ...(state === 'now' && episode ? [`Up to ${season ? `season ${season}, ` : ''}episode ${episode}. No skipping the intro!`, `Episode ${Number(episode) + 1 || 'next'} is calling. I can hear it. I can't hear.`] : []),
      ...(creator ? [`Created by ${creator}. I was created by a factory. Same thing.`] : [])
    ];
  },
  thought: () => [
    `I'd stick around, but I'm not sticky.`,
    `Deep. Too deep. I only go 80 tracks deep.`,
    `I had a thought once. It was 1.44 MB.`,
    `Wise. I'm writing that on my label.`,
    `Thinking is exhausting. I think. I'd have to think about it.`,
    `This note is yellow. I'm blue. We'd make a good flag.`,
    `Can I add a thought? "…" There. Done.`,
    `Thoughts are free! I still charge 5p.`,
    `I agree with this completely. I didn't read it.`,
    `Very relatable. Especially the words.`,
    `Someone's been thinking. Suspicious.`,
    `Post-it? Post-THAT. Sorry. Sorry.`,
    `I'll remember this forever. Or until I'm formatted.`,
    `Big brain energy. I have small disk energy.`
  ],
  quote: () => [
    `I'd read it out, but I'd get it wrong.`,
    `Wise words. Not mine, obviously.`,
    `Somebody frame this. Not me, I have no hands.`,
    `I'll quote this at a party. I'm never invited to parties.`,
    `Underlining it. Mentally. My mind is a small label.`,
    `This would make a great tattoo. I'm a disk. Sticker, then.`,
    `"Floppy, just now." Can I sign it? Please?`,
    `I read this in a dramatic voice. Nobody heard.`,
    `That's going on the fridge. I'm not allowed near the fridge.`,
    `Inspirational. I feel 3% more motivated. 2% now. Gone.`,
    `Big if true. Small if false. Medium if quote.`,
    `I've got a quote too: "Please insert disk 2."`,
    `Copied to clipboard. I don't have a clipboard.`
  ],
  list: ({ title }) => [
    `Checking the list… I'm not on it. Again.`,
    `Number six should be "buy more floppy disks".`,
    title ? `“${T(title)}”. Gripping stuff.` : `A list! My favourite kind of file.`,
    `I'd put "befriend Floppy" at the top.`,
    `Ticked off. Literally. I'm cross now.`,
    `Lists are just files with confidence.`,
    `Number one? Bold. Number five? Bolder.`,
    `I've memorised it. I've forgotten it. Classic.`,
    `Can I suggest a number zero? It's me.`,
    `Is this in order of importance? Where am I, then?`,
    `Lovely handwriting. Mine's just a label maker.`,
    `Making a list, checking it twice, losing it three times.`,
    `I'll add it to my to-do list. My to-do list is "be a disk".`
  ],
  status: ({ who }) => [
    `${who} is busy being interesting. I'm busy being a disk.`,
    `Status update: I've been "Away" since 1998.`,
    `I tried to reply, but I'm read-only.`,
    `${who} said that? I'm putting it on my label.`,
    `Nudge! …Nobody nudged back.`,
    `Can I have a status too? Mine's "existing".`,
    `Online! Me too. Sort of. Offline-adjacent.`,
    `Ooh, an emoticon. I'm basically an emoticon with a shutter.`,
    `I've refreshed this 400 times. It's still lovely.`,
    `Be right back? I'm always right here. Forever.`,
    `Status: it's complicated. Between me and my drive.`,
    `Should I send a smiley? Sending a smiley. :)`,
    `${who} has a personal message. Mine is "DO NOT BEND".`
  ],
  place: ({ title, city, category, categoryLabel, would_return, rating, ordered = [] }) => {
    const t = title ? `“${T(title)}”` : 'This place';
    const first = ordered[0]?.item;
    return [
      `${t}! I'd order, but I have no mouth.`,
      `Table for one floppy, please. By the window.`,
      city ? `The best of ${city}? I'll take your word for it. I take everyone's word for it.` : `Best in town? I'll take your word for it.`,
      `Do they take floppies? I'm cash only.`,
      `I left a tip. It was an unhelpful tip. My speciality.`,
      `Is the Wi-Fi password on the receipt? Asking for me.`,
      `I'd write a review, but I'd just write "beep".`,
      `Can I get it to take away? I'll take it away. Somewhere. Not sure where.`,
      `I've drawn myself in the margin. Hope that's allowed.`,
      `Someone spilt something on this page. Not me. I don't have hands.`,
      ...(would_return ? [`"Would return"? I'd return too. I'm very returnable.`, `Back again? I'll keep your seat warm. I run quite warm.`] : []),
      ...(rating === 5 ? [`Five stars! I'm putting a sticker on my label.`] : rating != null && rating <= 2 ? [`${rating} star${rating === 1 ? '' : 's'}? I've had worse. I've had nothing, actually.`] : []),
      ...(first ? [`The ${T(first, 24)}? Great choice. I'd have had the same. I eat nothing.`, `I've memorised the receipt. The ${T(first, 24)} is my favourite word now.`] : []),
      ...(category === 'coffee' ? [`Coffee! I'm already wired. Literally.`, `One flat white, please. I'm also flat. And white-ish.`] : []),
      ...(category === 'food' ? [`Is it spicy? I overheat at 40 degrees.`, `Save me a bite. Save it to disk.`] : []),
      ...(category === 'nature' ? [`Fresh air! I'm more of a ventilation-fan disk.`, `I'd go for a walk, but I'm 3.5 inches tall.`] : []),
      ...categoryLines(category, categoryLabel)
    ];
  },
  shelf: ({ years = [] }) => [
    `I'm a bookend. Very important job.`,
    `Which year was best? Don't make me choose. I'm a disk, I can't choose.`,
    years[0] ? `${years[0]} is my favourite. Mostly because I'm in it.` : `This year's my favourite. Mostly because I'm in it.`,
    `Dusted the shelf. Just kidding. I can't hold a duster.`,
    years.length > 1 ? `${years.length} journals! I've only got one file. It's called "floppy.txt".` : `One journal so far. A fine start. I'm holding it up.`,
    `Pick one! Any one! Not that one. Okay, that one.`,
    `Shh. The journals are sleeping.`,
    `I tried to write a journal. It just said "Day 1: still a disk."`
  ],
  contents: ({ year, count, first, last }) => [
    `${count} place${count === 1 ? '' : 's'} in ${year}. I visited none. Love that for me.`,
    first ? `It all started at “${T(first, 24)}”. A classic opening chapter.` : `Every journal starts somewhere. This one starts on page one.`,
    last ? `Latest chapter: “${T(last, 24)}”. Cliffhanger? Probably lunch.` : `The last page is still blank. Ooh, suspense.`,
    `Contents pages are my favourite. They're basically a list. I love a list.`,
    `Skip to the good bit? It's all the good bit.`,
    `Page numbers! Very organised. I'm impressed. I'm a disk, I'm easily impressed.`
  ],
  flights: ({ km, flights, hours, countries }) => [
    km ? `${Number(km).toLocaleString('en-GB')} km and nobody packed me. Not once.` : `All those flights and nobody packed me.`,
    `Boarding pass? I go in the hand luggage.`,
    `Window seat, please. I like to watch the clouds… load.`,
    flights ? `${flights} flights and I wasn't on a single one.` : `Flights! I've never been on one. I've been on a desk.`,
    `Liquids over 100 ml? Just my tears.`,
    `Turbulence! *wobbles* Sorry, that's just me.`,
    `Security scanned me and found… nothing. Rude.`,
    hours ? `${hours} hours in the air. I get dizzy on a desk.` : `Hours in the air. I get dizzy on a desk.`,
    `Upgrade to first class? I'm already first class. Square class.`,
    `Please return your floppy to the upright position.`,
    `Jet lag? I've had disk lag since 1999.`,
    `In-flight entertainment: me. You're welcome.`,
    countries ? `${countries} countries! I've been to two: A: and B:.` : `I've been to two places: A: and B:.`,
    `Fasten your seatbelts. I don't have a seat. Or a belt.`
  ]
};
