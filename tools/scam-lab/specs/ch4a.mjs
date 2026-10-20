// Chapter 4: Fear & Panic, new cases (part A). Invented names only: Inspector Kale, Orrin Bank, Civic Revenue Portal, Vantel Mobile, Parcelo, Chirp.
import { chat, mail } from '../author.mjs';

export default {
  // 1 ---------------------------------------------------------------
  'digital-arrest-call': {
    type: 'hunt', diff: 2, disguise: 'admin', title: 'The Video Call Officer',
    intro: 'Your phone rings with a video call from someone in a police-style uniform. He says you are in serious trouble.',
    notify: ['Chirp', 'Cyber Crime Branch', 'Video call: serious case in your name'],
    screen: chat({
      app: 'chirp', name: '{name|Inspector Kale · Cyber Crime Branch}', sub: '{num|Unknown number · video call}', av: ['🛡️', 'badge'], banner: '{video|They called you first, on video}',
      context: 'You have never been contacted by any officer before.',
      items: [
        't: 2:14 PM',
        'm: A parcel in your name was caught with {parcel|illegal items}. A case is open against you.',
        'm: You are under {digital|"digital arrest"}. {stay|Stay on camera and do not leave this call.}',
        'm: {tell|Tell no one, not even your family. It is a secret investigation.}',
        'm: To close the case, move your savings to a {safe|"safe account"} for checking.',
      ],
    }),
    clues: {
      video: ['They called you, on video', 's', 'An officer you have never met calls you on video, out of the blue.', 'Official cases are not handled by a surprise video call.'],
      parcel: ['"A parcel in your name"', 's', 'A parcel you never sent, full of illegal items.', 'A parcel story is a common script.'],
      digital: ['"Digital arrest"', 's', 'You are told you are arrested, but only through a screen.', 'This is the scam the government warns about. Ending the call is always allowed.'],
      stay: ['"Stay on camera"', 's', 'They keep you on the call so you cannot check with anyone.', 'Keeping you on camera is how victims are controlled.'],
      tell: ['"Tell no one"', 's', 'You are told to keep it secret from your family.', 'Secrecy stops people helping you. Always tell someone.'],
      safe: ['"Move your money to a safe account"', 's', 'They want your savings moved to an account they give you.', 'No honest officer asks you to move money anywhere.'],
      name: ['A strong title and name', 'h', 'Inspector Kale of the Cyber Crime Branch.', 'A title is easy to say. It proves nothing.'],
      num: ['An unknown number', 'h', 'A number you do not know.', 'The number alone proves little.'],
      badge: ['A badge picture', 'h', 'A shield icon.', 'Badges and uniforms are easy to fake.'],
    },
    go: 'Do as the officer says and move the money', verify: 'End the call, then tell my family and call the helpline',
    report: 'End the call and report it on 1930',
    noIgnore: true,
    win: 'You ended the call and reported it on the cyber helpline. The number was traced and blocked.',
    checked: 'You ended the call and rang your family. They knew at once it was a scam and helped you report it. Case cracked.',
    lose: 'Your savings moved to a stranger\'s account while you sat in front of the camera. The "officer" vanished.',
    avoid: 'Ending the call and telling someone was always allowed. A real case is never closed by moving money.',
    rule: 'No one can arrest you through a screen. End the call, tell someone you trust, and report on the cyber helpline (1930 in India).',
    quick: ['A video call says you are under "digital arrest" and must stay on camera, tell no one and move your savings. What do you do?', ['Obey, the officer sounds serious', 'Obey but ask for a letter', 'End the call, tell your family and report it on the cyber helpline', 'Move only half the money'], 'c', 'Panic is the weapon. Ending the call and telling someone breaks the spell.'],
    nudge: 'Why would an officer tell you to keep a case secret?',
    sources: ['in-pib-alert', 'in-1930', 'ftc-government'],
    kit: {
      who: ['Check the caller', 'Inspector Kale', [['Called you first?', 'Yes, on video', 'video'], ['Asked you to stay on camera', 'Yes', 'stay'], ['Asked you to tell no one', 'Yes', 'tell']]],
      adv: ['What the government says', [['Criminals pose as police and other agencies', 'They claim a parcel or a relative, then demand money', 'parcel'], ['Where to report', 'The cyber helpline 1930, or cybercrime.gov.in']]],
    },
  },

  // 3 ---------------------------------------------------------------
  'customs-call': {
    type: 'hunt', diff: 2, disguise: 'admin', title: 'The Customs Call',
    intro: 'A call says a parcel in your name was stopped at the airport, with illegal items inside.',
    notify: ['Phone', 'Customs Desk', 'Your parcel was stopped with illegal items'],
    screen: chat({
      app: 'sms', name: '{name|Customs Desk}', sub: '{num|Unknown number}', context: 'You have not sent or expected any parcel abroad.',
      items: [
        't: Today 11:40 AM',
        'm: This is the {title|Customs Department}. A {parcel|parcel in your name} was stopped with {illegal|illegal items}.',
        'm: To avoid arrest, {pay|pay a clearance fee of ₹38,000} today.',
        'm: Press 1 to connect to the {officer|senior officer}. {noend|Do not hang up.}',
      ],
    }),
    clues: {
      parcel: ['A parcel you never sent', 's', 'You sent or expected nothing.', 'A parcel you know nothing about is the first thing to doubt.'],
      illegal: ['"Illegal items inside"', 's', 'A frightening claim with no proof.', 'Fear is used to stop you thinking.'],
      pay: ['A fee to avoid arrest', 's', 'You must pay ₹38,000 today.', 'No honest office takes money to "avoid arrest" on a phone call.'],
      officer: ['"Press 1 for the senior officer"', 's', 'They pass you up a ladder of "officers".', 'More "officers" make the story feel real. It is a script.'],
      noend: ['"Do not hang up"', 's', 'They want to keep you on the line.', 'Hanging up is always allowed.'],
      title: ['An official department name', 'h', 'The call says Customs Department.', 'Anyone can say a department\'s name.'],
      name: ['A formal sender name', 'h', 'Customs Desk.', 'A name proves nothing.'],
      num: ['An unknown number', 'h', 'A number you do not know.', 'The number alone proves little.'],
    },
    go: 'Press 1 and pay the fee', verify: 'Hang up and call the official customs office on a number I look up',
    report: 'Hang up and report it on 1930', noIgnore: true,
    win: 'You hung up and reported it. The number was traced and blocked.',
    checked: 'The official office said they had no parcel in your name. The call was a scam. Case cracked.',
    lose: 'The ₹38,000 went to a stranger. Then came a second "fee", and a third.',
    avoid: 'Hanging up and calling the real office would have ended it. A parcel you never sent is no case against you.',
    rule: 'A call that says a parcel was stopped and asks for money is a scam script. Hang up and check on a number you look up yourself.',
    quick: ['A call says a parcel in your name was stopped with illegal items and you must pay a fee to avoid arrest. What do you do?', ['Pay the fee to stay safe', 'Press 1 to talk to the officer', 'Hang up. Look up the office yourself and report the call', 'Ask for a written notice'], 'c', 'Fear is the lure. A real office does not take money by phone to avoid arrest.'],
    nudge: 'Did you send any parcel at all?',
    sources: ['in-pib-alert', 'in-1930', 'ftc-government'],
    kit: {
      who: ['Check the caller', 'Customs Desk', [['Parcels you sent', 'None', 'parcel'], ['Asked for money?', 'Yes, to avoid arrest', 'pay']]],
      adv: ['What the government says', [['Parcel with illegal goods claim', 'A pattern the government warns about', 'illegal'], ['Where to report', 'The cyber helpline 1930, or cybercrime.gov.in']]],
    },
  },

  // 5 ---------------------------------------------------------------
  'stay-on-camera': {
    type: 'duel', diff: 3, disguise: 'admin', title: 'Stay on Camera',
    intro: 'A caller says your SIM was used in a crime. He wants you on a video call and tells you to tell no one.',
    notify: ['Chirp', 'Officer Raman', 'Your SIM is linked to a serious case'],
    screen: chat({
      app: 'chirp', name: [{ text: 'Officer Raman · Cyber Cell', id: 'duel-name' }], sub: '{num|Unknown number}', av: ['🛡️', 'badge'], banner: 'Video call request',
    }),
    duel: {
      start: 'n1',
      nodes: {
        n1: {
          say: ['m: Your SIM was used for {crime|illegal money transfers}. A case is open. {arrest|You may be arrested today.}', 'm: Join the video call now and {stay|stay on camera}.'],
          replies: [['I did nothing. Why me?', 'n2'], ['Joining the call', 'n3'], ['I will hang up and report this', '!block_report']],
        },
        n2: {
          say: ['m: We have {proof|proof}. You can clear your name only by {co|cooperating}.', 'm: {secret|Tell no one. If you do, it is a crime.}'],
          replies: [['OK, I will cooperate', 'n3'], ['That is not how cases work. I am telling my family and ending this.', '!verify'], ['Hang up and report', '!block_report']],
        },
        n3: {
          say: ['m: Good. Now {verify|send your savings to our "safe account"} so we can check them. They will be returned after.', 'm: {rush|You have 20 minutes.}'],
          replies: [['Sending it now', '!go_ahead'], ['No. I am ending the call and calling the helpline.', '!block_report'], ['I will go to the police station in person', '!verify']],
        },
      },
    },
    clues: {
      num: ['An unknown number', 's', 'A stranger calling about a serious case.', 'Real cases do not begin with a surprise call.'],
      crime: ['A crime story', 's', 'Your SIM was supposedly used for illegal transfers.', 'A frightening story fits everyone.'],
      arrest: ['"You may be arrested today"', 's', 'A threat of arrest by phone.', 'Arrests do not happen through a screen.'],
      stay: ['"Stay on camera"', 's', 'They keep you watched.', 'Keeping you on camera is how victims are controlled.'],
      proof: ['"We have proof"', 's', 'They claim proof but show none.', 'No proof is shown because there is none.'],
      co: ['"Clear your name by cooperating"', 's', 'They make you feel guilty so you obey.', 'Guilt is a lever.'],
      secret: ['"Tell no one"', 's', 'Secrecy stops people helping you.', 'Always tell someone you trust.'],
      verify: ['"Send savings to a safe account"', 's', 'They want your money moved.', 'No honest officer asks you to move money.'],
      rush: ['20 minutes', 's', 'A deadline to stop you thinking.', 'Rushing is a pressure trick.'],
      badge: ['A badge picture', 'h', 'A shield icon.', 'Badges are easy to fake.'],
    },
    actions: [['go_ahead', 'Send the savings to the "safe account"'], ['verify', 'Tell my family and visit the police station in person'], ['block_report', 'End the call and report it on 1930']],
    best: 'block_report', ok: ['verify'],
    out: {
      block_report: ['win', 'BLOCKED', 'You ended the call and reported it. The number was traced and the account frozen.', 'Curses! Hung up on again!'],
      verify: ['win', 'CHECKED', 'At the station they said: no case, no arrest, no officer by that name. Case cracked.', 'Hmph. They checked.'],
      go_ahead: ['bad', 'SCAMMED', 'The savings moved to a stranger. The "officer" and the account disappeared.', 'Thanks for the savings!'],
    },
    whatif: { go_ahead: 'Telling one family member would have broken the spell. The secrecy was the trap.', verify: 'Going in person was safe. Reporting the call as well helps trace the number.' },
    rule: 'No one can arrest you through a screen, and no one honest says "tell no one". End the call and tell someone you trust.',
    quick: ['A caller says your SIM was used for a crime, keeps you on camera and tells you not to tell anyone. What is the best move?', ['Obey to clear your name', 'Obey but record the call', 'End the call, tell someone you trust and report it on 1930', 'Ask for his ID'], 'c', 'The secrecy is the clue. A trusted person ends the spell.'],
    hints: ['Why would a real officer ask you to keep it secret?', ['secret', 'stay', 'verify', 'arrest', 'rush', 'proof', 'crime', 'co']],
    sources: ['in-pib-alert', 'in-1930', 'ftc-government'],
    kit: {
      who: ['Check the caller', 'Officer Raman', [['Called you first?', 'Yes', 'num'], ['Asked you to tell no one', 'Yes', 'secret'], ['Asked for money', 'Yes, "safe account"', 'verify']]],
      adv: ['What the government says', [['Criminals pose as police and keep victims on video calls', 'Yes, they warn about it', 'stay'], ['Where to report', 'The cyber helpline 1930']]],
    },
  },

  // 6 ---------------------------------------------------------------
  'tax-notice': {
    type: 'hunt', diff: 2, disguise: 'admin', title: 'The Tax Notice',
    intro: 'An email says you owe tax and a penalty will be added unless you pay through a link today.',
    notify: ['Mail', 'Civic Revenue Portal', 'Final notice: unpaid tax. Pay now.'],
    screen: mail({
      from: '{from|Civic Revenue Portal}', addr: '{addr|notice@civic-revenue-pay.com}', subject: '{subject|FINAL NOTICE: unpaid tax, pay now}', time: '7:30 AM',
      items: [
        'p: {greet|Dear Taxpayer,}',
        'p: You owe {amount|$642.30} in unpaid tax. {penalty|A penalty of $200 will be added at midnight.}',
        'p: {link|Pay now|link}',
        'p: {arrest|Failure to pay may lead to legal action and arrest.}',
        'foot: Civic Revenue Portal',
      ],
    }),
    clues: {
      addr: ['Not an official address', 's', 'It comes from civic-revenue-pay.com, not a government address.', 'Government offices do not send payment requests from addresses like this.'],
      penalty: ['Penalty at midnight', 's', 'A deadline and a penalty.', 'A hard deadline stops you thinking.'],
      link: ['A "pay now" link', 's', 'The button goes to a payment page that is not official.', 'Pay taxes only on the official site you type yourself.'],
      arrest: ['"Legal action and arrest"', 's', 'A threat of arrest over a bill.', 'Fear is the lure.'],
      greet: ['"Dear Taxpayer"', 'h', 'No name.', 'Vague greetings are common, but not proof of a scam alone.'],
      amount: ['A specific amount', 'h', '$642.30.', 'A specific number can be invented.'],
      from: ['An official-sounding name', 'h', 'Civic Revenue Portal.', 'Names are easy to copy.'],
      subject: ['Capital letters', 'h', 'FINAL NOTICE in capitals.', 'Shouting proves nothing alone.'],
    },
    go: 'Click Pay now', trap: ['Civic Revenue · Pay', 'civic-revenue-pay.com/pay', 'Enter your card number to pay $642.30 and avoid the penalty.', 'Pay $642.30', 'Close this page'],
    verify: 'Check my tax account on the official website I type myself',
    win: 'Reported as phishing and deleted. The fake address was blocked.',
    checked: 'Your official tax account showed nothing owed. The email was fake. Case cracked.',
    lose: 'The page copied your card details. The "tax" was never owed, and the charges kept coming.',
    avoid: 'Your official account would have shown nothing owed. Government offices do not threaten arrest by email.',
    rule: 'Check any tax bill on the official website you type yourself. Never pay through an email link.',
    quick: ['An email says you owe tax and will be arrested unless you pay through a link. What do you do?', ['Pay, to avoid arrest', 'Reply asking for a copy', 'Do not click. Check on the official website you type yourself, and report it', 'Forward it to a friend'], 'c', 'Fear is the lure. Your real account shows the truth.'],
    nudge: 'Look at the address the email really came from.',
    sources: ['ftc-government', 'ftc-phishing'],
    kit: {
      who: ['Check sender', 'Who really sent this', [['Address', 'notice@civic-revenue-pay.com', 'addr'], ['A real government address', 'Ends in .gov or the official domain']]],
      adv: ['What advice says', [['Do government offices threaten arrest by email?', 'Never', 'arrest'], ['How to check a bill', 'Use the official site you type yourself']]],
    },
  },

  // 8 ---------------------------------------------------------------
  'real-summons': {
    type: 'hunt', diff: 3, honest: true, title: 'The Official Letter',
    intro: 'A letter arrives by post from a court. After today, any official letter feels like a trap.',
    notify: ['Post', 'Registered letter', 'A letter from the Civic Court'],
    screen: mail({
      from: 'Civic Court Registry', addr: '{post|By registered post, to your home address}', subject: '{subject|Notice of a hearing, case 2026/5521}', time: 'Delivered today',
      items: [
        'p: {name|Mr T. Civet,}',
        'p: You are asked to {attend|attend a hearing on 12 November at 10:00 AM} at the Civic Court, Room 4.',
        'p: You can {check|check the case on the court\'s official website} using the case number above.',
        'p: {nopay|No payment is asked of you in this letter.}',
        'foot: {sign|Signed by the Registrar, with the court\'s stamp}',
      ],
    }),
    clues: {
      post: ['Arrived by post', 'h', 'A registered letter to your home, not a call or a link.', 'Courts use official post. A surprise call is a different matter.'],
      subject: ['A case number', 'h', 'A number you can check on the court\'s official website.', 'You can look it up yourself. A scammer\'s number cannot be found.'],
      name: ['Your full name', 'h', 'Your name and details are right.', 'It fits, though a name alone proves little.'],
      attend: ['A hearing date and place', 'h', 'A date, time and room.', 'Real notices give a date and place you can attend.'],
      check: ['Check on the official site', 'h', 'It tells you to check on the court\'s own website.', 'Honest notices let you check.'],
      nopay: ['Asks for no money', 'h', 'No payment.', 'No demand for money fits an honest notice.'],
      sign: ['Signed and stamped', 'h', 'A registrar\'s signature and stamp.', 'Stamps can be copied, so check the case number too.'],
    },
    go: 'Check the case number on the court\'s official website I type myself', good: 'The court\'s own website listed the case and the hearing. You prepared and went, with no payment asked.',
    ignored: 'Nothing bad happened this time. But a real court notice must not be ignored: missing a hearing has consequences.',
    falseAlarm: 'That was a real court notice. A real hearing missed can mean real trouble. Checking, not ignoring, is the skill.',
    calm: 'It arrived by post, gave a case number you can check, asked for no money and invited you to a place and date. That is how real notices look.',
    rule: 'A real notice arrives by official post, asks for no money and lets you check the case number yourself. Check, do not ignore.',
    quick: ['What made this court letter genuine?', ['It was stamped', 'It arrived by post, gave a checkable case number and asked for no money', 'It named the court', 'It was in an envelope'], 'b', 'Stamps can be copied. A checkable case number and no money are the real signs.'],
    sources: ['ftc-government', 'in-pib-alert'],
    kit: {
      who: ['Check the letter', 'Letter check', [['Arrived by', 'Registered post', 'post'], ['Case number', 'Check on the court\'s own website', 'subject'], ['Payment asked?', 'No', 'nopay']]],
      adv: ['What advice says', [['Is a real notice checkable?', 'Yes, on the official website you type yourself', 'check'], ['Do real notices ask for money by call or link?', 'No']]],
    },
  },

  // 10 --------------------------------------------------------------
  'sim-blocked': {
    type: 'duel', diff: 3, disguise: 'admin', title: 'Your SIM Will Be Blocked',
    intro: 'A caller from "the cyber police" says your SIM was misused and will be blocked in two hours.',
    notify: ['Messages', 'Cyber Police', 'Your SIM will be blocked in 2 hours'],
    screen: chat({
      app: 'sms', name: [{ text: 'Cyber Police Unit', id: 'duel-name' }], sub: '{num|Unknown number}', av: ['🛡️', 'badge'], banner: 'Text after a phone call',
    }),
    duel: {
      start: 'n1',
      nodes: {
        n1: {
          say: ['m: Your SIM was {misuse|misused for illegal calls}. It will be {block|blocked in 2 hours}.', 'm: To keep it active, press 1 or text your {idno|ID details} to this number.'],
          replies: [['I did not do anything. Please do not block it.', 'n2'], ['Sending my details', 'n3'], ['I will call my phone company myself', '!verify']],
        },
        n2: {
          say: ['m: We can stop the block. {pay|Pay a ₹2,500 verification fee} and give the {otp|code we send}.', 'm: {rush|Only 90 minutes left.}'],
          replies: [['OK, paying and sharing the code', 'n3'], ['A fee and a code for a "verification"? I will call my phone company.', '!verify'], ['Report this number', '!block_report']],
        },
        n3: {
          say: ['m: Good. Your {done|SIM is safe}. Now your account will be checked: {bank|send the code your bank texts you}.'],
          replies: [['Sending it', '!go_ahead'], ['Stop. I am reporting this.', '!block_report'], ['I will call my phone company', '!verify']],
        },
      },
    },
    clues: {
      num: ['An unknown number', 's', 'A stranger claiming to be police.', 'Real police do not start with an unknown text.'],
      misuse: ['A "misuse" story', 's', 'They say your SIM was used for illegal calls, with no proof.', 'A frightening story with no proof.'],
      block: ['"Blocked in 2 hours"', 's', 'A countdown to blocking.', 'Deadlines are pressure.'],
      idno: ['Asks for your ID details', 's', 'They want your ID details by text.', 'Never send ID details to a number that contacted you.'],
      pay: ['A fee to avoid blocking', 's', 'You must pay ₹2,500.', 'No honest office charges to keep a SIM active by phone.'],
      otp: ['Asks for the code', 's', 'They want the code sent to you.', 'A code is a key to your account. Never share it.'],
      rush: ['Only 90 minutes', 's', 'The deadline shrinks.', 'Rushing is a pressure trick.'],
      done: ['"Your SIM is safe"', 'h', 'A friendly reassurance.', 'Reassurance after a threat is a trick.'],
      bank: ['"Send your bank code"', 's', 'Now they ask for your bank code.', 'The bank code is the real prize.'],
      badge: ['A badge picture', 'h', 'A shield icon.', 'Badges are easy to fake.'],
    },
    actions: [['go_ahead', 'Send the bank code'], ['verify', 'Call my phone company on the number on my bill'], ['block_report', 'Block the number and report it on 1930']],
    best: 'block_report', ok: ['verify'],
    out: {
      block_report: ['win', 'BLOCKED', 'You blocked and reported it. The number was traced and blocked.', 'Curses! Blocked again!'],
      verify: ['win', 'CHECKED', 'Your phone company said: nothing is wrong with your SIM, and they never block lines through such texts. Case cracked.', 'Hmph. They checked.'],
      go_ahead: ['bad', 'SCAMMED', 'The code gave them your account. It was emptied within minutes, and your SIM was never in danger.', 'Thanks for the code!'],
    },
    whatif: { go_ahead: 'Calling your phone company on the number on your bill would have shown the SIM was fine.', verify: 'Checking was smart. Reporting the number as well protects others.' },
    rule: 'A call or text that threatens to block your SIM and asks for money, ID or a code is a scam. Check with your company on the number on your bill.',
    quick: ['A "cyber police" caller says your SIM will be blocked in two hours unless you pay a fee and share a code. What do you do?', ['Pay and share the code', 'Share only the code', 'Hang up. Call your phone company yourself, and report the number', 'Ask for a written order'], 'c', 'A threat plus a fee plus a code is a scam. Your phone company tells the truth.'],
    hints: ['What do they want from you besides the SIM?', ['pay', 'otp', 'idno', 'bank', 'block', 'rush', 'misuse', 'num']],
    sources: ['in-pib-alert', 'in-rbi-beaware', 'in-1930'],
    kit: {
      who: ['Check the caller', 'Cyber Police Unit', [['Called you first?', 'Yes', 'num'], ['Asked for money', '₹2,500', 'pay'], ['Asked for a code', 'Yes', 'otp']]],
      adv: ['What advice says', [['Does anyone honest need your OTP?', 'Never', 'otp'], ['Where to report', 'The cyber helpline 1930']]],
    },
  },
};
