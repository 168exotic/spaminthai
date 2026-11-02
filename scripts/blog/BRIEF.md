# Brief: long-form Thai articles for spaminthai.com

Goal: original, genuinely useful Thai articles to fix Google AdSense "Low value content". Quality over speed.

## Output format
For each article, write ONE Python spec file to /home/claude/tools/specs/<id>.py. Use the same variables as the example /home/claude/tools/specs/a06.py (read it first):
slug, date ('YYYY-MM-DD', today), date_th (Thai Buddhist-era date, e.g. '3 พฤศจิกายน 2569'), title, desc (<=160 chars), faq (list of 4-6 (q,a) tuples), main (HTML string), related (HTML links string), hero = (icon, accent, chip_label, line1, line2).
- hero: icon is one of: phone search shield alert bank sim family app sms badge bolt globe chart chat cart lock qr heart mute like. accent one of '#f43f5e' (warning/scam), '#22d3ee' (who-called/number), '#fbbf24' (money/shopping), '#a78bfa' (privacy/accounts), '#34d399' (protection/how-to). chip_label 1-3 Thai words; line1 <= 22 chars, line2 <= 26 chars (short headline split over 2 lines).
After writing, run `python3 scripts/blog/publish.py --lint-only scripts/blog/specs/<slug>.py` from the repo root and fix every error. Do NOT run publish without --lint-only and do not edit any other repo file.

## Length & structure
- main: at least 9,000 characters of Thai body text (about 1,500+ words), aim 10,000-14,000.
- Start with <p class="lead"><strong>คำตอบสั้น:</strong> ...</p> answering the search question directly.
- 6-9 <h2> sections: what it is, how the trick works step by step (example script in your own words), red flags, how to verify, what to do if already caught (by situation), prevention for family/elderly, etc.
- Use <ul>/<ol>/<p>/<strong>/<p class="box">. No images, no inline styles, no scripts.
- Internal links (only these exist; any other /blog/<slug> that already exists in blog/ is also fine — `ls blog/`): /check, /report, /dispute, /editorial-policy, /blog/scammed-what-to-do, /blog/fake-bank-sms, /blog/report-hotlines-1441-1155-1212, /blog/voip-697-698-scam, /blog/silent-unknown-callers-android-iphone, /blog/02-landline-who-called, /blog/06-mobile-who-called, /blog/silent-call-hang-up, /blog/check-bank-account-before-transfer, /blog/pdpa-reporting-numbers, /guide/call-center-scam, /guide/block-spam-android, Link only to articles that already exist in blog/ (not to other new articles being written at the same time). App link only: https://play.google.com/store/apps/details?id=com.jarvis.callblocker (target="_blank" rel="noopener noreferrer").
- Each article must have a section or box that adds something specific and practical (checklist, decision table in a list, script to say to elderly parents, etc.) — not generic filler. Avoid repeating the same paragraphs across articles.

## Legal rules (strict)
- Never accuse a named person, company or specific phone number of being a scammer. Say "มีรายงานจากผู้ใช้", "ผู้ต้องหา" for arrests.
- Never write a real phone number as an example. Use 08x-xxx-xxxx / 02-xxx-xxxx. Official hotlines are OK ONLY if you verified them with WebSearch (e.g. 1441 AOC, 1212 DES/OCC, 1599 police, 191, 1202 DSI, 1213 BOT, 1545 Thailand Post, 1200 NBTC). If unsure, leave it out.
- Don't name real brands as scammers. You may say "อ้างเป็นบริษัทขนส่ง" / "อ้างเป็นธนาคาร".
- No copying of news text. Verify any factual claim (USSD codes like *179#, laws, agency names, hotline numbers, BOT licensed-lender checks) with WebSearch; if you cannot verify, drop it. No made-up statistics.
- Optional site data you may use (from SpamInThai user reports, early Nov 2569, label it as user-report data, not official): about 2,500 reported numbers; prefix 06 ≈ 860, 08 ≈ 670, 09 ≈ 620, 02 ≈ 340. Top search queries to the site are "เบอร์ 02xxxxxxx เบอร์อะไร".
- Add a <p class="box"> disclaimer where it involves legal/financial steps: general info, not legal advice.
- No gambling, no promoting unlicensed loans, no investment advice.

When done, reply with only: list of files written, each slug + title + len(main), and any facts you dropped because you couldn't verify.

## Avoid duplicates
Before writing, list existing articles (`ls blog/` and titles in functions/api/blog-posts.js). Do not write a topic that is already covered; pick a different angle or a new topic.
