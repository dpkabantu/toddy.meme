// Chapter 1: Fake Helpers, new cases (part A). Invented brands only: Orrin Bank, Parcelo Express, Tarvo Toll, Meridu Store, Brightgrid Energy, Vantel Mobile, Chirp, Plenvo.
import { chat, mail, compare } from '../author.mjs';

const INTRO_TAP = 'Tap anything that looks odd to sniff it closer. Pin what is suspicious, clear what is harmless.';

export default {
  // 1 ---------------------------------------------------------------
  'parcel-fee': {
    type: 'hunt', diff: 1, disguise: 'support', title: 'The Redelivery Fee',
    intro: ['Afternoon, Toddy. A text just arrived from a courier.', INTRO_TAP, 'When you are sure, decide what to do.'],
    notify: ['Messages', 'Parcelo', 'Your parcel could not be delivered. Pay a small fee…'],
    screen: chat({
      app: 'sms', name: '{sender|Parcelo}', context: 'You have not ordered anything this week.',
      items: [
        't: {time|Today 4:47 PM}',
        'm: Parcelo Express: your parcel {noorder|could not be delivered}. A {fee|redelivery fee of $1} is due.',
        'm: Pay and rebook here: {link|parcelo-redeliver.help/track|link}',
        'm: {timer|Your parcel will be returned in|count:900}',
      ],
    }),
    clues: {
      noorder: ['No parcel expected', 's', 'You have not ordered anything. A delivery you never ordered cannot need a fee.', 'If you are not expecting a parcel, the message is the first thing to doubt.'],
      fee: ['A tiny fee', 's', 'A fee of $1 sounds harmless. The page it leads to asks for your full card details.', 'Small fees are bait: the real target is your card number and security code.'],
      link: ['Look-alike link', 's', 'This link goes to parcelo-redeliver.help, not the real parcelo.app.', 'Real couriers do not ask you to pay through a link in an unexpected text. Check where a link really goes.'],
      timer: ['Countdown pressure', 's', 'A countdown that pushes you to act before you think.', 'Rushing you is a pressure trick. A real delivery does not vanish in 15 minutes.'],
      sender: ['Courier name', 'h', 'The sender says Parcelo. A name is easy to copy.', 'Anyone can type a courier name into a text. It proves nothing either way.'],
      time: ['Sent at 4:47 PM', 'h', 'Sent mid-afternoon.', 'Scam texts arrive at any hour. The time alone proves nothing.'],
    },
    actions: [['go_ahead', 'Open the link and pay the fee', true], ['ignore', 'Ignore it'], ['verify', 'Check the shop\'s site or the courier\'s own app'], ['block_report', 'Delete it and report the text as junk']],
    best: 'block_report', ok: ['verify', 'ignore'],
    trap: ['Parcelo Redelivery', 'parcelo-redeliver.help/track', 'Enter your card number to pay $1 and rebook.', 'Pay $1', 'Close this page'],
    out: {
      block_report: ['win', 'REPORTED', 'Reported and deleted. Your phone company can now block more of these texts.', 'My lovely text!'],
      verify: ['win', 'CHECKED', 'No order, no parcel, nothing waiting. The courier\'s own app said so. Case cracked.', 'Hmph. They checked.'],
      ignore: ['meh', 'SAFE', 'You stayed safe. But the same text is landing on thousands of other phones.', 'Fine. Next!'],
      go_ahead: ['bad', 'SCAMMED', 'The "$1" page copied your card details. Within an hour, bigger payments started to appear.', 'Thanks for the card!'],
    },
    whatif: {
      go_ahead: 'Checking on the shop\'s own site, or the courier\'s own app, takes a minute and costs nothing.',
      ignore: 'Reporting takes two taps and helps your phone company block the next one.',
      verify: 'Checking was smart. Reporting the text as well helps protect other people.',
    },
    rule: 'A delivery text you did not expect is not a delivery. Check on the shop\'s own site, never through the text.',
    quick: ['A text says your parcel is held and you must pay a small fee through a link. You are not expecting anything. What do you do?', ['Pay the small fee, it is only $1', 'Reply STOP to the text', 'Do not click. Check the shop\'s site or the courier\'s app, and report the text', 'Call the number in the text'], 'c', 'Small fees are bait for your card details. Real delivery updates are on the shop\'s site or the courier\'s own app.'],
    hints: ['Were you expecting a parcel at all?', ['noorder', 'link', 'fee', 'timer']],
    sources: ['ftc-shipping', 'ftc-spamtexts'],
    kit: [
      ['profile', '🔍', 'Check sender', 'Who sent this text', [['Number', 'Not a number you know'], ['Name shown', 'Parcelo', 'sender'], ['Your orders this week', 'None', 'noorder']]],
      ['link', '🔗', 'Check link', 'Where the link really goes', [['Message says', 'pay and rebook'], ['It really opens', 'parcelo-redeliver.help', 'link'], ['Real courier site', 'parcelo.app'], ['Deadline', '15 minutes', 'timer']]],
      ['source', '📖', 'Official advice', 'What consumer advice says', [['Unexpected delivery message with a link?', 'Do not click'], ['How to check', 'Look up the delivery on the shop\'s own site, or use contact details you already know'], ['A fee for "redelivery"', 'A common trick to get your card details', 'fee']]],
    ],
  },

  // 3 ---------------------------------------------------------------
  'two-bank-sms': {
    type: 'hunt', diff: 2, disguise: 'support', title: 'Two Bank Texts',
    intro: ['Two texts from "Orrin Bank" arrived within minutes of each other.', 'One is real. One is Mirage in a bank-teller hat. Compare them side by side.', 'Sniff the details, then decide.'],
    notify: ['Messages', 'Orrin Bank', 'Your account has been restricted. Verify now…'],
    decide_q: 'Which text is really from the bank, and what will you do?',
    screen: compare({
      context: 'Both texts mention your Orrin Bank card. You did not make the payment mentioned in Text A.',
      panels: [
        { label: 'Text A', av: ['🏦', 'logo_a'], rows: [['From', 'Orrin Bank'], ['Says', '{says_a|We paused a payment of £38.20 at Meridu Store.}'], ['What to do', '{todo_a|Open the Orrin app to review it, or call the number on your statement.}'], ['Link', '{link_a|None}'], ['Asks for', '{asks_a|Nothing}']], note: '{never_a|"We never ask for your PIN or codes."}' },
        { label: 'Text B', av: ['🏦', 'logo_b'], rows: [['From', '{name_b|ORRIN-BANK}'], ['Says', '{says_b|Your account is restricted!}'], ['What to do', '{todo_b|Verify within 1 hour or the account will be closed.}'], ['Link', '{link_b|orrin-secure-login.co/verify|link}'], ['Asks for', '{asks_b|Your online banking login and card PIN}']], note: '{nocall_b|"Do not call the bank. This is automated."}' },
      ],
    }),
    clues: {
      says_b: ['Vague alarm', 's', 'Text B says only that something is wrong. It names no payment and no card.', 'A real alert tells you what happened. Scammers stay vague so it fits everyone.'],
      todo_b: ['Deadline and threat', 's', 'Verify within an hour or the account is closed.', 'Pressure to act before you think is a scam sign. Banks do not close accounts over a missed text.'],
      link_b: ['Look-alike link', 's', 'This goes to orrin-secure-login.co, not the bank\'s real site.', 'Never log in through a link in a text. Open the bank\'s own app instead.'],
      asks_b: ['Asks for login and PIN', 's', 'A bank already has your login. It never needs your PIN by text or link.', 'Anyone asking for your PIN or password is a scammer.'],
      nocall_b: ['"Do not call"', 's', 'Text B tells you not to call the bank.', 'Scammers stop you from checking. A real bank wants you to check.'],
      name_b: ['Capital letters sender', 'h', 'ORRIN-BANK looks official, but sender names are easy to copy.', 'A sender name alone proves nothing, in either direction.'],
      logo_a: ['Bank logo', 'h', 'A bank picture.', 'Logos are easy to copy, so they prove nothing on their own.'],
      logo_b: ['Bank logo', 'h', 'The same bank picture.', 'A copied logo takes seconds.'],
      says_a: ['Names the payment', 'h', 'Text A names the shop and the amount.', 'Specific details fit a real alert. Scammers can guess some, so check anyway.'],
      todo_a: ['Open the app yourself', 'h', 'Text A sends you to the app you already have, or to the number on your statement.', 'This is how real banks tell you to check: through channels you already trust.'],
      link_a: ['No link', 'h', 'Text A has no link to click.', 'A real alert does not need you to click anything.'],
      asks_a: ['Asks for nothing', 'h', 'Text A asks for no password, PIN or code.', 'Calm messages that ask for nothing are usually honest.'],
      never_a: ['"We never ask for your PIN"', 'h', 'The text reminds you the bank never asks for your PIN or codes.', 'Real banks warn you about scams.'],
    },
    actions: [['pick_b', 'B is the bank. Tap its link', true], ['verify', 'Not sure. Open the bank\'s own app myself'], ['block_report', 'A is the real alert. Report B as junk']],
    best: 'block_report', ok: ['verify'],
    trap: ['Orrin Bank · Secure login', 'orrin-secure-login.co/verify', 'Enter your login and card PIN to remove the restriction.', 'Log in', 'Close this page'],
    out: {
      block_report: ['win', 'REPORTED', 'You spotted the fake and reported it. Your real bank alert was handled in the app.', 'My bank-teller hat!'],
      verify: ['win', 'CHECKED', 'The app showed one paused payment and no restriction. Text B was fake. Case cracked.', 'Hmph. They checked.'],
      pick_b: ['bad', 'SCAMMED', 'The page copied your login and PIN. Mirage moved the money before breakfast.', 'Thanks for the PIN!'],
    },
    whatif: { pick_b: 'Opening the bank\'s own app, instead of the link, would have shown no restriction at all.', verify: 'Checking was smart. Reporting B as well helps the bank shut the fake site down.' },
    rule: 'A bank never needs your PIN or password by text. Open the bank\'s own app yourself.',
    quick: ['Two bank texts arrive. One names a payment and sends you to the app. The other threatens to close your account unless you log in via a link. Which is the scam?', ['The one that names a payment', 'The one with the link and the threat', 'Neither: banks text like this', 'Both: banks never text'], 'b', 'A link, a deadline and a request for login details are three scam signs in one. Open your bank\'s own app instead.'],
    hints: ['Which text asks you to click, hurry, or give a PIN?', ['asks_b', 'link_b', 'todo_b', 'nocall_b', 'says_b']],
    sources: ['ftc-bank-call', 'ftc-codes', 'ftc-spamtexts'],
  },

  // 6 ---------------------------------------------------------------
  'account-locked': {
    type: 'hunt', diff: 2, disguise: 'support', title: 'Account Locked',
    intro: ['An email just landed. Your bank, it says, has locked your account.', INTRO_TAP, 'When you are sure, decide what to do.'],
    notify: ['Mail', 'Orrin Bank Security', 'Your account has been LOCKED. Act now.'],
    screen: mail({
      from: '{from|Orrin Bank Security}', addr: '{addr|security@orrin-bank-help.com}', subject: '{subject|Your account has been LOCKED - act now}', time: '8:03 AM',
      items: [
        'p: {greet|Dear Customer,}',
        'p: We noticed an unusual sign-in. {deadline|Restore access within 2 hours} or your account will be permanently closed.',
        'p: {link|Restore my account|link}',
        'p: You will need your {login|online banking login and card PIN} to confirm it is you.',
        'p: {nocall|Do not contact your branch. This process is automatic.}',
        'foot: Orrin Bank Security Team',
      ],
    }),
    clues: {
      addr: ['Not the bank\'s domain', 's', 'The email comes from orrin-bank-help.com. The bank\'s real address ends in orrin.app.', 'Look-alike sender addresses add extra words. Check the part after the @, letter by letter.'],
      deadline: ['Deadline and threat', 's', 'Two hours, or the account is closed for good.', 'A hard deadline is built to stop you thinking. Real banks do not work this way.'],
      link: ['Look-alike link', 's', 'The button really goes to orrin-bank-help.com/restore.', 'Never log in through a link in an email. Type the bank\'s address or use its app.'],
      login: ['Asks for login and PIN', 's', 'The page wants your login and your card PIN.', 'No real bank asks for your PIN. Anyone who does is a scammer.'],
      nocall: ['"Do not contact your branch"', 's', 'The email tells you not to check with your branch.', 'Scammers block your way to a check. A real bank is happy for you to check.'],
      greet: ['"Dear Customer"', 'h', 'No name, just "Dear Customer".', 'Many real emails use your name, but a generic hello alone is not proof of a scam.'],
      subject: ['Capital letters', 'h', '"LOCKED" in capitals.', 'Shouting alone proves nothing. The threats and the link do.'],
      from: ['Bank name', 'h', 'The sender name says Orrin Bank Security.', 'A display name is easy to type. Look at the address behind it.'],
    },
    actions: [['go_ahead', 'Click "Restore my account"', true], ['ignore', 'Ignore it'], ['verify', 'Open the Orrin app myself and look'], ['block_report', 'Report it as phishing and delete it']],
    best: 'block_report', ok: ['verify', 'ignore'],
    trap: ['Orrin Bank · Restore access', 'orrin-bank-help.com/restore', 'Enter your online banking login and card PIN to restore access.', 'Restore access', 'Close this page'],
    out: {
      block_report: ['win', 'REPORTED', 'Reported as phishing. The bank\'s security team had the fake address blocked by lunchtime.', 'Not my lovely email!'],
      verify: ['win', 'CHECKED', 'The app showed no lock and no warning. The email was fake. Case cracked.', 'Hmph. They checked.'],
      ignore: ['meh', 'SAFE', 'You stayed safe. The fake address is still sending the same email to thousands of others.', 'Fine. Next!'],
      go_ahead: ['bad', 'SCAMMED', 'The page copied your login and PIN. The real account was emptied in minutes.', 'Thanks for logging in!'],
    },
    whatif: {
      go_ahead: 'Opening the bank\'s own app would have shown no lock, and no problem at all.',
      ignore: 'Forwarding the email to the bank\'s fraud address helps get the fake site taken down.',
      verify: 'Checking was smart. Reporting the email as well protects other people.',
    },
    rule: 'Never log in through a link in an email. Open the bank\'s own app or type its address yourself.',
    quick: ['An email says your account is locked and you have two hours to log in through a button. What do you do?', ['Click fast, two hours is short', 'Reply asking if it is real', 'Open the bank\'s own app yourself, and report the email', 'Forward it to a friend to check'], 'c', 'The deadline and the link are the trap. Your bank\'s own app shows the truth in seconds.'],
    hints: ['Look at the address the email really came from.', ['addr', 'link', 'login', 'deadline', 'nocall']],
    sources: ['ftc-bank-call', 'ftc-spamtexts'],
    kit: [
      ['profile', '🔍', 'Check sender', 'Who really sent this', [['Shown as', 'Orrin Bank Security', 'from'], ['Real address behind it', 'security@orrin-bank-help.com', 'addr'], ['The bank\'s real domain', 'orrin.app']]],
      ['link', '🔗', 'Check link', 'Where the button goes', [['Button says', 'Restore my account'], ['It really opens', 'orrin-bank-help.com/restore', 'link'], ['Asks for', 'Login and card PIN', 'login']]],
      ['source', '📖', 'Official advice', 'What the bank and consumer advice say', [['Does a bank ask for your PIN?', 'Never', 'login'], ['How to check an alarming message', 'Open your own app or call the number on your statement'], ['"Do not contact us"', 'A warning sign: real banks welcome checks', 'nocall']]],
    ],
  },

  // 7 ---------------------------------------------------------------
  'toll-rush': {
    type: 'rush', diff: 2, title: 'Toll Road Texts',
    intro: ['Ten texts, one minute. Your phone has been busy.', 'Swipe left if it is a scam, right if it is safe. Or tap the buttons.', 'Careful: some are honest. Do not cry wolf.'],
    cards: [
      ['r1', 'SMS', 'Tarvo Toll', 'Final notice: you owe $3 in unpaid tolls. Pay now to avoid a $10 fine: tarvo-tollpay.live/pay', true, 'You get a text out of the blue demanding payment through a link. Toll agencies do not collect this way.'],
      ['r2', 'SMS', 'Tarvo Toll', 'Your monthly statement is ready. Open the Tarvo Toll app to view it. No action needed.', false, 'It asks for nothing and sends you to the app you already installed.'],
      ['r3', 'SMS', 'Parcelo', 'Your parcel is held. Pay $1 redelivery: parcelo-pay.help', true, 'An unexpected parcel text with a fee and a link: classic.'],
      ['r4', 'SMS', 'Orrin Bank', 'Orrin: your login code is 551907. Never share this code with anyone, including Orrin staff.', false, 'You just tried to log in, and the text itself warns you never to share the code.'],
      ['r5', 'SMS', 'Unknown number', 'Your toll account is suspended. Update your card at tarvo-secure.net within 30 minutes.', true, 'A deadline, a threat and a look-alike link, all in one text.'],
      ['r6', 'SMS', 'Meridu Store', 'Your order #48213 has shipped. Track it in your Meridu account.', false, 'You ordered it yourself, it asks for nothing, and it sends you to your account.'],
      ['r7', 'SMS', 'Vantel Mobile', 'Your phone is blocked for unpaid charges. Pay now: vantel-unlock.co/pay', true, 'Your phone company does not text a link to pay or unlock. Open its app or check your bill.'],
      ['r8', 'SMS', 'Kiko (friend)', 'Running late for the road trip, save me a seat 😅', false, 'A friend you know, asking for nothing.'],
      ['r9', 'SMS', 'Road Fines Office', 'You have an unpaid road fine of $20. Pay within 24h or your licence will be suspended: roadfines-pay.site', true, 'A threat and a link, with a payment page that is not an official address.'],
      ['r10', 'SMS', 'Tarvo Toll', 'Your toll tag balance is low. Top up in the Tarvo Toll app or at tarvo.app.', false, 'No link to click: it points you to the app and to the real site you already know.'],
    ],
    rule: 'A text that demands payment through a link is a trap. Check on the official app or website you already know.',
    quick: ['A text says you owe $3 in tolls and must pay through a link. You do not use toll roads. What do you do?', ['Pay it, it is only $3', 'Do not click. Check with the toll agency using contact details you already know, then report and delete the text', 'Reply STOP', 'Click the link but do not enter your card'], 'b', 'The small amount is bait. Real agencies send bills through channels you already know.'],
    sources: ['ftc-tolls', 'ftc-spamtexts'],
  },

  // 9 ---------------------------------------------------------------
  'real-bank-alert': {
    type: 'hunt', diff: 2, honest: true, title: 'The Real Alert',
    intro: ['A text from your bank. After today, you might be ready to call everything a scam.', 'But some messages are real. Mirage loves it when you stop trusting the honest ones.', 'Sniff carefully. Then decide.'],
    notify: ['Messages', 'Orrin Bank', 'We paused a card payment of £212.00…'],
    screen: chat({
      app: 'sms', name: '{sender|Orrin Bank}', context: 'You did not make this payment.',
      items: [
        't: Today 1:22 PM',
        'm: Orrin Bank: we {paused|paused a card payment of £212.00 at Gadgetz Direct}.',
        'm: If this was not you, {app|open the Orrin app to review it}, or {call|call the number on your statement}.',
        'm: {never|We will never ask for your PIN, password or codes.}',
      ],
    }),
    clues: {
      paused: ['Names the payment', 'h', 'It names the shop and the amount, and says the payment was paused, not made.', 'Specific facts fit a real alert. Scammers can guess some, so you still check through the app.'],
      app: ['Open the app yourself', 'h', 'It sends you to the app you already have.', 'Pointing you to the app, not to a link, is what honest banks do.'],
      call: ['Number on your statement', 'h', 'It tells you to call the number on your statement.', 'Using a number you already trust avoids fake numbers.'],
      never: ['Safety reminder', 'h', 'It repeats that the bank never asks for your PIN or codes.', 'Real banks warn you about scams.'],
      sender: ['Sender name', 'h', 'The sender says Orrin Bank.', 'A name alone proves nothing. What the message asks you to do is the real clue: nothing secret, no link.'],
    },
    actions: [['go_ahead', 'Open the Orrin app myself and review the payment'], ['ignore', 'Ignore it'], ['block_report', 'Report it as a scam']],
    best: 'go_ahead', ok: [],
    out: {
      go_ahead: ['gen', 'GENUINE', 'The app showed a payment you did not make, already paused. One tap to confirm it was fraud, and the bank sent a new card.'],
      ignore: ['meh', 'SAFE', 'Nothing bad happened this time. But a real alert deserves a look in your own app.', 'Fine. Next!'],
      block_report: ['wolf', 'FALSE ALARM', 'That was a real alert. When every message looks like a scam, the real warnings get lost too.', 'If you trust nothing, I win anyway.'],
    },
    whatif: { block_report: 'Nothing in it asked for money, codes, a PIN or a link. That calm is what real messages look like.', ignore: 'Opening your own app is safe, and it tells you whether the payment really was yours.' },
    rule: 'Real alerts ask for nothing secret and send you to your own app. Check there, never through the text.',
    quick: ['What showed this bank text was genuine?', ['It named the bank', 'It asked for nothing secret and sent you to your own app or the number on your statement', 'It arrived in the afternoon', 'It had a capital letter at the start'], 'b', 'Names, times and logos can all be copied. Asking for nothing secret, and no link, is the real sign.'],
    hints: ['What is this text actually asking you to do?', []],
    sources: ['ftc-bank-call', 'ftc-codes'],
    kit: [
      ['profile', '🔍', 'Check sender', 'Who sent this text', [['Sent from', 'Orrin Bank', 'sender'], ['Same thread as your past bank texts', 'Yes'], ['Asks for', 'Nothing']]],
      ['source', '📖', 'Official advice', 'What the bank says', [['Does the bank ask for your PIN or codes?', 'Never', 'never'], ['How to check', 'Open the app or call the number on your statement', 'call']]],
    ],
  },

  // 11 --------------------------------------------------------------
  'support-reply': {
    type: 'duel', diff: 2, disguise: 'support', title: 'The Helpful Reply',
    intro: ['You complained online about a late order from Meridu Store. Now someone has replied.', 'This time you can talk back. Pick your replies and sniff each message as it arrives.', 'Every chat ends with your choice. Choose wisely.'],
    notify: ['Chirp', 'Meridu Help ✔', 'Sorry about your order! We can refund you here in DMs…'],
    screen: chat({
      app: 'chirp', name: [{ text: 'Meridu Help ✔', id: 'duel-name' }], sub: '@meridu_help_24', av: ['🛍️', 'logo'], banner: 'Message request · you do not follow this account',
    }),
    duel: {
      start: 'n1',
      nodes: {
        n1: {
          say: ['m: {hello|Hi! So sorry about your late order 😔}', 'm: {dmfirst|We saw your post}. We can refund you right here in DMs.', 'm: Start the refund here: {link|meridu-refunds.help/claim|link}'],
          replies: [['How do I get the refund?', 'n2'], ['Are you really Meridu? How can I check?', 'n3'], ['Block and report this account', '!block_report']],
        },
        n2: {
          say: ['m: Easy! Enter your card number on the page, then {code|tell me the 6-digit code we text you}.'],
          replies: [['OK, opening the link', '!go_ahead'], ['Why would a refund need my card number and a code?', 'n4'], ['Block and report this account', '!block_report']],
        },
        n3: {
          rename: 'Meridu Help (official)',
          say: ['sys: {rename|The account changed its name to "Meridu Help (official)"}', 'm: Of course we are official! {rush|Your refund expires in 10 minutes, so please hurry} 🙏'],
          replies: [['OK, I do not want to lose the refund', '!go_ahead'], ['I will ask on Meridu\'s own website instead', '!verify'], ['Block and report', '!block_report']],
        },
        n4: {
          say: ['m: Totally safe, it is how all refunds work. {everyone|Hundreds of customers did it today.}'],
          replies: [['Fine, here goes', '!go_ahead'], ['I will contact Meridu through its own website first', '!verify'], ['No real refund needs my code. Block and report.', '!block_report']],
        },
      },
    },
    clues: {
      dmfirst: ['They messaged first', 's', 'You never contacted this account. It found your public complaint and messaged you.', 'Real companies answer in the open or through their own support page. Scammers watch public complaints.'],
      link: ['Look-alike link', 's', 'This goes to meridu-refunds.help, not to Meridu\'s real site.', 'Never give card details on a page you reached through a message. Check where the link really goes.'],
      code: ['Asks for your code', 's', 'It wants the code your bank texts you.', 'That code lets someone log in or pay as you. Anyone who asks for it is a scammer.'],
      rename: ['It renamed itself', 's', 'The account changed its name when you doubted it.', 'Real companies do not change names to win your trust.'],
      rush: ['Countdown pressure', 's', 'The refund "expires in 10 minutes".', 'Rushing you is a pressure trick. Real refunds do not vanish in minutes.'],
      everyone: ['"Everyone did it"', 's', 'It says hundreds of customers already did it.', 'A crowd you cannot see proves nothing.'],
      logo: ['Shop logo', 'h', 'A little shopping-bag picture.', 'Logos are easy to copy, so they prove nothing on their own.'],
      hello: ['Friendly and sorry', 'h', 'A kind, apologetic hello.', 'Being friendly is not suspicious by itself.'],
    },
    actions: [['go_ahead', 'Enter my card details and the code'], ['verify', 'Contact Meridu through its own website'], ['block_report', 'Block and report the account']],
    best: 'block_report', ok: ['verify'],
    out: {
      block_report: ['win', 'BLOCKED', 'Blocked and reported. The platform removed the fake account before it reached anyone else.', 'Curses! Blocked again!'],
      verify: ['win', 'CHECKED', 'Meridu\'s real website said: "We never ask for card details or codes in messages." Case cracked.', 'Hmph. They checked.'],
      go_ahead: ['bad', 'SCAMMED', 'The code let Mirage pay from your account. The "refund" never came, and money left instead.', 'Thanks for the code!'],
    },
    whatif: { go_ahead: 'Asking "why does a refund need my code?" was the way out. The answer is: it never does.', verify: 'Checking was smart. Reporting the account as well gets it removed faster.' },
    rule: 'A refund never needs your card code. Contact the shop through its own website, not through a message.',
    quick: ['Someone replies to your public complaint and asks for your card number and a code texted to you. What is true?', ['Real shops do this to speed up refunds', 'It is fine if the account has a ✔ in its name', 'A refund never needs your codes, so it is a trap', 'Give the code but change your password later'], 'c', 'Codes and card numbers are for paying, not for receiving money. That request alone tells you it is a trap.'],
    hints: ['Why would a refund need a code from you?', ['code', 'link', 'dmfirst', 'rush', 'rename', 'everyone']],
    sources: ['ftc-customerservice', 'ftc-codes'],
    kit: [
      ['profile', '🔍', 'Check the account', 'Meridu Help ✔', [['Joined', '2 days ago', 'dmfirst'], ['Followers', '5'], ['Real Meridu account', '@meridu_store, 6 years old']]],
      ['link', '🔗', 'Check the link', 'Where "claim" goes', [['Address', 'meridu-refunds.help', 'link'], ['Real shop site', 'meridu.store'], ['Asks for', 'Card number and the code your bank texts', 'code']]],
      ['source', '📖', 'Official advice', 'What consumer advice says', [['Contact a shop', 'Through its own website or the contact details on your receipt'], ['A message asking for a code', 'Anyone who asks for it is a scammer', 'code']]],
    ],
  },

  // 12 --------------------------------------------------------------
  'fake-mod': {
    type: 'hunt', diff: 2, disguise: 'admin', title: 'The Strike Notice',
    intro: ['You posted a photo of your cat on Chirp. A message arrives from "Chirp Safety".', INTRO_TAP, 'When you are sure, decide what to do.'],
    notify: ['Chirp', 'Chirp Safety ✔', 'Copyright claim on your photo. Appeal within 24 hours…'],
    screen: chat({
      app: 'chirp', name: '{tick|Chirp Safety ✔}', sub: '{handle|@chirp_safety_appeals}', av: ['🛡️', 'logo'], banner: '{dmfirst|New message request · you do not follow this account}',
      context: 'You posted a photo of your cat this morning.',
      items: [
        't: 11:36 AM',
        'm: {strike|Copyright claim: your photo breaks our rules.} Your account will be {deadline|deleted in 24 hours}.',
        'm: To appeal, log in here: {link|chirp-appeal.support/login|link}',
        'm: Appeals need your {login|password and the code we text you}.',
      ],
    }),
    clues: {
      dmfirst: ['They messaged first', 's', 'A private message from an account you do not follow.', 'Real platforms send notices inside the app, not through DMs from strangers.'],
      tick: ['Fake tick', 's', 'The ✔ is typed into the name. Chirp\'s real verified badge sits after the handle, and there is none.', 'Anyone can type a tick into a display name.'],
      handle: ['New look-alike account', 's', 'Joined 3 days ago, 7 followers. Chirp\'s real account is @chirp.', 'Brand-new look-alike accounts are a classic impersonation sign.'],
      link: ['Look-alike link', 's', 'This goes to chirp-appeal.support, not the real chirp.app.', 'Never log in through a link in a message. Open the app yourself and look at your notices.'],
      login: ['Asks for password and code', 's', 'It wants your password and your texted code.', 'No real platform needs your password or code for an appeal.'],
      deadline: ['Delete-in-24-hours threat', 's', 'Your account will be deleted in 24 hours.', 'A threat with a short deadline is a pressure trick.'],
      strike: ['Copyright claim', 'h', 'A claim that your cat photo breaks the rules.', 'The claim sounds serious, but it comes from an unknown account. The claim alone proves nothing.'],
      logo: ['Shield logo', 'h', 'A shield picture.', 'Logos are easy to copy, so they prove nothing on their own.'],
    },
    actions: [['go_ahead', 'Open the link and appeal', true], ['ignore', 'Ignore it'], ['verify', 'Open the Chirp app and check my notices'], ['block_report', 'Block and report the account']],
    best: 'block_report', ok: ['verify', 'ignore'],
    trap: ['Chirp · Appeal', 'chirp-appeal.support/login', 'Enter your password and the code we text you to appeal.', 'Log in and appeal', 'Close this page'],
    out: {
      block_report: ['win', 'BLOCKED', 'Blocked and reported. The fake account was removed before it reached other people.', 'Curses! Blocked again!'],
      verify: ['win', 'CHECKED', 'The app showed no claim and no warning on your account. Case cracked.', 'Hmph. They checked.'],
      ignore: ['meh', 'SAFE', 'You stayed safe. But the account is still out there messaging other people.', 'Fine. Next!'],
      go_ahead: ['bad', 'SCAMMED', 'The page copied your password and code. Within minutes the account was locked and used to message your friends.', 'Thanks for logging in!'],
    },
    whatif: { go_ahead: 'Opening the app yourself would have shown no claim anywhere. Real notices live inside the app.', ignore: 'Reporting takes two taps and gets the fake account removed.', verify: 'Checking was smart. Blocking and reporting as well protects others.' },
    rule: 'Real platforms send notices inside the app. A DM that threatens deletion and asks for your password is a trap.',
    quick: ['An account you do not follow DMs that your account will be deleted unless you log in through a link. What do you do?', ['Log in quickly through the link', 'Reply and explain your cat photo', 'Open the app yourself to check, then block and report', 'Ask your friends if they got it'], 'c', 'Real notices live inside the app. Never log in through a link a stranger sends.'],
    hints: ['Start with who sent it. Do you know this account?', ['login', 'handle', 'link', 'dmfirst', 'tick', 'deadline']],
    sources: ['ftc-phishing', 'ftc-spamtexts', 'ftc-codes'],
    kit: [
      ['profile', '🔍', 'Check profile', 'Profile check · @chirp_safety_appeals', [['Account created', '3 days ago', 'handle'], ['Followers', '7'], ['Verified badge', 'None. The ✔ is typed into the name', 'tick'], ['Official account', '@chirp, 7 years old']]],
      ['link', '🔗', 'Check link', 'Where the link really goes', [['Message says', 'log in to appeal'], ['It really opens', 'chirp-appeal.support', 'link'], ['Real Chirp site', 'chirp.app']]],
      ['source', '📖', 'Official advice', 'What Chirp\'s help page says', [['Does Chirp DM you about strikes?', 'Never. Notices appear in the app'], ['Does it ask for your password or code?', 'Never, from anyone', 'login']]],
    ],
  },
};
