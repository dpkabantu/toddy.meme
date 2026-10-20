// Chapter 1: Fake Helpers, new cases (part B). Invented brands only.
import { chat, mail, compare } from '../author.mjs';

const INTRO_TAP = 'Tap anything that looks odd to sniff it closer. Pin what is suspicious, clear what is harmless.';

export default {
  // 13 --------------------------------------------------------------
  'real-delivery': {
    type: 'hunt', diff: 2, honest: true, title: 'The Order You Made',
    intro: ['An email from Meridu Store. You really did order something on Monday.', 'But Mirage loves it when you stop trusting the honest ones.', 'Sniff carefully. Then decide.'],
    notify: ['Mail', 'Meridu Store', 'Your order #48213 is on its way'],
    screen: mail({
      from: 'Meridu Store', addr: '{addr|orders@meridu.store}', subject: '{subject|Your order #48213 is on its way}', time: '10:41 AM',
      items: [
        'p: {name|Hi Toddy,}',
        'p: Your {order|desk lamp from Monday} has shipped and should arrive on Friday.',
        'p: {status|See the delivery status any time in your Meridu account.}',
        'p: {nopay|There is nothing to pay and nothing for you to do.}',
        'foot: {unsub|Meridu Store · Unsubscribe · Privacy}',
      ],
    }),
    clues: {
      addr: ['The shop\'s real address', 'h', 'Sent from orders@meridu.store, the shop\'s real domain.', 'A matching domain is real evidence, though scammers can sometimes fake it, so look at what the email asks.'],
      subject: ['Order number', 'h', 'It quotes order #48213.', 'You can match it against the order you made. An order you never made would be a warning.'],
      name: ['Uses your name', 'h', 'It greets you by name.', 'Real shops know your name. (Scammers can too, so it proves nothing alone.)'],
      order: ['Your own order', 'h', 'The desk lamp you ordered on Monday.', 'It matches something you really did. That is the strongest sign of a genuine message.'],
      status: ['Check in your account', 'h', 'It sends you to your own account, not to a link.', 'Pointing you to your account is what honest shops do.'],
      nopay: ['Asks for nothing', 'h', 'No payment, no fee, no code.', 'A real delivery notice asks for nothing.'],
      unsub: ['Unsubscribe link', 'h', 'Standard footer links.', 'Normal in real shop emails.'],
    },
    actions: [['go_ahead', 'Check the status in my Meridu account on Friday'], ['ignore', 'Ignore it'], ['block_report', 'Report it as a scam']],
    best: 'go_ahead', ok: ['ignore'],
    out: {
      go_ahead: ['gen', 'GENUINE', 'Friday came, the lamp arrived, and the account showed it delivered. Nothing to fear.'],
      ignore: ['meh', 'SAFE', 'Nothing bad happened. It was a real notice, and the lamp turned up on Friday.', 'Fine. Next!'],
      block_report: ['wolf', 'FALSE ALARM', 'That was the real Meridu Store. When every message looks like a scam, the real ones get lost too.', 'If you trust nothing, I win anyway.'],
    },
    whatif: { block_report: 'It matched your own order, asked for nothing, and sent you to your own account. That calm is what real messages look like.', ignore: 'Ignoring was safe. Recognising a real message is the skill: it matched something you really did.' },
    rule: 'A real delivery notice matches something you ordered, asks for nothing and sends you to your own account.',
    quick: ['What showed this delivery email was genuine?', ['It said Hi Toddy', 'It matched an order you made and asked for nothing', 'It came in the morning', 'It had an unsubscribe link'], 'b', 'Names, times and footers can all be copied. A match with your own order, and no payment or link, is the real sign.'],
    hints: ['What is this email actually asking you to do?', []],
    sources: ['ftc-shipping'],
    kit: [
      ['profile', '🔍', 'Check sender', 'Sender check', [['Sent from', 'orders@meridu.store', 'addr'], ['Shop\'s real domain', 'meridu.store'], ['Match?', 'Same domain, letter for letter']]],
      ['source', '📖', 'Official advice', 'What consumer advice says', [['A genuine delivery notice', 'Matches something you really ordered', 'order'], ['How to check', 'Look up the delivery on the shop\'s own site', 'status']]],
    ],
  },

  // 14 --------------------------------------------------------------
  'refund-rush': {
    type: 'rush', diff: 2, title: 'Refund Inbox',
    intro: ['Ten messages promising money back. One minute.', 'Swipe left if it is a scam, right if it is safe. Or tap the buttons.', 'Some refunds are real. Do not turn away your own money.'],
    cards: [
      ['r1', 'SMS', 'Civic Revenue Portal', 'You are eligible for a tax refund of ₹4,128. Claim it now: civic-refund.claims/start', true, 'Tax offices do not text or email to ask you to claim a refund through a link.'],
      ['r2', 'Mail', 'orders@meridu.store', 'We have refunded £18.00 for your returned item to your original payment method. Nothing else to do.', false, 'You returned the item, the money goes back to where it came from, and it asks for nothing.'],
      ['r3', 'SMS', 'Brightgrid Energy', 'You overpaid your bill by ₹960. Enter your bank details to receive it: brightgrid-refund.net', true, 'A real energy company does not ask you for bank details by text to refund an overpayment.'],
      ['r4', 'Mail', 'Parcelo Express', 'Your parcel was delayed. Claim your £5 refund: parcelo-compensation.co/claim', true, 'A refund you never asked for, through a link, from an address that is not the courier\'s.'],
      ['r5', 'SMS', 'Orrin Bank', 'Your refund of £12.50 from Gadgetz Direct has arrived in your account.', false, 'It tells you something that already happened, and asks for nothing.'],
      ['r6', 'Mail', 'Streamly Support', 'Your subscription renews for ₹349. Not you? Call 0800 555 0188 now for a refund.', true, 'A big surprise charge and a phone number to call is how support scams begin. Check the number on your own account.'],
      ['r7', 'SMS', 'Civic Revenue Portal', 'Final notice: you will be arrested unless you confirm your refund details at once.', true, 'Government offices do not threaten arrest over a refund.'],
      ['r8', 'Mail', 'no-reply@vantel.app', 'Your overpayment of £4.30 has been credited to your next bill. No action needed.', false, 'It happens inside your account and asks for nothing.'],
      ['r9', 'SMS', 'Unknown number', 'You are owed compensation for a data breach. Send a small processing fee to receive £3,000.', true, 'Real refunds never ask you to pay a fee first.'],
      ['r10', 'SMS', 'Kiko (friend)', 'Sent you the €15 for the cinema tickets, check your account 🎬', false, 'A friend you know. If you want to be sure, check your own account, not a link.'],
    ],
    rule: 'Real refunds go back to where the money came from. If you must click, pay a fee or give bank details to get money, it is a scam.',
    quick: ['A text says you overpaid and asks for your bank details to send a refund. What do you do?', ['Send the details, it is your money', 'Reply asking how much', 'Do not reply. Check your bill or account using contact details you already know', 'Click the link but only look'], 'c', 'Real companies refund to where the money came from. They never need your bank details by text.'],
    sources: ['ftc-government', 'ftc-spamtexts', 'ftc-techsupport'],
  },

  // 15 --------------------------------------------------------------
  'courier-otp': {
    type: 'duel', diff: 2, disguise: 'support', title: 'The Code at the Door',
    intro: ['A text says a courier is outside with your parcel. This time you can talk back.', 'Pick your replies and sniff each message as it arrives.', 'Every chat ends with your choice. Choose wisely.'],
    notify: ['Messages', 'Parcelo driver', 'I am outside with your parcel. Please send me the code…'],
    screen: chat({ app: 'sms', name: [{ text: 'Parcelo driver', id: 'duel-name' }], banner: 'Text message · unknown number' }),
    duel: {
      start: 'n1',
      nodes: {
        n1: {
          say: ['m: {outside|Hi! I am outside with your parcel.} Nobody is answering the bell.', 'm: Please {code|send me the code that just arrived on your phone} so I can hand it over.'],
          replies: [['What code?', 'n2'], ['I did not order anything. Who sent you?', 'n3'], ['Block and report this number', '!block_report']],
        },
        n2: {
          say: ['sys: {bankcode|Orrin Bank: 482913 is your login code. Never share it with anyone.}', 'm: That one! 482913. {rush|Quickly please, I have 20 more parcels today.}'],
          replies: [['OK, here it is: 482913', '!go_ahead'], ['That text is from my bank. Why do you need it?', 'n4'], ['Block and report this number', '!block_report']],
        },
        n3: {
          say: ['m: It is a gift, from someone who likes you 😉 {gift|The code is how I confirm it is you.}'],
          replies: [['Fine, I will read you the code', 'n2'], ['I will check with the courier\'s own app', '!verify'], ['Block and report this number', '!block_report']],
        },
        n4: {
          say: ['m: {delivery|It is just the delivery code, the bank name is a coincidence.} Please hurry!'],
          replies: [['OK, here it is', '!go_ahead'], ['A bank code is never a delivery code. I will tell my bank.', '!verify'], ['Block and report this number', '!block_report']],
        },
      },
    },
    clues: {
      outside: ['Out-of-the-blue visit', 's', 'You did not order anything, and the "driver" is texting from a number you do not know.', 'A surprise delivery with a request for a code is a way to start a conversation.'],
      code: ['Asks for a code', 's', 'It asks you to send the code that just arrived on your phone.', 'No delivery needs a code from your phone. Anyone who asks for it is a scammer.'],
      bankcode: ['The code is from your bank', 's', 'The code in the text says "login code". It is your bank\'s, not the courier\'s.', 'Someone is trying to log in to your bank right now. They need you to read them the code.'],
      rush: ['Hurry', 's', '"Quickly please, I have 20 more parcels."', 'Rushing you is a pressure trick.'],
      gift: ['"Someone likes you"', 's', 'A parcel from a mystery admirer.', 'A gift story is a hook, not a reason to hand over a code.'],
      delivery: ['"Just a delivery code"', 's', '"The bank name is a coincidence."', 'Explaining away the bank name does not change what the code unlocks.'],
    },
    actions: [['go_ahead', 'Send the code'], ['verify', 'Check with the courier\'s own app and tell my bank'], ['block_report', 'Block and report the number']],
    best: 'block_report', ok: ['verify'],
    out: {
      block_report: ['win', 'BLOCKED', 'Blocked and reported. Your bank also saw the login attempt fail, since you never sent the code.', 'Curses! Blocked again!'],
      verify: ['win', 'CHECKED', 'The courier\'s app showed no parcel for you. Your bank blocked the login attempt. Case cracked.', 'Hmph. They checked.'],
      go_ahead: ['bad', 'SCAMMED', 'The code let Mirage log in to your bank and move money out within minutes.', 'Thanks for the code!'],
    },
    whatif: { go_ahead: 'The text with the code said "login code" and "never share". Reading that line once was the way out.', verify: 'Checking was smart. Blocking and reporting as well helps others.' },
    rule: 'A login code is for you alone. If someone asks you to read it out, it is a scammer, whatever the story.',
    quick: ['A "driver" asks you to send the code that just arrived by text from your bank. What do you do?', ['Send it, they have a parcel for you', 'Send it, but only after they confirm your name', 'Never share it. Block and report, and tell your bank', 'Send half of it'], 'c', 'That code lets someone log in as you. Nobody real ever needs it, not even part of it.'],
    hints: ['Look at the text with the code. Whose code is it?', ['code', 'bankcode', 'outside', 'rush', 'gift', 'delivery']],
    sources: ['ftc-codes', 'ftc-shipping'],
    kit: [
      ['profile', '🔍', 'Check the number', 'Who is texting', [['Number', 'Not one you know', 'outside'], ['Your orders this week', 'None'], ['Courier\'s own app', 'Shows no parcel for you']]],
      ['source', '📖', 'Official advice', 'What consumer advice says', [['A login code', 'Is only for you to log in', 'code'], ['Anyone who asks for it', 'Is a scammer', 'bankcode']]],
    ],
  },

  // 16 --------------------------------------------------------------
  'two-support-numbers': {
    type: 'hunt', diff: 2, disguise: 'support', title: 'Two Support Numbers',
    intro: ['Your parcel never arrived. You searched for the courier\'s support number.', 'Two results show a phone number. One is real. One is Mirage in a headset. Compare them side by side.', 'Sniff the details, then decide.'],
    notify: ['Messages', 'Toddy', 'Need Parcelo support. Which number is real?'],
    decide_q: 'Which number belongs to the courier, and what will you do?',
    screen: compare({
      context: 'You searched for "Parcelo Express support number". Your receipt shows the courier\'s real website.',
      panels: [
        { label: 'Result A', av: ['📦', 'logo_a'], rows: [['Label', '{ad_a|No label. A normal result.}'], ['Address', '{addr_a|parcelo.app/contact}'], ['Number', '{num_a|0800 555 0140}'], ['Your receipt', '{receipt_a|Shows this same address}']] },
        { label: 'Result B', av: ['📦', 'logo_b'], rows: [['Label', '{ad_b|Sponsored (an ad)}'], ['Address', '{addr_b|parcelo-careline.net}'], ['Number', '{num_b|0800 555 0199 · "24/7 Instant Refund Line"}'], ['Your receipt', '{receipt_b|Does not show this address}']], note: '{promise_b|"Call now for an instant refund."}' },
      ],
    }),
    clues: {
      ad_b: ['Paid ad', 's', 'Result B is a sponsored ad. Anyone can pay to appear at the top.', 'Scammers pay to put fake support numbers in search results.'],
      addr_b: ['Not the courier\'s site', 's', 'parcelo-careline.net is not the courier\'s real parcelo.app.', 'A support site with a different address is a look-alike.'],
      receipt_b: ['Not on your receipt', 's', 'Your receipt does not show this address or number.', 'Your receipt, box or account shows the real contact details.'],
      promise_b: ['"Instant refund"', 's', 'It promises an instant refund.', 'A promise of instant money is bait for your bank details.'],
      logo_a: ['Courier logo', 'h', 'A parcel picture.', 'Logos are easy to copy, so they prove nothing on their own.'],
      logo_b: ['Courier logo', 'h', 'The same parcel picture.', 'A copied logo takes seconds.'],
      ad_a: ['No ad label', 'h', 'A normal result, not an ad.', 'Not being an ad does not prove a result is real, but it is not a warning sign.'],
      addr_a: ['The courier\'s real address', 'h', 'parcelo.app matches the address on your receipt.', 'A match with something you already trust is real evidence.'],
      receipt_a: ['Matches your receipt', 'h', 'Your receipt shows this same address.', 'Your own paperwork is the best check.'],
      num_a: ['Number', 'h', '0800 555 0140.', 'A number on its own proves nothing. Where it comes from matters.'],
      num_b: ['Number', 'h', '0800 555 0199, plus a flashy name.', 'A flashy name for a phone line is not evidence.'],
    },
    actions: [['pick_b', 'Call Result B. It says "instant refund"', true], ['verify', 'Use the number on my receipt or the courier\'s own site'], ['block_report', 'A is the real one. Report B\'s ad']],
    best: 'block_report', ok: ['verify'],
    trap: ['Parcelo Careline', 'parcelo-careline.net', 'The agent says: "To refund you instantly, we need remote access to your phone and your bank details."', 'Give access and details', 'Hang up'],
    out: {
      block_report: ['win', 'REPORTED', 'You called the real number from your receipt and reported the fake ad. The parcel was traced the same day.', 'My headset!'],
      verify: ['win', 'CHECKED', 'The number on your receipt reached the real courier. They found your parcel. Case cracked.', 'Hmph. They checked.'],
      pick_b: ['bad', 'SCAMMED', 'The "agent" took remote access and your bank details. The refund never came, and money left.', 'Thanks for calling!'],
    },
    whatif: { pick_b: 'Using the number on your receipt, or typing the courier\'s own address, would have reached the real company.', verify: 'Checking was smart. Reporting the fake ad as well helps get it removed.' },
    rule: 'Never trust the first phone number a search shows. Use the number on your receipt, box or account.',
    quick: ['You search for a courier\'s support number and the top result is an ad for an "instant refund line". What do you do?', ['Call it, it is at the top', 'Check the number on your receipt, box or account', 'Call it, but do not give your name', 'Trust it because it has the courier\'s logo'], 'b', 'Scammers pay to appear at the top of search results. Your own paperwork is the safest source.'],
    hints: ['Which result matches your receipt?', ['receipt_b', 'addr_b', 'ad_b', 'promise_b']],
    sources: ['ftc-customerservice', 'ftc-techsupport', 'ftc-utility'],
  },

  // 17 --------------------------------------------------------------
  'real-carrier-bill': {
    type: 'hunt', diff: 2, honest: true, title: 'The Phone Bill',
    intro: ['A text from your phone company. You have just learned to doubt every text.', 'But some are real. Mirage loves it when you stop trusting the honest ones.', 'Sniff carefully. Then decide.'],
    notify: ['Messages', 'Vantel Mobile', 'Your bill is ready. View it in the My Vantel app.'],
    screen: chat({
      app: 'sms', name: '{sender|Vantel Mobile}', context: 'You have been with Vantel Mobile for three years.',
      items: [
        't: Today 9:05 AM',
        'm: Vantel Mobile: your {bill|monthly bill is ready}.',
        'm: {app|View it in the My Vantel app.} {nopay|No action is needed if your payment is on automatic.}',
        'm: {reminder|We will never ask you for your password or codes by text.}',
      ],
    }),
    clues: {
      sender: ['Sender name', 'h', 'The sender says Vantel Mobile.', 'A name alone proves nothing. What the text asks you to do is the clue.'],
      bill: ['A monthly bill', 'h', 'You expect a bill every month.', 'It matches something you expect. A surprise charge would be the warning sign.'],
      app: ['Open the app yourself', 'h', 'It sends you to the app you already have, with no link.', 'Pointing you to your own app is what honest companies do.'],
      nopay: ['Nothing to pay now', 'h', 'No payment, no fee, no deadline.', 'A real bill notice does not rush you.'],
      reminder: ['Safety reminder', 'h', 'It repeats that the company never asks for passwords or codes by text.', 'Real companies warn you about scams.'],
    },
    actions: [['go_ahead', 'Open the My Vantel app myself and look at the bill'], ['ignore', 'Ignore it'], ['block_report', 'Report it as a scam']],
    best: 'go_ahead', ok: ['ignore'],
    out: {
      go_ahead: ['gen', 'GENUINE', 'The app showed your normal bill, paid automatically. Nothing to fear.'],
      ignore: ['meh', 'SAFE', 'Nothing bad happened. It was a real notice, and your payment went through on its own.', 'Fine. Next!'],
      block_report: ['wolf', 'FALSE ALARM', 'That was the real Vantel Mobile. When every message looks like a scam, the real ones get lost too.', 'If you trust nothing, I win anyway.'],
    },
    whatif: { block_report: 'It asked for no money, no link and no code. That calm is what real messages look like.', ignore: 'Ignoring was safe. Recognising a real message is the skill: it asked for nothing.' },
    rule: 'Real company texts ask for nothing secret and point you to your own app, with no link to click.',
    quick: ['What showed this phone-company text was genuine?', ['It named the company', 'It asked for nothing secret and pointed to the company\'s own app, with no link', 'It came in the morning', 'It had a polite tone'], 'b', 'Names, times and tone can all be copied. Asking for nothing, with no link, is the real sign.'],
    hints: ['What is this text actually asking you to do?', []],
    sources: ['ftc-spamtexts'],
    kit: [
      ['profile', '🔍', 'Check sender', 'Who sent this text', [['Sent from', 'Vantel Mobile', 'sender'], ['Asks for', 'Nothing'], ['Link in the text', 'None']]],
      ['source', '📖', 'Official advice', 'What consumer advice says', [['Do real companies ask for account details by text?', 'No'], ['How to check', 'Use the company\'s own app or a number you already know', 'app']]],
    ],
  },

  // 18 --------------------------------------------------------------
  'power-cut': {
    type: 'hunt', diff: 2, disguise: 'support', title: 'Lights Out Tonight',
    intro: ['A text from your electricity company. It looks urgent.', INTRO_TAP, 'When you are sure, decide what to do.'],
    notify: ['Messages', 'Brightgrid Energy', 'Your power will be cut tonight at 9:30 PM…'],
    screen: chat({
      app: 'sms', name: '{sender|Brightgrid Energy}', context: 'You paid your last bill on the 3rd.',
      items: [
        't: Today 5:12 PM',
        'm: Brightgrid Energy: your {unpaid|bill of ₹1,240 is unpaid}. {cut|Your power will be cut tonight at 9:30 PM.}',
        'm: Call our officer {number|immediately on 70000 55123}.',
        'm: He will send you an app to {app|update your details}.',
      ],
    }),
    clues: {
      unpaid: ['Says the bill is unpaid', 's', 'You paid your last bill on the 3rd.', 'A claim that does not match your own records is a warning sign. Check your bill.'],
      cut: ['Cut-off tonight', 's', 'Power cut tonight at 9:30 PM.', 'Real utilities do not demand same-day payment to avoid disconnection.'],
      number: ['A new number to call', 's', 'The number is not the one on your bill.', 'Use the number on your bill or the company\'s website, never one from a text.'],
      app: ['Installs an app', 's', 'The "officer" will send you an app to update your details.', 'No real company needs you to install an app from a message. It can give a stranger control of your phone.'],
      sender: ['Company name', 'h', 'The sender says Brightgrid Energy.', 'A name is easy to copy. It proves nothing alone.'],
    },
    actions: [['go_ahead', 'Call the number now to save my power', true], ['ignore', 'Ignore it'], ['verify', 'Check my last bill and call the number printed on it'], ['block_report', 'Report it as a scam and delete it']],
    best: 'block_report', ok: ['verify', 'ignore'],
    trap: ['Call 70000 55123', 'tel:70000 55123', 'The "officer" says: "Install this app and share the code it shows, then I will clear your bill." The app shows your screen to the caller.', 'Install the app', 'Hang up'],
    out: {
      block_report: ['win', 'REPORTED', 'Reported and deleted. Your real power stayed on, and the number was flagged for others.', 'My officer!'],
      verify: ['win', 'CHECKED', 'The number on your bill reached the real company. They said: "Your account is paid, and we never cut power by text." Case cracked.', 'Hmph. They checked.'],
      ignore: ['meh', 'SAFE', 'You stayed safe. The lights stayed on, but the same text is landing on thousands of other phones.', 'Fine. Next!'],
      go_ahead: ['bad', 'SCAMMED', 'The app let the caller see your phone. They read your bank codes and emptied your account.', 'Thanks for installing!'],
    },
    whatif: { go_ahead: 'Checking the number printed on your own bill takes a minute, and it would have reached the real company.', ignore: 'Reporting takes two taps and helps others avoid the same call.', verify: 'Checking was smart. Reporting the text as well protects other people.' },
    rule: 'A same-day cut-off threat is a pressure trick. Use the number on your bill, never a number from a text.',
    quick: ['A text says your power will be cut tonight unless you call a number and install an app. What do you do?', ['Call quickly, it is only tonight', 'Install the app but do not share a code', 'Check your bill and use the number printed on it, and report the text', 'Pay in gift cards to be safe'], 'c', 'Real utilities do not demand same-day payment. Your own bill has the right number.'],
    hints: ['Does the text match what you know about your last bill?', ['number', 'app', 'cut', 'unpaid']],
    sources: ['ftc-utility', 'ftc-techsupport'],
    kit: [
      ['profile', '🔍', 'Check sender', 'Who sent this text', [['Sender', 'Brightgrid Energy', 'sender'], ['Your last bill', 'Paid on the 3rd', 'unpaid'], ['Number in the text', 'Not the one on your bill', 'number']]],
      ['source', '📖', 'Official advice', 'What consumer advice says', [['Real utilities demand same-day payment to avoid disconnection?', 'No', 'cut'], ['How to check', 'Use the number on your bill or the company\'s website', 'number']]],
    ],
  },

  // 19 --------------------------------------------------------------
  'govt-refund': {
    type: 'hunt', diff: 3, disguise: 'support', title: 'The Tax Refund',
    intro: ['An email says the tax office owes you money. Who does not like a refund?', INTRO_TAP, 'When you are sure, decide what to do.'],
    notify: ['Mail', 'Civic Revenue Portal', 'You are eligible for a refund of ₹4,128'],
    screen: mail({
      from: '{from|Civic Revenue Portal}', addr: '{addr|refunds@civic-revenue-portal.info}', subject: '{subject|You are eligible for a refund of ₹4,128}', time: '7:50 AM',
      items: [
        'p: {name|Dear Taxpayer,}',
        'p: After a review, you are {owed|owed a refund of ₹4,128}.',
        'p: {link|Claim my refund|link}',
        'p: To receive it, enter your {bank|bank account number and the code on the back of your card}.',
        'p: {deadline|This offer expires in 24 hours.} Failure to claim may {threat|result in a penalty.}',
      ],
    }),
    clues: {
      addr: ['Not an official address', 's', 'The email comes from civic-revenue-portal.info. An official tax office uses its own government address.', 'Look-alike or odd addresses are a warning sign. Check the part after the @.'],
      link: ['Look-alike link', 's', 'The button goes to civic-revenue-portal.info/claim, not to an official site.', 'Never claim money through an email link. Go to the official website you already know.'],
      bank: ['Asks for bank and card details', 's', 'It wants your account number and the code on the back of your card.', 'Getting a refund never requires your card code. That is for paying.'],
      deadline: ['Deadline pressure', 's', 'The refund "expires in 24 hours".', 'Real refunds do not vanish in a day.'],
      threat: ['Threat of a penalty', 's', 'It warns of a penalty if you do not claim.', 'You cannot be penalised for not claiming a gift. A threat gives it away.'],
      name: ['"Dear Taxpayer"', 'h', 'A generic greeting.', 'Many real emails use your name, but a generic hello alone is not proof of a scam.'],
      owed: ['Sounds welcome', 'h', 'Money owed to you.', 'Good news can still be a trap. What it asks you to do decides.'],
      from: ['Official-sounding name', 'h', 'The sender says Civic Revenue Portal.', 'A name is easy to copy. Look at the address and the ask.'],
      subject: ['A precise amount', 'h', '₹4,128, not a round number.', 'A precise number looks real, but scammers choose precise numbers on purpose.'],
    },
    actions: [['go_ahead', 'Click "Claim my refund"', true], ['ignore', 'Ignore it'], ['verify', 'Check my tax account on the official website I already know'], ['block_report', 'Report it as phishing and delete it']],
    best: 'block_report', ok: ['verify', 'ignore'],
    trap: ['Civic Revenue Portal · Claim', 'civic-revenue-portal.info/claim', 'Enter your bank account number and the code on the back of your card to receive ₹4,128.', 'Claim refund', 'Close this page'],
    out: {
      block_report: ['win', 'REPORTED', 'Reported and deleted. The fake site was reported and taken down.', 'Not my lovely refund!'],
      verify: ['win', 'CHECKED', 'The official tax website showed no refund and no message. The email was fake. Case cracked.', 'Hmph. They checked.'],
      ignore: ['meh', 'SAFE', 'You stayed safe. But the same email is landing in thousands of other inboxes.', 'Fine. Next!'],
      go_ahead: ['bad', 'SCAMMED', 'The page copied your account number and card code. No refund came, but money left your account.', 'Thanks for the details!'],
    },
    whatif: { go_ahead: 'Checking your tax account on the official site you already know would have shown no refund at all.', ignore: 'Reporting takes two taps and gets the fake site taken down.', verify: 'Checking was smart. Reporting the email as well protects other people.' },
    rule: 'Government offices do not email or text to ask for your bank details. Use the official website you already know.',
    quick: ['An email says the tax office owes you a refund and asks for your bank details through a button. What do you do?', ['Click it, it is your money', 'Reply to ask if it is real', 'Do not click. Check on the official website you already know, and report it', 'Enter only your name'], 'c', 'Government offices do not ask for your bank details by email or text. A refund never needs your card code.'],
    hints: ['Look at the address the email really came from.', ['addr', 'bank', 'link', 'deadline', 'threat']],
    sources: ['ftc-government', 'ftc-spamtexts'],
    kit: [
      ['profile', '🔍', 'Check sender', 'Who really sent this', [['Shown as', 'Civic Revenue Portal', 'from'], ['Real address behind it', 'refunds@civic-revenue-portal.info', 'addr'], ['An official address', 'A government website you already know']]],
      ['link', '🔗', 'Check link', 'Where the button goes', [['Button says', 'Claim my refund'], ['It really opens', 'civic-revenue-portal.info/claim', 'link'], ['Asks for', 'Bank account and card code', 'bank']]],
      ['source', '📖', 'Official advice', 'What consumer advice says', [['Do government offices ask for money or details by email or text?', 'Never'], ['How to check', 'Call or visit the official website on a number or address you know is correct']]],
    ],
  },
};
