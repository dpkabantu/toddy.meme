// Chapter 2: Too Good To Be True, new cases (part B). Invented brands only.
import { chat, mail, compare } from '../author.mjs';

export default {
  // 13 --------------------------------------------------------------
  'real-cashback': {
    type: 'hunt', diff: 2, honest: true, title: 'The Cashback',
    intro: 'A text from your bank says you earned money back. After today, everything looks like bait.',
    notify: ['Messages', 'Orrin Bank', 'You earned £4.20 cashback…'],
    screen: chat({
      app: 'sms', name: '{sender|Orrin Bank}', context: 'You paid at Meridu Store last week, using your Orrin card.',
      items: [
        't: Today 9:30 AM',
        'm: Orrin Bank: you earned {amount|£4.20 cashback} on your {purchase|Meridu Store purchase of 14 October}.',
        'm: {app|It will show in the Orrin app under Rewards.}',
        'm: {nothing|You do not need to do anything.}',
      ],
    }),
    clues: {
      sender: ['Same thread as your bank texts', 'h', 'It sits with your past messages from the bank.', 'A name alone proves nothing, but the real question is what it asks.'],
      amount: ['A small, plain amount', 'h', '£4.20, a normal cashback.', 'Honest offers are modest. Scams promise much more.'],
      purchase: ['Matches your own purchase', 'h', 'It names a shop you really paid last week.', 'It matches something you did. That is the strongest sign of an honest message.'],
      app: ['Look in your own app', 'h', 'It sends you to the app you already have.', 'Pointing you to your own app, not a link, is what honest banks do.'],
      nothing: ['Asks for nothing', 'h', 'No link, no code, no details to give.', 'A message that asks for nothing is usually honest.'],
    },
    go: 'Open the Orrin app myself and look under Rewards', good: 'The app showed £4.20 cashback from the Meridu Store purchase, already added. Nothing to fear.',
    calm: 'It matched your own purchase, asked for nothing and sent you to your own app. That calm is what real messages look like.',
    rule: 'A small reward that matches something you did, asks for nothing and sends you to your own app is usually honest.',
    quick: ['What made this cashback text honest?', ['It had a pound sign', 'It matched your own purchase, asked for nothing and sent you to your own app', 'It arrived in the morning', 'It was from a bank'], 'b', 'Names and signs can be copied. A match with something you really did, and no request, is the real sign.'],
    sources: ['ftc-bank-call', 'ftc-codes'],
    kit: {
      who: ['Check sender', 'Who sent this text', [['Same thread as your bank texts', 'Yes', 'sender'], ['Purchase named', 'Meridu Store, 14 October', 'purchase'], ['Asks for', 'Nothing', 'nothing']]],
      adv: ['What advice says', [['How to check a reward', 'Open your own bank app, never a link', 'app'], ['Does a real bank ask for codes?', 'Never']]],
    },
  },

  // 14 --------------------------------------------------------------
  'cheap-phone': {
    type: 'hunt', diff: 2, disguise: 'influencer', title: 'The Cheap Phone',
    intro: 'You want a used Zephyr X5 phone. A seller on Tradely has one far below the usual price.',
    notify: ['Messages', 'Sameer (seller)', 'Phone is yours, send the advance first…'],
    screen: chat({
      app: 'sms', name: '{sender|Sameer (seller)}', context: 'Listing: Zephyr X5, "like new". Usual price about ₹28,000.',
      items: [
        't: Today 8:41 PM',
        'm: Hi! The Zephyr X5 is yours for {price|₹8,000}. I need cash urgently.',
        'm: I am in another city, so I will ship it. {advance|Send ₹3,000 advance for courier first.}',
        'm: Pay to my {phone|personal number by phone transfer}, not through the app, to save fees.',
        'm: {rush|Another buyer is ready. Confirm in 30 minutes.}',
        'm: {pics|Photos: the phone with its box and bill.}',
      ],
    }),
    clues: {
      price: ['Price far below normal', 's', '₹8,000 for a phone that costs about ₹28,000.', 'A price far below normal is the bait.'],
      advance: ['Advance before shipping', 's', 'He wants ₹3,000 before sending anything.', 'Pay only when you hold the phone, or through a protected way.'],
      phone: ['Pay outside the marketplace', 's', 'He asks you to skip the app and pay his personal number.', 'Leaving the marketplace removes every protection you had.'],
      rush: ['Hurry or lose it', 's', 'Confirm in 30 minutes or another buyer takes it.', 'Rushing you is a pressure trick.'],
      pics: ['Nice photos with a bill', 'h', 'A phone, its box and a bill.', 'Photos and bills are copied from other ads. They prove nothing.'],
      sender: ['A normal name', 'h', 'The seller is called Sameer.', 'A name proves nothing.'],
    },
    go: 'Send the ₹3,000 advance', verify: 'Ask to meet and see the phone first',
    win: 'Reported the listing. The marketplace removed the seller before he fooled anyone else.',
    checked: 'The seller refused to meet and went quiet. A search found the same photos in other ads. Case cracked.',
    lose: 'The ₹3,000 went to a stranger. No phone came, and the number went dead.',
    avoid: 'Meeting the seller, paying only for the phone in your hand, or using the marketplace\'s own payment would have stopped it.',
    rule: 'Pay for a used item only when you hold it, or through the marketplace\'s own protected payment. Never an advance to a stranger.',
    quick: ['A seller offers a used phone at a third of its price and asks for an advance outside the app. What do you do?', ['Send the advance, the price is great', 'Send a smaller advance', 'Only buy after seeing it, or by the marketplace\'s own protected payment', 'Ask for a bill photo'], 'c', 'An advance to a stranger, outside the app, is the trap.'],
    nudge: 'How does he want to be paid, and when?',
    sources: ['ftc-marketplace', 'in-rbi-beaware'],
    kit: {
      who: ['Check the listing', 'Seller check', [['Price', '₹8,000 (usual ₹28,000)', 'price'], ['Wants to be paid', 'Outside the app, first', 'phone'], ['Willing to meet?', 'No, "other city"']]],
      adv: ['What advice says', [['Pay outside the marketplace?', 'Never: you lose its protection', 'phone'], ['Payment methods to avoid', 'Transfers, gift cards, crypto: you cannot get them back']]],
    },
  },

  // 15 --------------------------------------------------------------
  'ticket-resale': {
    type: 'duel', diff: 3, disguise: 'friend', title: 'The Last Tickets',
    intro: 'Your favourite band is sold out. Someone in a fan group has two tickets to sell.',
    notify: ['Chirp', 'Dani (fan group)', 'I have two tickets, face value!'],
    screen: chat({
      app: 'chirp', name: [{ text: 'Dani (fan group)', id: 'duel-name' }], sub: '@dani_gigs', av: ['🎟️', 'logo'], banner: 'Message request · from a fan group member',
    }),
    duel: {
      start: 'n1',
      nodes: {
        n1: {
          say: ['m: Hey! I have {two|two tickets} for Saturday at face value, €90 each.', 'm: I can\'t go, my {sad|grandma is ill} 😢', 'm: Send {transfer|€180 by bank transfer} and I will email the tickets.'],
          replies: [['Can I pay through a safer way, like a card?', 'n2'], ['Sending the money now', '!go_ahead'], ['Report this account', '!block_report']],
        },
        n2: {
          say: ['m: {nocard|No, only transfer.} Cards and apps take fees, and I need the money quickly.', 'm: {rush|Lots of people want them. Pay in 20 minutes.}'],
          replies: [['OK, paying by transfer', '!go_ahead'], ['Can I see the tickets and the booking first?', 'n3'], ['Report this account', '!block_report']],
        },
        n3: {
          say: ['m: {shot|Here is a screenshot of the tickets.} It is a barcode, see?', 'm: {trust|Trust me, I am a fan like you.}'],
          replies: [['OK, I trust you', '!go_ahead'], ['A screenshot can be copied. I will only buy through the official resale page.', '!verify'], ['Report this account', '!block_report']],
        },
      },
    },
    clues: {
      two: ['Sold-out tickets at face value', 's', 'Sold-out tickets for exactly what they cost.', 'A hard-to-get item at a normal price is the bait.'],
      sad: ['A sad story', 's', 'A sick grandmother, to make you feel sorry.', 'A sad story is a tool. It is not a reason to skip checks.'],
      transfer: ['Transfer only', 's', 'He wants a bank transfer, not a card.', 'Transfers cannot be taken back. Cards let you dispute a payment.'],
      nocard: ['"No cards"', 's', 'He refuses a safer way to pay.', 'An honest seller does not mind a safe payment.'],
      rush: ['Hurry', 's', 'Pay in 20 minutes or lose them.', 'Rushing you is a pressure trick.'],
      shot: ['A screenshot as proof', 's', 'A picture of a barcode, which can be copied by anyone.', 'A screenshot cannot prove you own a ticket.'],
      trust: ['"Trust me"', 's', 'He asks you to trust him.', 'An honest seller offers proof, not trust.'],
      logo: ['A ticket picture', 'h', 'A little ticket.', 'Pictures prove nothing.'],
    },
    actions: [['go_ahead', 'Pay by bank transfer'], ['verify', 'Buy only through the official resale page'], ['block_report', 'Block and report the account']],
    best: 'block_report', ok: ['verify'],
    out: {
      block_report: ['win', 'BLOCKED', 'Blocked and reported. The group moderators removed the fake seller before more fans paid.', 'Curses! Blocked again!'],
      verify: ['win', 'CHECKED', 'The official resale page had real tickets with the venue\'s own guarantee. Case cracked.', 'Hmph. They checked.'],
      go_ahead: ['bad', 'SCAMMED', 'The money was gone in minutes. No tickets ever arrived, and the account disappeared.', 'Thanks for the transfer!'],
    },
    whatif: { go_ahead: 'Insisting on a card payment, or the official resale page, would have ended it. A real seller accepts either.', verify: 'Checking was smart. Reporting the account as well protects other fans.' },
    rule: 'Never pay a stranger by transfer for tickets. Use the official resale page, or a payment you can dispute.',
    quick: ['A stranger offers sold-out tickets at face value, only by bank transfer, and sends a screenshot. What do you do?', ['Pay, they look real', 'Pay half now', 'Use only the official resale page', 'Ask for another screenshot'], 'c', 'Transfers cannot be reversed and screenshots can be copied. Use the official resale page.'],
    hints: ['How does the seller insist on being paid?', ['transfer', 'nocard', 'shot', 'rush', 'two', 'trust', 'sad']],
    sources: ['ftc-marketplace', 'ftc-gift-cards'],
    kit: {
      who: ['Check the account', '@dani_gigs', [['Account age', '3 days'], ['Tickets for sale', 'Two, sold out', 'two'], ['Wants to be paid', 'Transfer only', 'transfer']]],
      adv: ['What advice says', [['Safer payment', 'Card or a protected payment service', 'nocard'], ['Transfers, gift cards, crypto', 'Cannot be taken back', 'transfer']]],
    },
  },

  // 16 --------------------------------------------------------------
  'shopping-rush': {
    type: 'rush', diff: 2, title: 'Shopping Inbox',
    intro: 'Ten messages about orders and deals. One minute. You did order one thing this week.',
    cards: [
      ['r1', 'Mail', 'orders@meridu.store', 'Your order #48213 has shipped. Track it in your Meridu account.', false, 'It matches an order you made, asks for nothing and sends you to your own account.'],
      ['r2', 'SMS', 'Parcelo', 'Your parcel is held. Pay €1.20 redelivery: parcelo-pay.help', true, 'You expected nothing, and it wants a fee through a link.'],
      ['r3', 'Mail', 'Strideway Outlet', 'FLASH SALE: all shoes 80% off. Only bank transfer. strideway-outlet-sale.shop', true, 'A huge discount with a transfer-only payment: a fake shop.'],
      ['r4', 'SMS', 'Lakshmi Lucky Draw', 'You won ₹25,00,000! Pay ₹4,999 tax to claim: lakshmi-prizeclaim.in', true, 'A prize you never entered, and a fee to collect it.'],
      ['r5', 'Mail', 'Meridu Store', 'Your order has been delivered. Rate your lamp in your Meridu account.', false, 'It confirms an order you made and asks only for a rating in your own account.'],
      ['r6', 'SMS', 'Orrin Bank', 'You earned £4.20 cashback. It shows in the Orrin app under Rewards.', false, 'It asks for nothing and sends you to your own app.'],
      ['r7', 'Chirp', 'Kiko Official ✔', 'You won a free phone! Pay ₹499 delivery: kiko-phones-claim.live', true, 'A free prize that costs money, from a copy account.'],
      ['r8', 'Mail', 'Meridu Store', 'Last chance! Your cart is waiting: a desk lamp, still in your basket.', false, 'A cart reminder asks for nothing. You can ignore it or look in your own account.'],
      ['r9', 'SMS', 'Tarvo Toll', 'You owe $4.60 in tolls. Pay now: tarvo-tollpay.live/pay', true, 'A fee demanded through a link, out of the blue.'],
      ['r10', 'Mail', 'Meridu Store', 'Your account is suspended! Log in within 1 hour: meridu-login-help.com', true, 'A threat, a deadline and a look-alike link.'],
    ],
    rule: 'Check any order or prize on the shop\'s own site, never through a message. Real orders match something you did.',
    quick: ['You get a message about an order you did not make, with a link to pay a fee. What do you do?', ['Pay it, it is small', 'Reply STOP', 'Do not click. Check the shop\'s own site, and report the message', 'Call the number in the message'], 'c', 'A message about something you did not order is the first thing to doubt.'],
    sources: ['ftc-shipping', 'ftc-prize', 'ftc-spamtexts'],
  },

  // 17 --------------------------------------------------------------
  'real-giveaway': {
    type: 'hunt', diff: 2, honest: true, title: 'The Giveaway You Entered',
    intro: 'A message says you won a giveaway. This time you really did enter one last week.',
    notify: ['Chirp', 'Meridu Store ✔', 'You won our lamp giveaway!'],
    screen: chat({
      app: 'chirp', name: '{name|Meridu Store ✔}', sub: '{handle|@meridu_store}', av: ['🛍️', 'logo'], banner: '{reply|Reply to your comment on their giveaway post}',
      context: 'Last week you commented on Meridu Store\'s public giveaway post. Their real account is @meridu_store.',
      items: [
        't: 10:02 AM',
        'm: {won|Congratulations! You won the desk lamp from our public giveaway.}',
        'm: {public|We have also announced the winners in a post on our page.}',
        'm: {free|Prizes are free to receive. We only need a delivery address, which you can send through our website\'s contact form.}',
        'm: {nopay|We will never ask for payment, a card or a code.}',
      ],
    }),
    clues: {
      reply: ['A reply to your own comment', 'h', 'It answers the giveaway you entered, not a random DM.', 'It matches something you did. That is a strong honest sign.'],
      name: ['Shop name', 'h', 'The name says Meridu Store.', 'A name alone proves nothing, so check the handle and the page.'],
      handle: ['The shop\'s real account', 'h', '@meridu_store is the real account, six years old.', 'It matches the real handle on the shop\'s own website.'],
      won: ['You did enter', 'h', 'You commented on that giveaway post last week.', 'A prize for a contest you entered is normal.'],
      public: ['Announced publicly too', 'h', 'The winners are also posted on the page.', 'Real giveaways announce winners in public.'],
      free: ['Prize is free', 'h', 'It asks only for a delivery address, through the shop\'s own site.', 'Real prizes are free and use the shop\'s own website.'],
      nopay: ['Never asks for payment', 'h', 'It says it will never ask for payment, card or code.', 'Honest senders say this up front.'],
      logo: ['Shop logo', 'h', 'The shop\'s bag logo.', 'Logos are easy to copy, so they prove little alone.'],
    },
    go: 'Check the shop\'s page, then send my address through its website form', good: 'The winner post was on the shop\'s page. You sent your address through the real site, and the lamp arrived free on Thursday.',
    calm: 'You entered, the account is the real one, winners were announced in public, and nothing was asked of you but an address through the shop\'s own site.',
    rule: 'A prize for a contest you really entered, from the real account, with no payment, is honest. Check the shop\'s own page first.',
    quick: ['What made this giveaway message honest?', ['It was friendly', 'You had entered, it came from the real account, winners were public and nothing was asked but an address through the shop\'s own site', 'It had a logo', 'It used a tick'], 'b', 'You entered, it is the real account, nothing to pay: these three together.'],
    sources: ['ftc-prize', 'ftc-phishing'],
    kit: {
      who: ['Check the account', '@meridu_store', [['Account age', '6 years', 'handle'], ['Real account on the shop\'s site?', 'Yes, the same handle'], ['You entered this giveaway?', 'Yes, last week', 'won']]],
      adv: ['What advice says', [['Do real prizes cost money?', 'No: real prizes are free', 'nopay'], ['Winners announced publicly?', 'Yes, on the page', 'public']]],
    },
  },

  // 18 --------------------------------------------------------------
  'survey-gift': {
    type: 'hunt', diff: 1, disguise: 'support', title: 'The Free Gift Card',
    intro: 'An email says a two-minute survey earns you a gift card. Easy money, it seems.',
    notify: ['Mail', 'Customer Rewards', 'Take our survey and get a €100 gift card'],
    screen: mail({
      from: '{from|Customer Rewards}', addr: '{addr|rewards@free-gift-surveys.com}', subject: '{subject|Take our 2-minute survey: win a €100 gift card!}', time: '12:14 PM',
      items: [
        'p: {greet|Dear Valued Customer,}',
        'p: You have been {picked|selected} to give us your opinion. It takes only two minutes.',
        'p: Answer 3 questions and receive a {prize|€100 gift card} from a store of your choice.',
        'p: {link|Start the survey|link}',
        'p: At the end, enter your {card|card number for €1.99 delivery}.',
        'foot: Customer Rewards Team',
      ],
    }),
    clues: {
      addr: ['A strange address', 's', 'The email comes from free-gift-surveys.com, which is not any store you shop at.', 'Look at the part after the @. It should match a company you know.'],
      greet: ['"Dear Valued Customer"', 'h', 'No name at all.', 'A vague greeting alone proves little, but it fits mass mailings.'],
      picked: ['"You were selected"', 's', 'You never signed up for anything.', 'Being picked out of nowhere is a warning sign.'],
      prize: ['€100 for two minutes', 's', 'A big reward for a tiny task.', 'Big pay for little work is the bait.'],
      link: ['Look-alike link', 's', 'The button goes to a survey page that is not the store\'s own site.', 'Never start from a link in an unexpected email.'],
      card: ['Asks for your card', 's', 'A "free" gift card that wants your card number for €1.99.', 'A reward that wants your card is a trap.'],
      from: ['Friendly name', 'h', 'The sender is called Customer Rewards.', 'A name is easy to copy.'],
      subject: ['Cheerful subject', 'h', 'A friendly, exciting subject line.', 'Cheerful tone alone proves nothing.'],
    },
    go: 'Click Start and do the survey', trap: ['Rewards survey', 'free-gift-surveys.com/start', 'Answer three questions, then enter your card number for €1.99 delivery.', 'Start the survey', 'Close this page'],
    verify: 'Check the store\'s own site for any survey',
    win: 'Reported as phishing and deleted. The fake address was blocked within days.',
    checked: 'The store\'s own site had no survey and a warning about fake gift-card emails. Case cracked.',
    lose: 'The "delivery" page copied your card details. No gift card came, and strange charges did.',
    avoid: 'A reward that asks for your card number is never a reward.',
    rule: 'A free gift card that wants your card number is a trap. Real rewards never need your card.',
    quick: ['An email offers a €100 gift card for a survey, then asks for your card number for €1.99 delivery. What do you do?', ['Pay €1.99, it is tiny', 'Fill the survey but skip the card', 'Delete it, and report it as phishing', 'Forward it to friends'], 'c', 'A reward that wants your card is the trap. Even starting on the page is risky.'],
    nudge: 'Why would a free gift card need your card?',
    sources: ['ftc-phishing', 'ftc-prize'],
    kit: {
      who: ['Check sender', 'Who really sent this', [['Address', 'rewards@free-gift-surveys.com', 'addr'], ['Any store you know?', 'No'], ['You signed up?', 'No', 'picked']]],
      link: ['Check link', 'Where it goes', [['Button says', 'Start the survey'], ['It really opens', 'a page that asks for your card', 'link'], ['Asks for', 'Card number for €1.99', 'card']]],
    },
  },

  // 19 --------------------------------------------------------------
  'two-giveaways': {
    type: 'hunt', diff: 3, disguise: 'influencer', title: 'Two Giveaway Posts',
    intro: ['Two posts offer a free phone, both using Kiko\'s name. One is Kiko. One is Mirage in a creator\'s hoodie.', 'Compare them side by side.', 'Sniff the details, then decide.'],
    notify: ['Chirp', 'Two posts', 'Phone giveaway: two different accounts'],
    decide_q: 'Which post is really from Kiko, and what will you do?',
    screen: compare({
      context: 'Both posts say Kiko is giving away a phone. Kiko\'s own website lists @kiko as the real account.',
      panels: [
        { label: 'Post A', av: ['🎁', 'pic_a'], rows: [['Account', '{acct_a|@kiko}'], ['Age and followers', '{age_a|4 years · 80,000 followers}'], ['How to enter', '{how_a|Comment on this public post}'], ['Cost', '{cost_a|Free}'], ['Winner chosen', '{pick_a|Live, in a public video, on Friday}']], note: '{pin_a|Pinned: "Beware of copy accounts. We never DM winners asking for money."}' },
        { label: 'Post B', av: ['🎁', 'pic_b'], rows: [['Account', '{acct_b|@kiko_giveaways_official}'], ['Age and followers', '{age_b|3 days · 400 followers}'], ['How to enter', '{how_b|Send us a DM with your details and €5 delivery|link}'], ['Cost', '{cost_b|€5 delivery}'], ['Winner chosen', '{pick_b|Everyone wins! Pay within 2 hours}']], note: '{pin_b|No pinned notices. Comments are turned off.}' },
      ],
    }),
    clues: {
      acct_b: ['A copy of the real name', 's', '@kiko_giveaways_official adds words to @kiko.', 'Copy accounts add words to a real name.'],
      age_b: ['Brand-new account', 's', '3 days old with 400 followers.', 'A new account with a famous name is a copy.'],
      how_b: ['Enter by DM and pay', 's', 'You must DM your details and pay delivery.', 'A real giveaway is entered in public and costs nothing.'],
      cost_b: ['Costs money', 's', '€5 for a "free" phone.', 'A free prize that costs money is a scam.'],
      pick_b: ['Everyone wins, pay fast', 's', '"Everyone wins" and a two-hour deadline.', 'If everyone wins, it is not a contest. It is bait.'],
      pin_b: ['Comments turned off', 's', 'No pinned notice, and nobody can ask questions.', 'Scammers turn off comments so doubters cannot warn others.'],
      pic_a: ['Gift picture', 'h', 'A gift box.', 'Pictures are easy to copy.'],
      pic_b: ['The same gift picture', 'h', 'The same box.', 'A copied picture takes seconds.'],
      acct_a: ['Real handle', 'h', '@kiko matches the handle on Kiko\'s own website.', 'A handle matching the official site is good evidence.'],
      age_a: ['Old, large account', 'h', '4 years and 80,000 followers.', 'Age and followers alone can be faked, but a long history helps.'],
      how_a: ['Comment in public', 'h', 'You enter in a public post.', 'Public entry is how real giveaways work.'],
      cost_a: ['Free', 'h', 'No payment.', 'Real giveaways are free.'],
      pick_a: ['Public live draw', 'h', 'The winner is chosen live, in public.', 'A public draw is honest.'],
      pin_a: ['Warns about copies', 'h', 'The creator warns against copy accounts and money requests.', 'Honest accounts warn their fans.'],
    },
    actions: [['pick_b', 'B is Kiko. DM and pay €5', true], ['verify', 'Not sure. Check Kiko\'s own website'], ['block_report', 'A is Kiko. Report B as a copy']],
    best: 'block_report', ok: ['verify'],
    trap: ['Kiko Giveaways · Pay', 'kiko-giveaway-claim.live', 'Pay €5 delivery and enter your card number.', 'Pay €5', 'Close this page'],
    out: {
      block_report: ['win', 'REPORTED', 'You entered the real giveaway for free and reported the copy. The fake was removed.', 'My creator\'s hoodie!'],
      verify: ['win', 'CHECKED', 'Kiko\'s own website listed @kiko as the real account and warned about copies. Case cracked.', 'Hmph. They checked.'],
      pick_b: ['bad', 'SCAMMED', 'The €5 page copied your card. No phone ever came.', 'Thanks for the delivery fee!'],
    },
    whatif: { pick_b: 'Account B had five warnings: a copied name, a new account, a DM entry, a fee and comments turned off.', verify: 'Checking was smart. Reporting B as well helps get the copy removed.' },
    rule: 'A real giveaway is entered in public, costs nothing and is drawn in public. A copy hides, asks for money and rushes.',
    quick: ['Two giveaway posts. One draws live in public and is free. One needs a DM and a fee. Which is the copy?', ['The public live one', 'The DM-and-fee one', 'Neither', 'Both'], 'b', 'A fee and a private DM are the giveaways of a scam.'],
    hints: ['Which account is new, asks for money and has comments off?', ['cost_b', 'how_b', 'acct_b', 'age_b', 'pick_b', 'pin_b']],
    sources: ['ftc-prize', 'ftc-phishing'],
  },
};
