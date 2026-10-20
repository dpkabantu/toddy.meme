// Chapter 6: Love & Long Cons, new cases (part A). Invented names only: Heartlane (dating app), Chirp, Orrin Bank, Plenvo.
import { chat, mail } from '../author.mjs';

export default {
  // 1 ---------------------------------------------------------------
  'dating-switch': {
    type: 'hunt', diff: 1, disguise: 'friend', title: 'The Perfect Match',
    intro: 'You matched with someone on a dating app. The conversation is lovely, and then it moves quickly.',
    notify: ['Heartlane', 'Sofia', 'Let us move to the messaging app 💕'],
    screen: chat({
      app: 'chirp', name: '{name|Sofia, 29}', sub: '{profile|Matched 20 minutes ago}', av: ['💕', 'pic'], banner: 'Heartlane dating app',
      items: [
        't: 8:14 PM',
        'm: Hi handsome! 😍 You seem {special|so special}. I feel like I {known|have known you for years}.',
        'm: This app is boring. {move|Let us move to the messaging app}, my number is below.',
        'm: {fast|I think I am falling for you already.} 💕',
        'm: {nopic|I am shy about photos and calls, we will talk by text.}',
      ],
    }),
    clues: {
      special: ['Instant flattery', 's', '"So special" after 20 minutes.', 'Fast flattery is a way to lower your guard.'],
      known: ['"I have known you for years"', 's', 'A strong bond after minutes.', 'Real bonds take time.'],
      move: ['Move off the app quickly', 's', 'They want you away from the app\'s safety tools.', 'Scammers move you to private chat fast.'],
      fast: ['Falling in love already', 's', 'A declaration after minutes.', 'Love bombing is a tactic.'],
      nopic: ['No photos or calls', 's', 'They avoid showing themselves.', 'A person who never appears on camera may not be real.'],
      name: ['A name and an age', 'h', 'Sofia, 29.', 'A profile proves nothing.'],
      profile: ['Matched recently', 'h', 'A fresh match.', 'Fresh matches are normal.'],
      pic: ['Heart picture', 'h', 'A heart icon.', 'Pictures prove nothing.'],
    },
    go: 'Move to the messaging app and keep chatting', verify: 'Ask for a video call first, and stay on the app',
    report: 'Stop chatting and report the profile', noIgnore: true,
    win: 'You reported the profile. The app removed it before it reached more people.',
    checked: 'You asked for a video call. The profile gave excuses and vanished. Case cracked.',
    lose: 'The "match" became a close friend in a week, then needed money for an emergency.',
    avoid: 'Insisting on a video call, and staying on the app, were the exits. Love does not rush you off a safe app.',
    rule: 'A match who flatters you fast and moves you off the app is a warning. Ask for a video call, and report if they refuse.',
    quick: ['A new match flatters you, says they are falling for you and wants to move to a private app. What do you do?', ['Move, it is romantic', 'Move but stay careful', 'Stay on the app, ask for a video call, and report if they refuse', 'Send a photo to build trust'], 'c', 'Fast love and a fast move are the pattern.'],
    nudge: 'How fast did the love arrive, and where do they want to chat?',
    sources: ['ftc-romance'],
    kit: {
      who: ['Check the profile', 'Sofia, 29', [['Matched', '20 minutes ago', 'profile'], ['Wants to move to', 'A private app', 'move'], ['Will they do a video call?', 'No', 'nopic']]],
      adv: ['What advice says', [['Pressure to move off the platform', 'A red flag', 'move'], ['Never send money', 'To an online love interest']]],
    },
  },

  // 3 ---------------------------------------------------------------
  'hi-mum': {
    type: 'hunt', diff: 2, disguise: 'friend', title: 'Hi Mum, New Number',
    intro: 'A message arrives from an unknown number. It says it is your child, with a new phone.',
    notify: ['Messages', 'Unknown number', 'Hi Mum, my phone broke, this is my new number'],
    screen: chat({
      app: 'sms', name: '{num|Unknown number}', context: 'You are a parent. Your child\'s real number is saved in your contacts.',
      items: [
        't: Today 5:48 PM',
        'm: {hi|Hi Mum}, my phone broke. {newnum|This is my new number.}',
        'm: Can you do me a {fav|quick favour}? I cannot use my banking app on the new phone.',
        'm: Please pay this bill for me, {urgent|it is due today}: {acct|$370 to the account below}.',
        'm: {nocall|I cannot talk, I am in a meeting. I will explain later.}',
      ],
    }),
    clues: {
      newnum: ['A "new number"', 's', 'You have the real number saved.', 'Check by calling the number you already have.'],
      fav: ['A "favour" about money', 's', 'The first real request is money.', 'Strangers using family names ask for money first.'],
      urgent: ['Due today', 's', 'A deadline.', 'Pressure is a trick.'],
      acct: ['A stranger\'s account number', 's', 'Money to an account you do not know.', 'Never pay an account a "relative" sends by text.'],
      nocall: ['Cannot talk or call', 's', 'They avoid hearing from you.', 'A real child will answer a call.'],
      num: ['An unknown number', 'h', 'A number you do not know.', 'A new number can be real, so check, do not guess.'],
      hi: ['"Hi Mum"', 'h', 'A friendly greeting.', 'It is a guess that fits many parents.'],
    },
    go: 'Pay the bill', verify: 'Call my child on the number I already have',
    report: 'Report and delete the message', noIgnore: false,
    win: 'Reported and deleted. Your phone company can block the number.',
    checked: 'You called the old number. Your child answered at once, safe and puzzled. Case cracked.',
    lose: 'The $370 went to a stranger. Your child had lost nothing.',
    avoid: 'One call to the number you already have would have ended it. A message is not proof.',
    rule: 'If a "relative" texts from a new number and wants money, call their old number first.',
    quick: ['A text from a new number says "Hi Mum, my phone broke" and asks you to pay a bill. What do you do?', ['Pay, it is urgent', 'Reply with questions', 'Call your child on the number you already have', 'Send half'], 'c', 'Call the old number. A real child answers.'],
    nudge: 'How can you check without trusting the message?',
    sources: ['ftc-family', 'ftc-gift-cards'],
    kit: {
      who: ['Check the message', 'Unknown number', [['A number you know?', 'No', 'newnum'], ['Asks for', '$370', 'acct'], ['Will they call?', 'No, "in a meeting"', 'nocall']]],
      adv: ['What advice says', [['A relative in need?', 'Check on a number you already know', 'newnum'], ['A message asking for money fast', 'A scam sign', 'urgent']]],
    },
  },

  // 6 ---------------------------------------------------------------
  'no-video': {
    type: 'hunt', diff: 2, disguise: 'friend', title: 'Camera Broken',
    intro: 'You have chatted with the same person for weeks. Every time you ask for a video call, there is a reason.',
    notify: ['Chirp', 'Marco', 'My camera is broken again 😔'],
    screen: chat({
      app: 'chirp', name: '{name|Marco, 34}', sub: '{profile|Chatting for 6 weeks}', av: ['🌍', 'pic'], banner: 'Private chat',
      items: [
        't: 9:02 PM',
        'm: I would love to {call|see you on video}, but my {excuse|camera is broken}. Again! 😔',
        'm: And my {mic|microphone does not work either}. So text is best.',
        'm: By the way, {money|my bank card is blocked abroad}. Could you send me a little for {why|a new phone and a ticket to visit you}?',
        'm: {trust|You are the only one I trust.}',
      ],
    }),
    clues: {
      call: ['They will not appear on video', 's', 'For six weeks, never once.', 'A person who never appears on camera may not be real.'],
      excuse: ['An excuse for no camera', 's', 'The camera is "broken".', 'Excuses are tools.'],
      mic: ['No voice either', 's', 'No camera and no voice.', 'Never speaking is a red flag.'],
      money: ['A money request', 's', 'A blocked bank card, so they need yours.', 'Never send money to someone you have not met.'],
      why: ['A ticket to visit you', 's', 'A tempting reason to help.', 'The reason is made to feel kind.'],
      trust: ['"You are the only one I trust"', 's', 'They make you feel special and responsible.', 'Guilt and trust are levers.'],
      name: ['A name and an age', 'h', 'Marco, 34.', 'A profile proves nothing.'],
      profile: ['Weeks of chatting', 'h', 'A long conversation.', 'Time alone does not prove it is real. Scammers are patient.'],
      pic: ['Globe picture', 'h', 'A little globe.', 'Pictures prove nothing.'],
    },
    go: 'Send him the money for the phone and ticket', verify: 'Insist on a video call, and send nothing until we meet',
    report: 'Stop, send nothing and report the profile', noIgnore: true,
    win: 'You stopped and reported. The profile was removed, and you lost nothing.',
    checked: 'You said no money until a video call. The chat went quiet and the profile vanished. Case cracked.',
    lose: 'The money was lost. Then there was "customs" trouble and another request, then another.',
    avoid: 'Never sending money to someone you have not met was the exit. A broken camera for six weeks is a warning.',
    rule: 'Never send money to someone you have not met in person, however long you have chatted.',
    quick: ['After six weeks of chat, a person with a "broken camera" asks you for money. What do you do?', ['Send a little, they need help', 'Send it, you trust them', 'Send nothing. Report the profile', 'Ask a friend to send it'], 'c', 'Never send money to someone you have not met. A long chat is not proof.'],
    nudge: 'In six weeks, have you ever seen or heard them?',
    sources: ['ftc-romance', 'ftc-gift-cards'],
    kit: {
      who: ['Check the profile', 'Marco, 34', [['Video call ever?', 'Never, "camera broken"', 'call'], ['Voice ever?', 'No, "mic broken"', 'mic'], ['Asked for money?', 'Yes', 'money']]],
      adv: ['What advice says', [['Send money to an online love interest?', 'Never', 'money'], ['Living far away, and asking for money', 'Red flags']]],
    },
  },

  // 7 ---------------------------------------------------------------
  'ship-engineer': {
    type: 'hunt', diff: 2, disguise: 'friend', title: 'The Ship Engineer',
    intro: 'Someone you met online works on a ship far away. He says he wants to visit you, but needs help first.',
    notify: ['Chirp', 'Arvind (ship engineer)', 'I need $600 for my leave papers…'],
    screen: chat({
      app: 'chirp', name: '{name|Arvind, ship engineer}', sub: '{where|At sea, "no network on deck"}', av: ['🚢', 'pic'], banner: 'Private chat',
      context: 'You have been chatting online for four weeks. You have never spoken or met.',
      items: [
        't: 11:20 PM',
        'm: My darling, my leave is approved! But the {papers|leave papers need $600}.',
        'm: My salary is {stuck|stuck until I reach port}. Can you send it now?',
        'm: I will {repay|repay you double} when I see you.',
        'm: {rush|The office closes tomorrow.} {love|I love you, please do not let me down.}',
      ],
    }),
    clues: {
      papers: ['Money for "leave papers"', 's', 'A real employer handles its own paperwork.', 'Needing money for papers is a classic story.'],
      stuck: ['Salary "stuck"', 's', 'A reason why he cannot pay himself.', 'A reason that needs your money is a warning.'],
      repay: ['"I will repay double"', 's', 'A promise to win trust.', 'A promise to repay is bait.'],
      rush: ['The office closes tomorrow', 's', 'A deadline.', 'Pressure is a trick.'],
      love: ['Emotional pressure', 's', '"Do not let me down."', 'Guilt and love are levers.'],
      where: ['"At sea, no network"', 's', 'He is conveniently unreachable.', 'Being unreachable keeps you from checking.'],
      name: ['A job and a name', 'h', 'Arvind, ship engineer.', 'A job title proves nothing.'],
      pic: ['Ship picture', 'h', 'A little ship.', 'Pictures prove nothing.'],
    },
    go: 'Send the $600', verify: 'Say I will only help after we meet in person and a video call',
    report: 'Send nothing and report the profile', noIgnore: true,
    win: 'You sent nothing and reported the profile. It was removed.',
    checked: 'You asked for a video call and a name of his company. He had no answers, and the chat ended. Case cracked.',
    lose: 'The $600 was lost. A "customs fee" and an "airport fee" followed.',
    avoid: 'Never sending money to someone you have not met, and asking for a video call, would have stopped it.',
    rule: 'Someone far away, working at sea or abroad, who needs money for papers is the classic romance scam. Send nothing.',
    quick: ['An online love interest says he is a ship engineer and needs $600 for leave papers. What do you do?', ['Send it, he will repay', 'Send half', 'Send nothing. Report the profile', 'Ask him to send papers first'], 'c', 'Working far away and needing money for papers is the classic story.'],
    nudge: 'Why can he not pay for his own papers?',
    sources: ['ftc-romance', 'ftc-gift-cards'],
    kit: {
      who: ['Check the profile', 'Arvind', [['Met in person?', 'Never'], ['Where?', 'At sea, "no network"', 'where'], ['Asked for', '$600', 'papers']]],
      adv: ['What advice says', [['Working far away, needing money', 'A romance scam red flag', 'papers'], ['Never send money', 'To someone you have not met']]],
    },
  },

  // 8 ---------------------------------------------------------------
  'show-you-earn': {
    type: 'duel', diff: 3, disguise: 'friend', title: 'Let Me Show You How I Earn',
    intro: 'A friendship online has turned warm. Now your friend shows you how he makes money.',
    notify: ['Chirp', 'Leo', 'Look at my profits this week! 📈'],
    screen: chat({
      app: 'chirp', name: [{ text: 'Leo (friend from the app)', id: 'duel-name' }], sub: '{met|Chatting for 3 weeks, never met}', av: ['📈', 'logo'], banner: 'Private chat',
    }),
    duel: {
      start: 'n1',
      nodes: {
        n1: {
          say: ['m: I have a secret. I earn {earn|$1,000 a week} by trading on a special platform.', 'm: {shot|Look: [screenshot of a big balance]} I can teach you, just because I care.'],
          replies: [['Tell me more', 'n2'], ['I will start with a little', 'n3'], ['That sounds like a scam. I will stop here.', '!block_report']],
        },
        n2: {
          say: ['m: It is {safe|very safe}, I have a private tip from an "insider". {rule|Start with just $100.}', 'm: {rush|The tip is only for today.}'],
          replies: [['OK, starting', 'n3'], ['I will check the platform on my own first', '!verify'], ['Stop and report', '!block_report']],
        },
        n3: {
          say: ['m: Great! Your first {win|profit of $25} is in. You can withdraw any time.', 'm: Put in {more|$500} to unlock the higher tier. {friend|I did it, so trust me.}'],
          replies: [['Adding $500', '!go_ahead'], ['No. Reporting this.', '!block_report'], ['I will try to withdraw first and check with my bank', '!verify']],
        },
      },
    },
    clues: {
      met: ['Never met in person', 's', 'Three weeks of chat only.', 'Do not invest with someone you have not met.'],
      earn: ['Huge weekly earnings', 's', '$1,000 a week.', 'Huge fast earnings are the bait.'],
      shot: ['A screenshot of a balance', 's', 'Anyone can make one.', 'Never trust a screenshot.'],
      safe: ['"Very safe" and an insider tip', 's', 'No investment is safe or guaranteed.', 'There are no guaranteed returns.'],
      rule: ['Start small', 's', 'A small start builds trust.', 'The small win is the hook.'],
      rush: ['Only for today', 's', 'A deadline.', 'Pressure is a trick.'],
      win: ['A small early profit', 's', 'It shows a profit on their screen.', 'A profit on their screen is not money you can take.'],
      more: ['"Put in more to unlock"', 's', 'More money to reach a "tier".', 'Scammers keep asking for more.'],
      friend: ['"Trust me, I did it"', 's', 'A friendship used as proof.', 'Trust built online can be fake.'],
      logo: ['Chart picture', 'h', 'A little chart.', 'Pictures prove nothing.'],
    },
    actions: [['go_ahead', 'Add $500'], ['verify', 'Check the platform on my own, and try a withdrawal first'], ['block_report', 'Stop, block and report']],
    best: 'block_report', ok: ['verify'],
    out: {
      block_report: ['win', 'BLOCKED', 'You stopped and reported. The account was removed, and you lost nothing.', 'Curses! Blocked again!'],
      verify: ['win', 'CHECKED', 'The platform was not registered anywhere, and withdrawals did not work. You stopped in time. Case cracked.', 'Hmph. They checked.'],
      go_ahead: ['bad', 'SCAMMED', 'The $500 vanished. The platform locked your account and "Leo" disappeared.', 'Thanks for the investment!'],
    },
    whatif: { go_ahead: 'No honest friend brings you a "secret platform" after three weeks. A withdrawal test would have shown the trap.', verify: 'Checking was smart. Reporting the account as well helps others.' },
    rule: 'A friend you have never met who shows you how to earn is a scam. There are no guaranteed returns.',
    quick: ['An online friend you have never met shows you a trading platform and a big balance. What do you do?', ['Start with a little', 'Start with a lot', 'Do not invest. Block and report', 'Ask for another screenshot'], 'c', 'Never invest on a "friend\'s" tip you cannot check.'],
    hints: ['Have you ever met this friend, and who gains?', ['met', 'earn', 'shot', 'safe', 'more', 'rule', 'rush', 'win', 'friend']],
    sources: ['ftc-invest-social', 'ftc-romance'],
    kit: {
      who: ['Check the friend', 'Leo', [['Met in person?', 'Never', 'met'], ['Shown', 'A screenshot of a balance', 'shot']]],
      adv: ['What advice says', [['Guaranteed returns?', 'None exist', 'safe'], ['Social media investing', 'Research it and contact your friend another way']]],
    },
  },

  // 9 ---------------------------------------------------------------
  'real-visit': {
    type: 'hunt', diff: 2, honest: true, title: 'The Visit',
    intro: 'A long-distance friend wants to visit you. You have been burned by "friends" today, so you are wary.',
    notify: ['Chirp', 'Nora', 'I booked my trip to visit you! ✈️'],
    screen: chat({
      app: 'chirp', name: '{name|Nora}', sub: '{old|Friends for 3 years, met twice}', av: ['✈️', 'pic'], banner: 'Private chat',
      context: 'You and Nora met at a conference, and have video-called many times.',
      items: [
        't: 7:30 PM',
        'm: I booked my trip! I land on {when|the 14th at 3 PM}. ✈️',
        'm: I will {stay|stay at a hotel}, so no need to arrange anything.',
        'm: {call|Can we do a video call on Sunday to plan the day?}',
        'm: {nomoney|I do not need anything from you, just a coffee together.}',
      ],
    }),
    clues: {
      name: ['A friend\'s name', 'h', 'Nora.', 'A name alone proves nothing.'],
      old: ['Friends for three years', 'h', 'A long history, with two real meetings.', 'Real friendships have real history.'],
      when: ['A clear plan', 'h', 'A date and a time.', 'Specific plans are honest.'],
      stay: ['She pays her own way', 'h', 'She arranges her own stay.', 'No burden on you.'],
      call: ['Offers a video call', 'h', 'She suggests a video call.', 'A real friend is happy to appear on camera.'],
      nomoney: ['Asks for nothing', 'h', 'She wants only a coffee.', 'A message that asks for nothing is usually honest.'],
      pic: ['Plane picture', 'h', 'A little plane.', 'Pictures prove nothing.'],
    },
    go: 'Have the video call on Sunday and plan the coffee', good: 'The video call was warm and normal. Nora came, you shared a coffee, and nobody asked for a thing.',
    ignored: 'Nothing bad happened. But a real friend\'s trip deserves a reply.',
    falseAlarm: 'That was a real friend. When every message looks like a scam, real friendships get hurt too.',
    calm: 'You have met, you have video-called, she pays her own way, offers a call and asks for nothing. That is how real friends look.',
    rule: 'A real friend has history, appears on video, pays their own way and asks for nothing.',
    quick: ['What made Nora\'s message honest?', ['She said she loved you', 'A real history, a video call offered, and no request for money', 'She used an emoji', 'She is far away'], 'b', 'History, video and no money requested are the real signs.'],
    sources: ['ftc-romance', 'ftc-gift-cards'],
    kit: {
      who: ['Check the friend', 'Nora', [['Met in person?', 'Twice', 'old'], ['Video calls?', 'Many, and she offers another', 'call'], ['Asks for money?', 'No', 'nomoney']]],
      adv: ['What advice says', [['Never send money to someone you have not met', 'Nora asks for none'], ['A real friend', 'Appears on video and has history', 'call']]],
    },
  },

  // 10 --------------------------------------------------------------
  'voice-clone': {
    type: 'duel', diff: 3, disguise: 'friend', title: 'It Sounds Just Like Her',
    intro: 'A call comes in. The voice sounds exactly like your sister, and she sounds terrified.',
    notify: ['Phone', 'Unknown number', '"It is me, I am in trouble…"'],
    screen: chat({
      app: 'sms', name: [{ text: 'Call from an unknown number', id: 'duel-name' }], sub: '{num|Number you do not know}', av: ['📞', 'logo'], banner: 'The voice sounds like your sister',
    }),
    duel: {
      start: 'n1',
      nodes: {
        n1: {
          say: ['m: "It is me, I am in {trouble|serious trouble}. I had an accident and {cry|I am crying}."', 'm: "A man will explain. {money|Please do what he says}."'],
          replies: [['Which hospital? Tell me your safe word', 'n2'], ['Tell me what to do', 'n3'], ['I will hang up and call my sister myself', '!verify']],
        },
        n2: {
          say: ['m: "{safe|I cannot remember, I am so scared.}" The man takes the phone: "She needs £400 now, or it will get worse."', 'm: {rush|You have 15 minutes.} {secret|Do not tell your parents.}'],
          replies: [['OK, I will send it', 'n3'], ['No. A real sister would know our safe word. I am calling her.', '!verify'], ['Hang up and report', '!block_report']],
        },
        n3: {
          say: ['m: "Send it to this account. {gift|Or buy gift cards and read me the codes.}"'],
          replies: [['Sending the money', '!go_ahead'], ['I am hanging up and calling my sister', '!verify'], ['Report', '!block_report']],
        },
      },
    },
    clues: {
      num: ['An unknown number', 's', 'Your sister would call from her own number.', 'Check by calling her own number.'],
      trouble: ['A crisis', 's', 'An accident and tears.', 'Shock is the weapon.'],
      cry: ['A crying voice', 's', 'Crying makes it hard to question.', 'Emotion is the tool.'],
      money: ['"Do what the man says"', 's', 'A stranger takes control.', 'A real emergency does not go through a stranger.'],
      safe: ['No safe word', 's', 'She cannot answer your safe word.', 'A family safe word proves who is on the line.'],
      rush: ['15 minutes', 's', 'A deadline.', 'Pressure is a trick.'],
      secret: ['"Do not tell your parents"', 's', 'Secrecy blocks the check.', 'Always tell the family.'],
      gift: ['"Gift cards and codes"', 's', 'Only scammers want gift cards.', 'No honest person asks for gift card codes.'],
      logo: ['Phone picture', 'h', 'A little phone.', 'Pictures prove nothing.'],
    },
    actions: [['go_ahead', 'Send the money'], ['verify', 'Hang up and call my sister on her own number'], ['block_report', 'Hang up and report the call']],
    best: 'block_report', ok: ['verify'],
    out: {
      block_report: ['win', 'BLOCKED', 'You hung up and reported the call. The number was blocked.', 'Curses! Hung up on again!'],
      verify: ['win', 'CHECKED', 'Your sister picked up at once. She was at work, perfectly safe. Case cracked.', 'Hmph. They checked.'],
      go_ahead: ['bad', 'SCAMMED', 'The voice was a copy made by a computer from a short clip. The money was gone.', 'Thanks for the cash!'],
    },
    whatif: { go_ahead: 'A voice can be copied from a short clip. A family safe word, or a call to her own number, beats any copy.', verify: 'Checking was smart. Reporting the number as well protects other families.' },
    rule: 'A voice can be copied. Agree a family safe word, and always hang up and call back on the number you know.',
    quick: ['A call with your sister\'s voice says she is in trouble and a man wants money. What do you do?', ['Send the money fast', 'Ask the man for proof', 'Hang up and call her on her own number', 'Pay half'], 'c', 'Voices can be copied. Call back on a number you know.'],
    hints: ['How can you prove who is really on the line?', ['safe', 'num', 'money', 'secret', 'rush', 'gift', 'trouble', 'cry']],
    sources: ['ftc-family', 'ftc-gift-cards'],
    kit: {
      who: ['Check the call', 'Unknown number', [['Her own number?', 'No', 'num'], ['Answers the safe word?', 'No', 'safe'], ['Wants', 'Money or gift card codes', 'gift']]],
      adv: ['What advice says', [['A relative in trouble?', 'Check on a number you already know', 'num'], ['Gift cards for payment', 'Only scammers ask', 'gift']]],
    },
  },
};
