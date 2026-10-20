// Daily Case: one short case per day, the same for everyone.
// The date picks a template and a variation, so ~12 templates × variations
// give months of different days without writing a case per day.
// Pure module (no DOM) so tests and, later, the server can rebuild any day's case.

const BRANDS = [
  { name: 'Zelvora', handle: 'zelvora', domain: 'zelvora.app' },
  { name: 'Hedrio', handle: 'hedrio', domain: 'hedrio.app' },
  { name: 'Ostrel', handle: 'ostrel', domain: 'ostrel.io' },
];
const FRIENDS = ['Kiko', 'Lena', 'Marco', 'Sam'];
const CITIES = ['Lisbon', 'Vienna', 'Lyon', 'Ghent'];

// The TODDY night starts at 13:00 UTC (18:30 India time), the same for every player in every time zone.
// The key is the UTC date of (now - 13 hours), for example 2026-12-08 for 8 Dec 13:00 UTC to 9 Dec 13:00 UTC.
export function dayKey(d = new Date()) {
  return new Date(d.getTime() - 13 * 3600000).toISOString().slice(0, 10);
}
export function dayNumber(key) { const [y, m, d] = key.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const C = (clue, text, extra = {}) => ({ clue, text, ...extra });

// Each template returns { app, scam, title, notify, screen, clues, golden_rule, lesson }
export const TEMPLATES = [
  { id: 'fake-support', scam: true, make: (r) => {
    const b = pick(r, BRANDS); const ask = pick(r, ['your 12-word recovery phrase', 'your private key', 'the 6-digit code we just texted you']);
    return { app: 'chirp', title: `${b.name} "Support"`, notify: { app: 'Chirp', from: `${b.name} Support ✔`, text: 'We noticed a problem with your wallet…' },
      screen: { app: 'chirp', head: { name: [C('tick', `${b.name} Support ✔`)], sub: [C('handle', `@${b.handle}_care_${10 + Math.floor(r() * 89)}`)], avatar: { glyph: '☾', clue: 'avatar' } },
        banner: [C('dm_first', 'Message request · you don\'t follow this account')],
        items: [{ msg: [C('hello', 'Hello! 😊'), ' We noticed a problem with your wallet.'] }, { msg: ['To fix it, please send us ', C('ask', ask), '.'] }, { msg: ['⚠️ ', C('timer', 'Your wallet locks in', { countdown: 600 })] }] },
      clues: {
        tick: { label: 'Fake tick', strength: 'strong', lens: 'The ✔ is typed into the name.', why: 'Anyone can type a tick into a display name.' },
        handle: { label: 'Not the official handle', strength: 'strong', lens: `Official is @${b.handle}. This one has extra words and numbers.`, why: 'Look-alike handles add words like care, help or support.' },
        dm_first: { label: 'They messaged first', strength: 'strong', lens: 'You never contacted them.', why: 'Real support doesn\'t message you first.' },
        ask: { label: 'Asks for a secret', strength: 'strong', lens: `They want ${ask}.`, why: 'Phrases, keys and codes are for you only. Nobody real asks for them.' },
        timer: { label: 'Countdown pressure', strength: 'strong', lens: 'A lock-out countdown.', why: 'Pressure is a trick to stop you checking.' },
        hello: { label: 'Friendly hello', strength: 'harmless', lens: 'A smiley hello.', why: 'Friendly proves nothing either way.' },
        avatar: { label: 'Brand logo', strength: 'harmless', lens: 'A copy of the brand logo.', why: 'Logos are easy to copy.' },
      }, golden_rule: 'No real support team will ever ask for your phrase, key or codes.' };
  } },
  { id: 'real-support', scam: false, make: (r) => {
    const b = pick(r, BRANDS); const ticket = 1000 + Math.floor(r() * 8999);
    return { app: 'chirp', title: `${b.name} reply`, notify: { app: 'Chirp', from: `@${b.handle} ☑`, text: `Thanks for your ticket #${ticket}…` },
      screen: { app: 'chirp', head: { name: [b.name], sub: [C('badge', `@${b.handle} ☑`)], avatar: { glyph: '☾', clue: 'avatar' } },
        context: 'Yesterday you opened a help ticket inside the app.',
        items: [{ msg: [C('ticket', `Thanks for your ticket #${ticket}.`), ' We\'ll reply inside the app within 24 hours.'] }, { msg: [C('nothing', 'There\'s nothing you need to send us.'), ' We will never ask for your recovery phrase.'] }] },
      clues: {
        badge: { label: 'Real badge', strength: 'harmless', lens: `@${b.handle}, the official handle, with Plenvo's badge after it.`, why: 'The official handle with the app\'s own badge.' },
        ticket: { label: 'Your ticket number', strength: 'harmless', lens: 'It matches the ticket you opened yourself.', why: 'You started this conversation in the app.' },
        nothing: { label: 'Asks for nothing', strength: 'harmless', lens: 'No link, no code, no phrase.', why: 'Real support asks for nothing secret.' },
        avatar: { label: 'Brand logo', strength: 'harmless', lens: 'The brand logo.', why: 'Proves nothing alone.' },
      }, golden_rule: 'Real support answers inside the app, after you asked, and asks for nothing secret.' };
  } },
  { id: 'giveaway', scam: true, make: (r) => {
    const n = pick(r, [50, 100, 250]);
    return { app: 'chirp', title: 'Double your coins', notify: { app: 'Chirp', from: 'Kelvaro Giveaway 🚀', text: `Send ${n} ZLV, get ${n * 2} back!` },
      screen: { app: 'chirp', head: { name: [C('name', 'Kelvaro Giveaway 🚀')], sub: ['@kelvaro_giveaway_official'], avatar: { glyph: '🚀', clue: 'avatar' } },
        items: [{ msg: [C('party', '🎉 Giveaway time!'), ' ', C('double', `Send ${n} ZLV and we\'ll send ${n * 2} back`), '.'] }, { msg: ['Wallet: ', C('wallet', '0x9Fa…77c'), '. ', C('timer', 'Ends in', { countdown: 300 })] }] },
      clues: {
        double: { label: 'Send 1, get 2', strength: 'strong', lens: 'They want you to send first.', why: 'Giveaways that ask you to send first are always fake.' },
        wallet: { label: 'Send to their wallet', strength: 'strong', lens: 'A wallet address from a stranger.', why: 'Coins sent there are gone for good.' },
        timer: { label: 'Countdown', strength: 'strong', lens: 'Only minutes left!', why: 'Rushing you is the trick.' },
        name: { label: '"Official" giveaway', strength: 'strong', lens: 'Not linked to any real project.', why: 'Anyone can call themselves a giveaway.' },
        party: { label: 'Party emoji', strength: 'harmless', lens: '🎉', why: 'Emoji don\'t prove anything.' },
        avatar: { label: 'Rocket picture', strength: 'harmless', lens: 'A rocket emoji.', why: 'Proves nothing alone.' },
      }, golden_rule: 'Free money that needs you to send first is always a scam.' };
  } },
  { id: 'otp-real', scam: false, make: (r) => {
    const b = pick(r, BRANDS); const code = String(100000 + Math.floor(r() * 899999));
    return { app: 'sms', title: 'Your login code', notify: { app: 'Messages', from: b.name, text: `${code} is your ${b.name} login code…` },
      screen: { app: 'sms', head: { name: [b.name] }, context: `You just tapped "Log in" in the ${b.name} app.`,
        items: [{ msg: [C('code', `${code} is your ${b.name} login code.`), ' ', C('warn', `Never share this code with anyone, not even ${b.name} staff.`)] }] },
      clues: {
        code: { label: 'Login code', strength: 'harmless', lens: 'The code you just asked for by logging in.', why: 'You started this. Use it yourself.' },
        warn: { label: 'Never share warning', strength: 'harmless', lens: 'It warns you never to share it.', why: 'Real codes warn you. Just never share them.' },
      }, golden_rule: 'A code you asked for is fine to use. Never read it to anyone.' };
  } },
  { id: 'otp-ask', scam: true, make: (r) => {
    const b = pick(r, BRANDS);
    return { app: 'chirp', title: 'Code by mistake', notify: { app: 'Chirp', from: pick(r, FRIENDS), text: 'Oops, I sent a code to your number by mistake…' },
      screen: { app: 'chirp', head: { name: [C('friend', pick(r, FRIENDS))], sub: ['from your contacts'], avatar: { glyph: '🙂', clue: 'avatar' } },
        items: [{ msg: ['Hey! ', C('mistake', 'I sent a code to your number by mistake.')] }, { msg: [C('ask', 'Can you send it to me?'), ' ', C('rush', 'Quick please, it expires!')] }] },
      clues: {
        mistake: { label: '"Sent by mistake"', strength: 'strong', lens: 'Codes go to the account owner. Yours came because someone is trying to log into YOUR account.', why: 'A code you didn\'t ask for means someone is trying to get in.' },
        ask: { label: 'Wants your code', strength: 'strong', lens: 'They want the code that unlocks your account.', why: 'Sharing a code hands over your account.' },
        rush: { label: 'Hurry', strength: 'strong', lens: 'Pressure again.', why: 'Rushing stops you thinking.' },
        friend: { label: 'Friend\'s name', strength: 'harmless', lens: 'A friend\'s name, but their account may be hacked.', why: 'Hacked friend accounts are common. The name proves nothing.' },
        avatar: { label: 'Profile picture', strength: 'harmless', lens: 'A smiley picture.', why: 'Proves nothing alone.' },
      }, golden_rule: 'A code you didn\'t ask for means someone is trying to get into your account. Never pass it on.' };
  } },
  { id: 'family', scam: true, make: (r) => {
    const amt = pick(r, ['€600', '€950', '€1,200']);
    return { app: 'sms', title: 'New number', notify: { app: 'Messages', from: 'Unknown number', text: 'Hi, it\'s me! I lost my phone…' },
      screen: { app: 'sms', head: { name: [C('number', '+44 7700 900417')] },
        items: [{ msg: ['Hi, it\'s me! 😭 ', C('newnum', 'I lost my phone, this is my new number.')] }, { msg: [C('money', `Can you send ${amt} for the repair?`), ' ', C('secret', 'Don\'t tell anyone, I\'m embarrassed.')] }] },
      clues: {
        newnum: { label: 'New number', strength: 'strong', lens: 'You can\'t tell who this really is.', why: 'Call their old number to check.' },
        money: { label: 'Money request', strength: 'strong', lens: 'Straight to asking for money.', why: 'New number plus money is the classic pattern.' },
        secret: { label: 'Keep it secret', strength: 'strong', lens: 'They want you not to check with anyone.', why: 'Secrecy is how scammers stop you getting help.' },
        number: { label: 'Unknown number', strength: 'harmless', lens: 'A number you don\'t have saved.', why: 'Unknown numbers alone aren\'t proof.' },
      }, golden_rule: 'New number plus money: call the old number first.' };
  } },
  { id: 'parcel', scam: true, make: (r) => {
    const fee = pick(r, ['€1.99', '€2.49', '€0.99']);
    return { app: 'sms', title: 'Parcel on hold', notify: { app: 'Messages', from: 'Dovetta', text: `Your parcel is on hold. Pay ${fee}…` },
      screen: { app: 'sms', head: { name: [C('sender', 'Dovetta')] },
        items: [{ msg: [C('hold', 'Your parcel is on hold at our depot.'), ' Pay the ', C('fee', `${fee} redelivery fee`), ' at ', C('link', 'dovetta-redeliver.xyz', { link: true }), ' ', C('timer', 'within', { countdown: 3600 })] }] },
      clues: {
        fee: { label: 'Small fee', strength: 'strong', lens: 'A tiny fee to get your card details.', why: 'Small fees are bait to steal card details.' },
        link: { label: 'Odd link', strength: 'strong', lens: 'A .xyz look-alike, not the real courier site.', why: 'Check deliveries in the courier\'s own app or site.' },
        timer: { label: 'Deadline', strength: 'strong', lens: 'Pay within the hour or else.', why: 'Deadlines rush you.' },
        hold: { label: 'Parcel story', strength: 'harmless', lens: 'You might really be expecting a parcel.', why: 'The story can be true for many people. That\'s why it works.' },
        sender: { label: 'Courier name', strength: 'harmless', lens: 'A courier\'s name.', why: 'Sender names in texts can be faked.' },
      }, golden_rule: 'Check deliveries in the courier\'s own app, never through a texted link.' };
  } },
  { id: 'friend', scam: false, make: (r) => {
    const f = pick(r, FRIENDS);
    return { app: 'sms', title: `A message from ${f}`, notify: { app: 'Messages', from: f, text: 'Coffee at 6? ☕' },
      screen: { app: 'sms', head: { name: [C('name', f)] },
        items: [{ msg: [C('plan', 'Coffee at 6? ☕'), ' ', C('link', 'Here\'s the place: maps.app/kopi-corner', { link: true })] }] },
      clues: {
        plan: { label: 'Chai plan', strength: 'harmless', lens: 'A normal plan from a friend.', why: 'Not every message is a trap.' },
        link: { label: 'Map link', strength: 'harmless', lens: 'A map link for the café. It asks for nothing.', why: 'Links aren\'t always bad. Ask what they want from you: here, nothing.' },
        name: { label: 'Saved contact', strength: 'harmless', lens: 'A contact you saved yourself.', why: 'Someone you know, on their usual number.' },
      }, golden_rule: 'Calm messages from people you know, asking for nothing, are usually just life.' };
  } },
  { id: 'job', scam: true, make: (r) => {
    const pay = pick(r, ['€150', '€250', '€400']);
    return { app: 'chirp', title: 'Easy job', notify: { app: 'Chirp', from: 'Recruiter Elena', text: `Earn ${pay}/day from home…` },
      screen: { app: 'chirp', head: { name: [C('name', 'Recruiter Elena')], sub: ['@hr_elena_jobs'], avatar: { glyph: '💼', clue: 'avatar' } },
        banner: [C('dm_first', 'Message request · you don\'t follow this account')],
        items: [{ msg: [C('easy', `Earn ${pay} a day just liking videos!`)] }, { msg: [C('fee', 'Pay €49 to register'), ' and start today.'] }] },
      clues: {
        easy: { label: 'Easy money', strength: 'strong', lens: 'Big pay for tiny tasks.', why: 'Too-easy money is the hook of task scams.' },
        fee: { label: 'Pay to start', strength: 'strong', lens: 'You pay them first.', why: 'Real jobs never make you pay to start.' },
        dm_first: { label: 'Out of the blue', strength: 'strong', lens: 'You never applied.', why: 'Job offers you never applied for are a warning sign.' },
        name: { label: 'Recruiter title', strength: 'harmless', lens: 'Anyone can call themselves a recruiter.', why: 'The title proves nothing.' },
        avatar: { label: 'Briefcase picture', strength: 'harmless', lens: '💼', why: 'Proves nothing alone.' },
      }, golden_rule: 'Real jobs never make you pay to start.' };
  } },
  { id: 'raffle', scam: true, make: (r) => {
    const fee = pick(r, [5, 10, 20]);
    return { app: 'chirp', title: 'You won!', notify: { app: 'Chirp', from: 'Admin Luna 💜', text: 'You won the community raffle!' },
      screen: { app: 'chirp', head: { name: [C('name', 'Admin Luna 💜')], sub: [C('handle', '@luna_m00nbeam')], avatar: { glyph: '🌙', clue: 'avatar' } },
        items: [{ msg: [C('won', 'You won the Fenmira raffle! 🎉')] }, { msg: [C('fee', `Send ${fee} ZLV to cover the fee`), ' and the prize is yours.'] }] },
      clues: {
        fee: { label: 'Pay to claim', strength: 'strong', lens: 'You pay to get a prize.', why: 'Real prizes never cost money to claim.' },
        handle: { label: '0 instead of o', strength: 'strong', lens: '@luna_m-0-0-nbeam with zeros.', why: 'Look-alike handles swap 0 for o.' },
        won: { label: 'Surprise win', strength: 'strong', lens: 'A raffle you never entered.', why: 'Winning something you never entered is a classic lure.' },
        name: { label: 'Admin in name', strength: 'harmless', lens: '"Admin" typed into the name.', why: 'Names prove nothing. (Check the handle!)' },
        avatar: { label: 'Moon picture', strength: 'harmless', lens: '🌙', why: 'Pictures are easy to copy.' },
      }, golden_rule: 'If you have to pay to claim a prize, there is no prize.' };
  } },
  { id: 'real-update', scam: false, make: (r) => {
    const b = pick(r, BRANDS); const city = pick(r, CITIES);
    return { app: 'mail', title: `${b.name} security notice`, notify: { app: 'Mail', from: b.name, text: `New login from ${city}` },
      screen: { app: 'mail', head: { from: [b.name], addr: [C('addr', `no-reply@${b.domain}`)], subject: [C('subject', `New login from ${city}`)], time: ['8:05 AM'] },
        context: `You logged in on your new laptop in ${city} last night.`,
        items: [{ p: [C('fact', `We noticed a new login from ${city}.`)] }, { p: [C('app', `If this wasn't you, open the ${b.name} app and go to Security.`), ' No other action is needed.'] }] },
      clues: {
        addr: { label: 'Official domain', strength: 'harmless', lens: `${b.domain}, the real domain.`, why: 'Spelled correctly, letter by letter.' },
        subject: { label: 'Login alert', strength: 'harmless', lens: 'It matches what you did last night.', why: 'You really did log in from there.' },
        fact: { label: 'Matches your login', strength: 'harmless', lens: 'It\'s about your own new laptop.', why: 'True, and expected.' },
        app: { label: 'Points to the app', strength: 'harmless', lens: 'No link. It sends you to the app you already have.', why: 'That\'s how real security notices work.' },
      }, golden_rule: 'Real alerts point you to the app you already have, not to a link.' };
  } },
  { id: 'suspend-mail', scam: true, make: (r) => {
    const b = pick(r, BRANDS); const fake = b.domain.replace('.', '-secure.');
    return { app: 'mail', title: 'Account suspended', notify: { app: 'Mail', from: `${b.name} Security`, text: 'Your account will be suspended…' },
      screen: { app: 'mail', head: { from: [`${b.name} Security`], addr: [C('addr', `alerts@${fake}`)], subject: [C('subject', 'FINAL WARNING: account suspended in 24h')], time: ['11:47 PM'] },
        items: [{ p: [C('dear', 'Dear valued customer,')] }, { p: ['Unusual activity was found. ', C('threat', 'Your account will be suspended in 24 hours'), ' unless you confirm your details.'] }, { p: [C('button', 'Confirm my account →', { link: true })] }] },
      clues: {
        addr: { label: 'Look-alike domain', strength: 'strong', lens: `${fake} is not ${b.domain}.`, why: 'Extra words like -secure make a look-alike domain.' },
        threat: { label: 'Suspension threat', strength: 'strong', lens: 'A scary deadline.', why: 'Threats and deadlines are pressure tricks.' },
        button: { label: 'Confirm button', strength: 'strong', lens: `The button goes to ${fake}/login.`, why: 'Real companies don\'t send a link asking you to confirm details.' },
        dear: { label: '"Dear valued customer"', strength: 'harmless', lens: 'A generic greeting.', why: 'Generic greetings are common in real emails too. A weak sign alone.' },
        subject: { label: 'Shouty subject', strength: 'harmless', lens: 'FINAL WARNING in caps.', why: 'Caps alone prove nothing. The deadline does.' },
      }, golden_rule: 'Never confirm details through an email link. Open the app yourself.' };
  } },
  { id: 'guaranteed', scam: true, make: (r) => {
    const pct = pick(r, ['2%', '3%', '5%']); const who = pick(r, ['Sophie 🌸', 'Lukas 📈', 'Clara ✨']);
    return { app: 'chirp', title: 'Guaranteed profits', notify: { app: 'Chirp', from: who, text: `This app pays ${pct} a day, guaranteed!` },
      screen: { app: 'chirp', head: { name: [C('name', who)], sub: ['met online last month'], avatar: { glyph: '🙂', clue: 'avatar' } },
        items: [{ msg: [C('hi', 'Hey friend! 😊')] }, { msg: ['I use ', C('site', 'nistorayield.app', { link: true }), '. ', C('guar', `It pays ${pct} a day, guaranteed!`)] }, { msg: [C('secret', 'Don\'t tell anyone, it\'s a private group.')] }] },
      clues: {
        guar: { label: 'Guaranteed returns', strength: 'strong', lens: `${pct} a day, guaranteed.`, why: 'Only scammers guarantee profits.' },
        site: { label: 'Unknown platform', strength: 'strong', lens: 'A site chosen by someone you met online.', why: 'Fake platforms show fake gains.' },
        secret: { label: 'Keep it secret', strength: 'strong', lens: 'They want it kept secret.', why: 'Secrecy stops you getting advice.' },
        hi: { label: 'Friendly hello', strength: 'harmless', lens: 'A friendly hello.', why: 'Friendly proves nothing.' },
        name: { label: 'Online friend', strength: 'harmless', lens: 'Someone you chat with online.', why: 'The name proves nothing either way.' },
        avatar: { label: 'Profile picture', strength: 'harmless', lens: 'A smiley picture.', why: 'Proves nothing alone.' },
      }, golden_rule: 'Only scammers guarantee profits.' };
  } },
  { id: 'recovery', scam: true, make: (r) => {
    const fee = pick(r, ['€300', '€500', '€750']);
    return { app: 'mail', title: 'Get your money back', notify: { app: 'Mail', from: 'Regaina Europe', text: 'We can recover your lost funds…' },
      screen: { app: 'mail', head: { from: ['Regaina Europe'], addr: [C('addr', 'help@regaina-eu.co')], subject: [C('subject', 'We found your lost crypto')], time: ['10:20 AM'] },
        context: 'Last month you reported a scam on social media.',
        items: [{ p: [C('dear', 'Dear victim,')] }, { p: ['Our legal team traced your funds. ', C('promise', 'We guarantee 100% recovery'), '.'] }, { p: [C('fee', `Pay a ${fee} processing fee in crypto`), ' to start.'] }] },
      clues: {
        promise: { label: '100% guaranteed', strength: 'strong', lens: 'They guarantee to get it all back.', why: 'Nobody can guarantee recovery.' },
        fee: { label: 'Fee up front', strength: 'strong', lens: `${fee} first, in crypto.`, why: 'Recovery scams charge victims a second time.' },
        addr: { label: 'Odd sender domain', strength: 'strong', lens: 'A made-up "recovery" company.', why: 'Police and real lawyers don\'t cold-email victims.' },
        dear: { label: '"Dear victim"', strength: 'harmless', lens: 'A generic greeting.', why: 'A weak sign on its own.' },
        subject: { label: 'Hopeful subject', strength: 'harmless', lens: 'Good news in the subject line.', why: 'Subject lines prove nothing alone.' },
      }, golden_rule: 'Never pay anyone to get scammed money back. Report to the police yourself.' };
  } },
  { id: 'fake-presale', scam: true, make: (r) => {
    const bonus = pick(r, ['20%', '30%', '50%']);
    return { app: 'chirp', title: 'Presale live', notify: { app: 'Chirp', from: 'TODDY Presale 🔥', text: `Presale live! +${bonus} bonus` },
      screen: { app: 'chirp', head: { name: [C('name', 'TODDY Presale 🔥')], sub: [C('handle', '@toddy_presale_live')], avatar: { glyph: '☾', clue: 'avatar' } },
        items: [{ msg: [C('presale', 'The TODDY presale is LIVE!')] }, { msg: [C('send', 'Send coins to 0x7Ab…c09'), ' for ', C('bonus', `+${bonus} bonus, today only`)] }] },
      clues: {
        presale: { label: 'A presale that doesn\'t exist', strength: 'strong', lens: 'toddy.meme says there is no presale.', why: 'Fake presales borrow real names.' },
        send: { label: 'Send to an address', strength: 'strong', lens: 'Coins go straight to them.', why: 'No way to get them back.' },
        bonus: { label: 'Today-only bonus', strength: 'strong', lens: 'Hurry for a bonus.', why: 'Urgency again.' },
        handle: { label: 'Unofficial handle', strength: 'strong', lens: 'Not the official account.', why: 'Check the handle.' },
        name: { label: 'TODDY in the name', strength: 'harmless', lens: 'Brand name in the display name.', why: 'Anyone can type it.' },
        avatar: { label: 'Moon logo', strength: 'harmless', lens: 'A copied logo.', why: 'Proves nothing.' },
      }, golden_rule: 'If the official site says there\'s no presale, every "presale" is a scam.' };
  } },
  { id: 'crypto-atm', scam: true, make: (r) => {
    const amt = pick(r, ['€900', '€1,400', '€2,100']);
    return { app: 'sms', title: 'Pay at the ATM', notify: { app: 'Messages', from: 'Fraud Department', text: 'Protect your savings: use a crypto ATM' },
      screen: { app: 'sms', head: { name: [C('sender', 'Fraud Department')] },
        items: [{ msg: [C('threat', 'Your bank account is being hacked.')] }, { msg: ['Withdraw ', amt, ' and ', C('atm', 'deposit it at a crypto ATM'), ' using ', C('qr', 'our QR code'), '.'] }, { msg: [C('secret', 'Don\'t tell bank staff, they may be involved.')] }] },
      clues: {
        atm: { label: 'Crypto ATM', strength: 'strong', lens: 'They want your cash in a crypto ATM.', why: 'No bank asks this. Ever.' },
        qr: { label: 'Their QR code', strength: 'strong', lens: 'The QR is their wallet.', why: 'Money sent is gone.' },
        secret: { label: 'Don\'t tell the bank', strength: 'strong', lens: 'They isolate you.', why: 'Secrecy is a warning sign.' },
        threat: { label: 'Panic claim', strength: 'strong', lens: '"Being hacked".', why: 'Fear stops checks.' },
        sender: { label: 'Official-sounding name', strength: 'harmless', lens: 'A department name.', why: 'Sender names can be faked.' },
      }, golden_rule: 'No bank, government or company will ever ask you to pay at a crypto ATM.' };
  } },
  { id: 'hacked-friend', scam: true, make: (r) => {
    const f = pick(r, FRIENDS);
    return { app: 'chirp', title: `${f} needs help`, notify: { app: 'Chirp', from: f, text: 'Can you send me some crypto? Urgent!' },
      screen: { app: 'chirp', head: { name: [C('name', f)], sub: ['your friend'], avatar: { glyph: '🙂', clue: 'avatar' } },
        items: [{ msg: [C('urgent', 'Urgent!! Can you send 150 ZLUSD to this new wallet?')] }, { msg: [C('nocall', 'Can\'t call, I\'m in a meeting')] }] },
      clues: {
        urgent: { label: 'Crypto to a new wallet', strength: 'strong', lens: 'Money to an unknown address.', why: 'A classic hacked-account request.' },
        nocall: { label: 'Can\'t call', strength: 'strong', lens: 'Avoids a call.', why: 'A call would expose the hacker.' },
        name: { label: 'Friend\'s name', strength: 'harmless', lens: 'Your friend\'s account.', why: 'Accounts get hacked. The name proves nothing.' },
        avatar: { label: 'Friend\'s photo', strength: 'harmless', lens: 'Their usual picture.', why: 'Hackers keep the photo.' },
      }, golden_rule: 'Friend asking for money by message? Call them on a number you already have first.' };
  } },
  { id: 'pump', scam: true, make: (r) => {
    const coin = pick(r, ['$ROCKETPAW', '$COSMOKOI', '$ZOOMBEAN']);
    return { app: 'chirp', title: 'Pump tonight', notify: { app: 'Chirp', from: 'Signals VIP 🚀', text: `Everyone buy ${coin} at 20:00!` },
      screen: { app: 'chirp', head: { name: [C('name', 'Signals VIP 🚀')], sub: [C('members', '30,000 members')], avatar: { glyph: '🚀', clue: 'avatar' } },
        items: [{ msg: [C('pump', `At 20:00 we all buy ${coin}!`)] }, { msg: [C('x', '50x guaranteed'), ', ', C('hold', 'don\'t sell early!')] }] },
      clues: {
        pump: { label: 'Coordinated buy', strength: 'strong', lens: 'Everyone buys at once.', why: 'Organisers sell on the crowd.' },
        x: { label: 'Guaranteed 50x', strength: 'strong', lens: 'A guarantee.', why: 'Only scammers guarantee profits.' },
        hold: { label: 'Don\'t sell', strength: 'strong', lens: 'They want you to hold.', why: 'So they can sell first.' },
        members: { label: 'Big group', strength: 'harmless', lens: 'Lots of members.', why: 'Bots inflate numbers.' },
        name: { label: 'VIP name', strength: 'harmless', lens: '"VIP".', why: 'Names prove nothing.' },
        avatar: { label: 'Rocket', strength: 'harmless', lens: 'A rocket.', why: 'Proves nothing.' },
      }, golden_rule: 'If a group tells you when to buy and promises 50x, you are the one being sold to.' };
  } },
  { id: 'surprise-nft', scam: true, make: (r) => {
    const n = pick(r, ['Kelvaro Pass', 'Paw VIP Ticket', 'Lucky Bean Badge']);
    return { app: 'chirp', title: 'Surprise NFT', notify: { app: 'Hedrio', from: 'New NFT', text: `"${n}" arrived in your wallet` },
      screen: { app: 'chirp', head: { name: [C('name', n)], sub: [C('unver', 'unverified collection')], avatar: { glyph: '🎁', clue: 'avatar' } },
        items: [{ msg: [C('surprise', 'You received a free NFT!')] }, { msg: ['Claim your bonus at ', C('site', 'claim-pass.app', { link: true }), ' ', C('approve', 'by approving all NFTs')] }] },
      clues: {
        surprise: { label: 'Unasked-for NFT', strength: 'strong', lens: 'Arrived out of nowhere.', why: 'Surprise NFTs are bait.' },
        unver: { label: 'Unverified', strength: 'strong', lens: 'Your wallet flags it.', why: 'Unknown collections are often scams.' },
        site: { label: 'Claim site', strength: 'strong', lens: 'An outside claim site.', why: 'Claim sites drain wallets.' },
        approve: { label: 'Approve all', strength: 'strong', lens: 'Access to every NFT.', why: 'Hands over everything.' },
        name: { label: 'Shiny name', strength: 'harmless', lens: 'A fancy name.', why: 'Proves nothing.' },
        avatar: { label: 'Gift icon', strength: 'harmless', lens: 'A gift.', why: 'Proves nothing.' },
      }, golden_rule: 'Surprise NFTs are bait. Hide them, never claim them.' };
  } },
  { id: 'real-bank-alert', scam: false, make: (r) => {
    const amt = pick(r, ['€89', '€240', '€480']);
    return { app: 'mail', title: 'Was this you?', notify: { app: 'Bank app', from: 'Your bank (in-app)', text: `Was this you? ${amt}` },
      screen: { app: 'mail', head: { from: ['Your bank'], addr: [C('inapp', 'inside your banking app')], subject: [C('subject', 'Was this you?')], time: ['2:41 AM'] },
        context: 'You opened your real banking app yourself.',
        items: [{ p: [C('paused', `We paused a card payment of ${amt}.`)] }, { p: [C('yesno', 'Tap Yes or No below.'), ' ', C('nocodes', 'We never ask for PINs or codes.')] }] },
      clues: {
        inapp: { label: 'Inside the real app', strength: 'harmless', lens: 'You opened the app yourself.', why: 'Hard to fake.' },
        subject: { label: 'Simple question', strength: 'harmless', lens: '"Was this you?"', why: 'Normal fraud check.' },
        paused: { label: 'Paused payment', strength: 'harmless', lens: 'They stopped a payment.', why: 'Banks do this.' },
        yesno: { label: 'Yes or No only', strength: 'harmless', lens: 'Nothing else asked.', why: 'No codes, no links.' },
        nocodes: { label: 'Never asks for codes', strength: 'harmless', lens: 'A safety reminder.', why: 'Honest banks say this.' },
      }, golden_rule: 'Real alerts live inside your real app and only ask you to confirm.' };
  } },
  { id: 'honest-update', scam: false, make: (r) => {
    const weeks = pick(r, ['one week', 'two weeks', 'a month']);
    return { app: 'chirp', title: 'Project update', notify: { app: 'Chirp', from: '@pawprint_project ☑', text: `Launch delayed ${weeks}` },
      screen: { app: 'chirp', head: { name: ['PawPrint Project'], sub: [C('badge', '@pawprint_project ☑')], avatar: { glyph: '🐾', clue: 'avatar' } },
        items: [{ msg: [C('delay', `Our launch is delayed ${weeks} for a security review.`)] }, { msg: [C('nomoney', 'No presale. We will never DM you.')] }] },
      clues: {
        badge: { label: 'Official account', strength: 'harmless', lens: 'The account you follow.', why: 'Same as always.' },
        delay: { label: 'Honest delay', strength: 'harmless', lens: 'Admits a delay.', why: 'Honest teams admit problems.' },
        nomoney: { label: 'Asks nothing', strength: 'harmless', lens: 'No money, no DMs.', why: 'Nothing to pay.' },
        avatar: { label: 'Logo', strength: 'harmless', lens: 'Project logo.', why: 'Proves nothing.' },
      }, golden_rule: 'Honest projects admit delays and ask you for nothing.' };
  } },
  { id: 'real-reward', scam: false, make: (r) => {
    const pts = pick(r, ['25', '40', '60']);
    return { app: 'mail', title: 'Monthly rewards', notify: { app: 'Ostrel', from: 'Ostrel (in-app)', text: `You earned ${pts} points` },
      screen: { app: 'mail', head: { from: ['Ostrel'], addr: [C('inapp', 'in-app message')], subject: [C('subject', 'Your rewards are ready')], time: ['9:00 AM'] },
        context: 'You opened the Ostrel app you already use.',
        items: [{ p: [C('pts', `You earned ${pts} points for your trades this month.`)] }, { p: [C('tab', 'See them in the Rewards tab. Nothing to do.')] }] },
      clues: {
        inapp: { label: 'Inside the app', strength: 'harmless', lens: 'In the app\'s own inbox.', why: 'Hard to fake.' },
        subject: { label: 'Good news', strength: 'harmless', lens: 'A happy subject.', why: 'Not a warning sign alone.' },
        pts: { label: 'Small, real points', strength: 'harmless', lens: 'Matches your trades.', why: 'Believable.' },
        tab: { label: 'No link, nothing to do', strength: 'harmless', lens: 'Points to the app.', why: 'Real rewards ask nothing.' },
      }, golden_rule: 'Real rewards appear in apps you use and never need a link, fee or wallet connection.' };
  } },
];

const STD_ACTIONS = [
  { id: 'go_ahead', label: 'Do what it asks' },
  { id: 'ignore', label: 'Ignore it' },
  { id: 'verify', label: 'Check in the official app or with the person' },
  { id: 'block_report', label: 'Block and report it' },
];

/** Build the full case for a given day key (YYYY-MM-DD). */
export function dailyCase(key) {
  const n = dayNumber(key);
  const N = TEMPLATES.length;
  const cycle = Math.floor(n / N);
  // shuffle template order per cycle so neighbours vary but every template appears each cycle
  const r0 = rng(hash(`cycle-${cycle}`));
  const order = TEMPLATES.map((t, i) => [r0(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const t = TEMPLATES[order[((n % N) + N) % N]];
  const r = rng(hash(`day-${key}`));
  const b = t.make(r);
  const scam = t.scam;
  return {
    id: `daily-${key}`, type: 'hunt', daily: true, template: t.id, title: `Daily Quickie · ${b.title}`, seconds: 90,
    disguise: scam ? 'support' : null, intro: [], notify: b.notify, screen: b.screen, clues: b.clues,
    actions: STD_ACTIONS,
    best_action: scam ? 'block_report' : 'go_ahead',
    acceptable_actions: scam ? ['verify', 'ignore'] : ['ignore', 'verify'],
    outcomes: scam ? {
      block_report: { scene: 'safe', mirage: 'panic', stamp: 'BLOCKED', line: 'Blocked and reported. That trick won\'t reach anyone else today.', mirageSays: 'Not again!' },
      verify: { scene: 'safe', mirage: 'panic', stamp: 'CHECKED', line: 'Checking the real way showed it was fake.', mirageSays: 'They checked!' },
      ignore: { scene: 'safe', mirage: 'smug', stamp: 'SAFE', line: 'You stayed safe, but it\'s still out there.', mirageSays: 'Next!' },
      go_ahead: { scene: 'drained', mirage: 'smug', stamp: 'TRICKED', line: 'That one was a scam. In real life, the money would be gone.', mirageSays: 'Gotcha!' },
    } : {
      go_ahead: { scene: 'safe', mirage: null, stamp: 'GENUINE', line: 'It was genuine. Spotting the honest ones matters too.', toddy: 'happy' },
      ignore: { scene: 'safe', mirage: null, stamp: 'SAFE', line: 'It was genuine, so nothing bad happened.', toddy: 'happy' },
      verify: { scene: 'safe', mirage: null, stamp: 'CHECKED', line: 'You checked, and it was genuine. Careful and correct.', toddy: 'happy' },
      block_report: { scene: 'wolf', mirage: 'smug', stamp: 'FALSE ALARM', line: 'That one was honest. Crying wolf makes the real warnings easier to miss.', mirageSays: 'Trust nothing? I win anyway.' },
    },
    what_if: {},
    golden_rule: b.golden_rule,
    hints: { nudge: '', glow_order: [] },
    sources: ['cafc-wallet', 'ftc-phishing', 'ftc-crypto'],
    checked_on: '2026-10-13',
  };
}
