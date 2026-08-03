#!/usr/bin/env python3
"""Apply unified site chrome to content HTML pages."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNIPPETS = ROOT / "assets/snippets/site-chrome.html"

FONT_LINK = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">\n'
    '<link rel="stylesheet" href="/assets/theme.css">\n'
    '<link rel="stylesheet" href="/assets/layout.css">\n'
)

CONTENT_PAGES = [
    "blog/index.html",
    "blog/berkhrai-check-caller.html",
    "blog/best-spam-checker-apps-2568.html",
    "blog/call-center-scam-guide-2568.html",
    "blog/fake-bank-sms.html",
    "blog/new-scam-tricks-2568-07.html",
    "blog/numbers-065-scam.html",
    "blog/pdpa-reporting-numbers.html",
    "blog/report-hotlines-1441-1155-1212.html",
    "blog/scammed-what-to-do.html",
    "blog/silent-unknown-callers-android-iphone.html",
    "blog/truat-ber-free.html",
    "blog/voip-697-698-scam.html",
    "guide/spam-numbers.html",
    "guide/check-phone.html",
    "guide/call-center-scam.html",
    "guide/block-spam-android.html",
    "privacy.html",
    "terms.html",
    "changelog.html",
]


def load_chrome():
    raw = SNIPPETS.read_text(encoding="utf-8")
    header, footer = raw.split("<!-- Shared footer")
    header = header.replace("<!-- Shared header — paste after <body class=\"site-body\"> -->", "").strip()
    footer = footer.split("-->", 1)[1].strip()
    return header, footer


def strip_old_style(html: str) -> str:
    return re.sub(r"<style>.*?</style>\s*", "", html, count=1, flags=re.DOTALL)


def strip_old_nav(html: str) -> str:
    html = re.sub(
        r"<p class=\"nav\">.*?</p>\s*",
        "",
        html,
        count=1,
        flags=re.DOTALL,
    )
    html = re.sub(
        r"<p class=\"meta\"><a href=\"/\">←.*?</a></p>\s*",
        "",
        html,
        count=1,
        flags=re.DOTALL,
    )
    return html


def strip_old_footer(html: str) -> str:
    return re.sub(r"<footer[^>]*>.*?</footer>\s*", "", html, count=1, flags=re.DOTALL)


def inject_font_links(html: str) -> str:
    if "/assets/theme.css" in html:
        return html
    if "</head>" in html:
        return html.replace("</head>", FONT_LINK + "</head>", 1)
    return html


def transform_content_page(path: Path, header: str, footer: str) -> str:
    html = path.read_text(encoding="utf-8")
    html = inject_font_links(html)
    html = strip_old_style(html)
    html = strip_old_nav(html)
    html = strip_old_footer(html)

    # unwrap <div class="wrap"> if present
    html = re.sub(r"<body>\s*<div class=\"wrap\">", "<body class=\"site-body\">\n" + header + "\n<main class=\"site-main site-main--wide\">", html, count=1)
    html = re.sub(r"</div>\s*</body>", footer + "\n<script src=\"/assets/site.js\" defer></script>\n</body>", html, count=1)

    # guide/blog article pages with article wrapper
    if "<main" not in html and "<body class=\"site-body\">" in html:
        html = html.replace("<body>", "<body class=\"site-body\">\n" + header + "\n<main class=\"site-main site-main--wide\">", 1)
        html = html.replace("</body>", footer + "\n<script src=\"/assets/site.js\" defer></script>\n</body>", 1)

    if "</main>" not in html:
        html = html.replace(footer, "</main>\n" + footer, 1)

    return html


def main():
    header, footer = load_chrome()
    for rel in CONTENT_PAGES:
        path = ROOT / rel
        if not path.exists():
            print("skip missing", rel)
            continue
        new = transform_content_page(path, header, footer)
        path.write_text(new, encoding="utf-8")
        print("updated", rel)


if __name__ == "__main__":
    main()
