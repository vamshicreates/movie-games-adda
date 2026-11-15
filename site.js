// Server-rendered pages: SEO tags for the daily quiz, the information pages, robots.txt and sitemap.xml.
// Everything is plain HTML with no inline script, because the site's content security policy forbids it.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { istDate } from './daily.js';

const root = dirname(fileURLToPath(import.meta.url));
const SITE = 'Movie Games Adda';
const INSTAGRAM = 'https://www.instagram.com/vamshicreatess';
const CREDIT = 'https://vamshicreates.tech';

export const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function originOf(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost').split(',')[0].trim();
  const safe = /^[a-z0-9.\-]+(:\d{1,5})?$/i.test(host) ? host : 'localhost';
  const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https' ? 'https' : 'http';
  return `${proto}://${safe}`;
}

const playCopy = ['Daily Telugu Movie Quiz: Guess the Film from a Frame or Dialogue', 'A free daily Telugu movie quiz: ten questions, alternating a film frame and a famous dialogue. Type the film name, get a clue after every miss, share your score. New every day, no login.', 'Daily Telugu movie games', 'Ten questions a day, a frame then a dialogue, all from Telugu films. Type the film name. Free, no login, and your streak stays in your browser.'];
const playPath = /^\/play(?:\/(\d{1,4}))?$/;
const legacyPlay = /^\/play\/(?:frame|dialogue|clues)(?:\/(\d{1,4}))?$/; // the three separate games were merged into one daily quiz

export function head({ title, desc, path, origin, robots = 'index,follow' }) {
  const full = title.includes(SITE) ? title : `${title} | ${SITE}`;
  const url = `${origin}${path}`;
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(full)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="${robots}">
  <meta name="theme-color" content="#0b0a0b">
  <link rel="canonical" href="${esc(url)}">
  <link rel="icon" href="/logo.svg" type="image/svg+xml">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE}">
  <meta property="og:title" content="${esc(full)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(origin)}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${SITE}: daily Telugu movie games">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(full)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(origin)}/og.png">
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/daily.css">`;
}

export const header = (current = '') => `<a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="/" aria-label="${SITE} home">
        <img src="/logo.svg" width="35" height="35" alt="">
        <span>Movie Games<span class="brand-accent"> Adda</span></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="/play" class="nav-link daily-link"${current === 'play' ? ' aria-current="page"' : ''}>Daily</a>
        <a href="/#games" class="nav-link">Games</a>
        <a href="/how-to-play" class="nav-link how-link"${current === 'how' ? ' aria-current="page"' : ''}>How to play</a>
      </nav>
    </div>
  </header>`;

export const footer = () => `<footer class="shell site-footer site-footer-wide">
    <div class="footer-top">
      <a class="brand footer-brand" href="/"><img src="/logo.svg" width="26" height="26" alt=""><span>Movie Games<span class="brand-accent"> Adda</span></span></a>
      <a class="social" href="${INSTAGRAM}" target="_blank" rel="noopener me">Instagram @vamshicreatess</a>
    </div>
    <nav class="footer-links" aria-label="Footer">
      <a href="/play">Daily games</a><a href="/how-to-play">How to play</a><a href="/updates">Updates</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/credits">Credits and takedown</a><a href="/contact">Contact</a>
    </nav>
    <span class="credit">Game developed, website developed by <a href="${CREDIT}" target="_blank" rel="noopener">Vamshi Creates</a></span>
  </footer>`;

const page = ({ title, desc, path, origin, current, body, ld }) => `<!doctype html>
<html lang="en">
<head>
  ${head({ title, desc, path, origin })}${ld ? `\n  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
  ${header(current)}
  <main id="main" tabindex="-1"><article class="shell prose">
${body}
  </article></main>
  ${footer()}
</body>
</html>
`;

// ----- the information pages -----
const faq = [
  ['What is Movie Games Adda?', 'A free Telugu movie quiz site. Besides the level-based games on the home page, it has one daily quiz that everyone plays at the same time: ten questions, alternating a film frame and a dialogue.'],
  ['When does the daily quiz change?', 'At midnight India time (IST). Every player gets the same ten films on the same day, so you can compare scores with friends.'],
  ['How many guesses do I get?', 'Three on every question. After a wrong guess you get another frame, another line or a hint such as the genre or the initials of the hero. You can also skip a question, which uses a guess.'],
  ['Can I type the movie name in Telugu?', 'Yes. Type in English or in Telugu script, or pick a film from the suggestions. Use the language switch to show film names in English or Telugu. Common spelling variations such as “Bahubali” or “Aravinda Sametha” are accepted.'],
  ['How do streaks work?', 'Your streak counts days in a row that you finish all ten questions on the day they come out. Playing the archive does not add to the streak, but those scores do count in your stats.'],
  ['Do I need an account?', 'No. Your scores, streaks and stats are saved in your own browser. Clearing the browser data or switching device starts you fresh.'],
  ['How do I share my result?', 'When you finish, tap Copy result or share straight to WhatsApp or X. The result is a small grid of coloured squares that does not reveal any answer. Challenge a friend sends a link to the same day with your score.'],
  ['A film I love is missing. Can I suggest it?', 'Yes. Use the Suggest a film button on the daily page. Suggestions are read by hand and we add films when we have clear frames for them.'],
];

const pages = {
  '/how-to-play': {
    title: 'How to Play the Daily Telugu Movie Quiz', current: 'how',
    desc: 'How to play the daily Telugu movie quiz: ten questions, frames and dialogues, three guesses each, hints, streaks, sharing and the archive, with answers to common questions.',
    body: `<h1>How to play</h1>
<p class="lede">One daily Tollywood quiz. Ten questions, the same for everyone, new ones at midnight IST.</p>
<h2>The ten questions</h2>
<p>The questions alternate between a frame and a dialogue, five of each. For a frame you see one still from a Telugu film. For a dialogue you read a line from the film. Either way, type the name of the film. English or Telugu spelling both work, and the suggestions list helps.</p>
<h2>Guesses and hints</h2>
<p>You have three guesses on every question. Each wrong guess unlocks a new clue: another frame or another line, and after that hints such as the genre, the year and the initials of the director and hero. Not sure? You can skip a question, but that uses a guess.</p>
<h2>Your score</h2>
<p>After each question you see the answer, with the film\'s year, hero, director and music director. At the end you get a score out of 10 and a grid of coloured squares to share: green for a first-guess answer, yellow for a later answer and red for a miss.</p>
<h2>Streaks, stats and the archive</h2>
<p>Finish the day\'s ten questions on the same day to keep your streak. The last 30 days stay open in the archive. All of it is saved in your browser, with no login.</p>
<h2>Frequently asked questions</h2>
${faq.map(([q, a]) => `<h3>${esc(q)}</h3>\n<p>${esc(a)}</p>`).join('\n')}
<p><a class="btn primary" href="/play">Play today\'s quiz</a></p>`,
    ld: o => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }),
  },
  '/privacy': {
    title: 'Privacy Policy', desc: 'What Movie Games Adda stores: your results stay in your browser, there are no accounts, no ads and no tracking scripts.',
    body: `<h1>Privacy</h1>
<p class="lede">Short version: no accounts, no ads, no tracking scripts. Your results stay in your browser.</p>
<h2>What stays on your device</h2>
<p>Your daily results, streaks, stats and language choice are saved in your browser\'s local storage. We never receive them. Clearing your browser data removes them.</p>
<h2>What our server handles</h2>
<p>The site sets a small cookie that remembers which level-based rounds you have already played, so Play Again can offer new sets. When you use Suggest a film, we store the film name and the note you typed, plus a one-way scrambled form of your network address that is used only to limit spam. We do not ask for your name or email.</p>
<p>Like any website, our hosting provider keeps ordinary technical logs (such as the page requested and the time). We do not use those logs to identify you.</p>
<h2>Third parties</h2>
<p>We do not run advertising or analytics scripts. Links to Instagram, WhatsApp and X leave this site, and those services have their own policies. The share buttons only open a pre-filled message. Nothing is sent until you choose to send it.</p>
<h2>Children</h2>
<p>The games are suitable for a general audience and we do not knowingly collect personal information from anyone.</p>
<h2>Changes and questions</h2>
<p>If this policy changes we will note it on the <a href="/updates">updates page</a>. Questions? See <a href="/contact">Contact</a>.</p>`,
  },
  '/terms': {
    title: 'Terms of Use', desc: 'The rules for using Movie Games Adda, a free fan-made Telugu movie quiz: personal use, no scraping, and how film material is treated.',
    body: `<h1>Terms of use</h1>
<p class="lede">Movie Games Adda is a free, fan-made quiz. By using it you agree to the points below.</p>
<h2>Use of the site</h2>
<p>Play for fun and for your own personal use. Please do not scrape the site, automate guesses, or try to extract the answers, and do not attempt to disrupt the service. We may change or remove games at any time.</p>
<h2>Film material</h2>
<p>Movie names, stills and dialogue belong to their respective owners. They appear here only as small clues in a quiz, for commentary and entertainment. Movie Games Adda is not affiliated with, endorsed by, or sponsored by any film, studio or artist mentioned. If you own material and want it removed, see <a href="/credits">Credits and takedown</a>.</p>
<h2>No guarantees</h2>
<p>The games are provided as they are. We take care with film details but they can contain mistakes, and we do not promise the site will always be available. Use of the site is at your own risk.</p>
<h2>Your suggestions</h2>
<p>If you suggest a film, you allow us to use the suggestion to improve the games. Do not include personal information in it.</p>
<h2>Changes</h2>
<p>We may update these terms. Continued use means you accept the updated version. Changes are noted on the <a href="/updates">updates page</a>.</p>`,
  },
  '/contact': {
    title: 'Contact', desc: 'Get in touch with Movie Games Adda: message on Instagram, suggest a missing film, report a mistake or send a takedown request.',
    body: `<h1>Contact</h1>
<p class="lede">The quickest way to reach us is Instagram.</p>
<p><a class="btn primary" href="${INSTAGRAM}" target="_blank" rel="noopener me">Message @vamshicreatess</a></p>
<h2>Suggest a film</h2>
<p>Use the <strong>Suggest a film</strong> button on any <a href="/play">daily page</a>. It goes straight to our list.</p>
<h2>Report a mistake</h2>
<p>Wrong year, wrong hero or a frame that gives the answer away? Send us a message with the film name and what is wrong.</p>
<h2>Takedown requests</h2>
<p>If you own material shown on this site and want it removed, message us with the film name and what you would like removed. See <a href="/credits">Credits and takedown</a>.</p>
<h2>The maker</h2>
<p>Built by <a href="${CREDIT}" target="_blank" rel="noopener">Vamshi Creates</a>.</p>`,
  },
  '/updates': {
    title: 'Updates and Changelog', desc: 'What is new on Movie Games Adda: the daily Telugu movie games, streaks, sharing, the archive and more.',
    body: `<h1>Updates</h1>
<p class="lede">What is new on Movie Games Adda.</p>
<h2>15 November 2026: Daily Telugu movie quiz</h2>
<ul>
<li>One daily quiz of ten questions, alternating a film frame and a dialogue, with new films every day at midnight IST.</li>
<li>Type the film name, with three guesses and a new clue after every miss.</li>
<li>Share your score as a grid of coloured squares, send a challenge link, and keep streaks and stats in your browser.</li>
<li>A 30-day archive, English and Telugu title switch, and a Suggest a film form.</li>
<li>New How to play, Privacy, Terms, Contact and Credits pages.</li>
</ul>
<h2>Earlier</h2>
<ul>
<li>Guess the Actor, Guess the Actress, Guess the Movie by Frames and Guess the Song, in levels of ten.</li>
</ul>`,
  },
  '/credits': {
    title: 'Credits and Takedown', desc: 'Who built Movie Games Adda, where film details come from, and how to request removal of any material.',
    body: `<h1>Credits and takedown</h1>
<p class="lede">A fan-made quiz, built with love for Telugu cinema.</p>
<h2>Built by</h2>
<p>Game developed and website developed by <a href="${CREDIT}" target="_blank" rel="noopener">Vamshi Creates</a>.</p>
<h2>Film details</h2>
<p>Years, casts and crew come from publicly available film information and are checked by hand, but a few may still be wrong. If you spot one, <a href="/contact">tell us</a>.</p>
<h2>Frames and dialogue</h2>
<p>Stills and dialogue belong to the films\' respective owners and are shown at low resolution as quiz clues. This site is not affiliated with any film, studio, artist or music label.</p>
<h2>Takedown</h2>
<p>If you are the owner of any material on this site and would like it removed, <a href="/contact">message us</a> with the film name and what you want removed. We will take it down promptly.</p>`,
  },
};

const sitemapPaths = ['/', '/play', '/how-to-play', '/updates', '/privacy', '/terms', '/credits', '/contact'];

const playTemplate = () => readFileSync(resolve(root, 'public/play.html'), 'utf8');

// Returns { type, body } (or { redirect }) for a path this module owns, or null.
export function render(path, origin, now = Date.now()) {
  if (path === '/robots.txt') {
    return { type: 'text/plain; charset=utf-8', body: `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n` };
  }
  if (path === '/sitemap.xml') {
    const day = istDate(now);
    const urls = sitemapPaths.map(p => `  <url><loc>${esc(origin + p)}</loc><lastmod>${day}</lastmod></url>`).join('\n');
    return { type: 'application/xml; charset=utf-8', body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` };
  }
  if (path === '/' || path === '/admin' || /^\/round\/[a-f0-9-]{36}$/.test(path)) {
    const html = readFileSync(resolve(root, 'public/index.html'), 'utf8')
      .replaceAll('%%ORIGIN%%', esc(origin)).replaceAll('%%URL%%', esc(origin + path))
      .replaceAll('%%ROBOTS%%', path === '/' ? 'index,follow' : 'noindex,nofollow');
    return { type: 'text/html; charset=utf-8', body: html };
  }
  const info = pages[path];
  if (info) {
    const ld = typeof info.ld === 'function' ? info.ld(origin) : info.ld;
    return { type: 'text/html; charset=utf-8', body: page({ ...info, path, origin, ld }) };
  }
  const old = legacyPlay.exec(path);
  if (old) return { redirect: old[1] ? `/play/${Number(old[1])}` : '/play' };
  const play = playPath.exec(path);
  if (play) {
    const number = play[1];
    const [title, desc, h1, intro] = playCopy;
    const archive = number ? `Day #${Number(number)} · ` : '';
    const html = playTemplate()
      .replaceAll('%%HEAD%%', head({ title: `${archive}${title}`, desc, path, origin, robots: number ? 'noindex,follow' : 'index,follow' }))
      .replaceAll('%%HEADER%%', header('play'))
      .replaceAll('%%FOOTER%%', footer())
      .replaceAll('%%H1%%', esc(h1))
      .replaceAll('%%INTRO%%', esc(intro));
    return { type: 'text/html; charset=utf-8', body: html };
  }
  return null;
}
export const isPlayPath = path => playPath.test(path) || legacyPlay.test(path);
