// The daily Telugu movie quiz: ten questions a day, alternating a film frame and a dialogue, answered by typing.
// Results, streaks and stats are kept in the browser; the server only holds the puzzles and checks guesses.
import { icon } from './art.js';
import * as S from './daily-store.js';

const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const $ = (selector, root = document) => root.querySelector(selector);

async function request(path, body) {
  const options = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined;
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

let meta;
let films = [];
let filmMap = new Map();
let lang = S.getLang();
const titleOf = film => (lang === 'te' && film.te ? film.te : film.title);
const otherTitle = film => (lang === 'te' ? film.title : film.te);
const shownTitle = guess => { const film = filmMap.get(guess.id); return film ? titleOf(film) : guess.title; };

const dateLabel = n => new Date(Date.parse(`${meta.date}T00:00:00Z`) - (meta.today - n) * 86_400_000)
  .toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const shortDate = n => new Date(Date.parse(`${meta.date}T00:00:00Z`) - (meta.today - n) * 86_400_000)
  .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// ----- small UI helpers -----
function toast(message) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}
function openDialog(html, label, mount) {
  const dialog = document.createElement('dialog');
  dialog.className = 'd-dialog';
  dialog.setAttribute('aria-label', label);
  dialog.innerHTML = `<div class="d-dialog-body">${html}</div>`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  mount?.(dialog);
  dialog.showModal();
  return dialog;
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    area.remove();
    return ok;
  }
}
function countdown(element) {
  const tick = () => {
    const ist = Date.now() + 19_800_000;
    const left = Math.max(0, (Math.floor(ist / 86_400_000) + 1) * 86_400_000 - ist);
    if (left === 0) { location.reload(); return; }
    const pad = value => String(value).padStart(2, '0');
    element.textContent = `${pad(Math.floor(left / 3_600_000))}:${pad(Math.floor(left / 60_000) % 60)}:${pad(Math.floor(left / 1000) % 60)}`;
  };
  tick();
  clearInterval(countdown.timer);
  countdown.timer = setInterval(tick, 1000);
}
const langControl = () => `<div class="seg" role="group" aria-label="Film name language">
  <button type="button" data-lang="en" aria-pressed="${lang === 'en'}">English</button>
  <button type="button" data-lang="te" aria-pressed="${lang === 'te'}" lang="te">తెలుగు</button></div>`;
// One click handler on <main> for the language switch, Stats and Suggest buttons, so re-rendering never stacks listeners.
let ui = { rerender: () => {} };
function bindMain(main) {
  main.addEventListener('click', event => {
    const target = event.target.closest('[data-lang], [data-stats], [data-suggest]');
    if (!target) return;
    if (target.dataset.lang) {
      lang = target.dataset.lang;
      S.setLang(lang);
      main.querySelectorAll('[data-lang]').forEach(other => other.setAttribute('aria-pressed', String(other.dataset.lang === lang)));
      ui.rerender();
    } else if (target.hasAttribute('data-stats')) showStats();
    else suggestDialog('');
  });
}

// ----- stats and suggestions -----
// The page's content security policy blocks style attributes in markup, so bar widths are set from script.
function sizeBars(root) {
  root.querySelectorAll('[data-w]').forEach(bar => { bar.style.width = `${bar.dataset.w}%`; });
}
function showStats() {
  const stat = S.stats(meta.today);
  const top = Math.max(1, ...stat.distribution);
  openDialog(`<h2>Your stats</h2>
    <div class="stat-grid">
      <div><strong>${stat.played}</strong><span>Days played</span></div><div><strong>${stat.average}</strong><span>Average score</span></div>
      <div><strong>${stat.current}</strong><span>Streak</span></div><div><strong>${stat.longest}</strong><span>Best streak</span></div></div>
    <h3>Your scores out of ${S.QUESTIONS}</h3>
    <ol class="dist wide">${stat.distribution.map((count, score) => `<li><span>${score}</span><i data-w="${count ? Math.max(8, Math.round((count / top) * 100)) : 0}">${count || ''}</i></li>`).join('')}</ol>
    <p class="fine">Saved in this browser only. A streak counts days you finished the quiz on the day it came out.</p>
    <div class="dialog-actions"><button type="button" class="btn secondary" data-close>Close</button></div>`, 'Your stats', sizeBars);
}
function suggestDialog(prefill) {
  openDialog(`<h2>Suggest a film</h2><p>Is a Telugu film missing from our list? Tell us and we will look for clear frames.</p>
    <form class="suggest-form" novalidate>
      <label>Film name<input name="title" maxlength="120" required value="${esc(prefill)}"></label>
      <label>Note, optional<input name="note" maxlength="300" placeholder="Year, hero, anything that helps"></label>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="status" role="status"></p>
      <div class="dialog-actions"><button class="btn primary" type="submit">Send suggestion</button><button type="button" class="btn secondary" data-close>Close</button></div>
    </form>`, 'Suggest a film', dialog => {
    const form = $('form', dialog);
    const status = $('.status', form);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      status.className = 'status';
      try {
        await request('/api/daily/suggest', { title: data.title, note: data.note, website: data.website });
        form.innerHTML = '<p class="status">Thank you! We will have a look.</p><div class="dialog-actions"><button type="button" class="btn secondary" data-close>Close</button></div>';
        $('[data-close]', form).addEventListener('click', () => dialog.close());
      } catch (error) {
        status.className = 'status error';
        status.textContent = error.message;
      }
    });
    setTimeout(() => $('input[name=title]', form).focus(), 30);
  });
}

// ----- the game page -----
const GRADE_LABEL = { first: 'solved on the first guess', later: 'solved', miss: 'missed', open: 'not answered yet' };
const TYPE_LABEL = { frame: 'Frame', dialogue: 'Dialogue' };

async function gamePage(n) {
  const main = $('#main');
  const isToday = n === meta.today;
  const tries = meta.tries;
  let record = S.getDay(n);
  let puzzle;
  if (!record) {
    try {
      puzzle = await request(`/api/daily/puzzle?n=${n}`);
      record = S.newDay(puzzle.questions);
    } catch (error) {
      main.innerHTML = `<div class="shell prose"><h1>Daily Telugu movie games</h1><p class="lede">${esc(error.message)}</p><p><a class="btn primary" href="/play">Play today's quiz</a></p></div>`;
      return;
    }
  }
  const friend = S.friendScore(location.search);
  const save = () => S.putDay(n, record);
  const firstOpen = () => record.items.findIndex(item => item.status === 'open');
  let reviewing = null; // index of a question that was just answered, shown until "Next"
  const typeOf = index => (index % 2 === 0 ? 'frame' : 'dialogue');

  main.innerHTML = `<div class="shell daily game-page">
    <div class="game-top"><p class="eyebrow">${isToday ? 'Today' : 'Archive'} · #${n} · ${dateLabel(n)}</p>
      <div class="daily-tools">${langControl()}<button type="button" class="btn secondary small" data-stats>${icon('trophy', 18)} Stats</button></div></div>
    <header class="game-head"><h1 tabindex="-1">Daily Telugu movie games</h1>
      <p class="lede">Ten questions, a frame then a dialogue, all from Telugu films. Type the film name. You get ${tries} guesses on each, with a new clue after every miss.</p></header>
    <div id="friend"></div><ol class="q-strip" id="strip" aria-label="Your progress"></ol><section id="stage"></section>
    <details class="archive" id="archive"><summary>Archive: the last ${meta.today - meta.from + 1} days</summary><div class="archive-grid" id="archive-grid"></div></details>
    <p class="game-foot"><button type="button" class="link-button" data-suggest>Suggest a film</button> <span aria-hidden="true">·</span> <a href="/how-to-play">How to play</a> <span aria-hidden="true">·</span> <a href="/">More games</a></p></div>`;

  function renderFriend() {
    const box = $('#friend');
    if (friend === null) { box.innerHTML = ''; return; }
    let text = `A friend scored ${friend}/${S.QUESTIONS} on this day. Can you beat it?`;
    if (S.isFinished(record)) {
      const mine = S.scoreOf(record);
      text = mine > friend ? `You beat your friend! ${mine} vs ${friend}.` : mine === friend ? `You tied your friend, both ${mine}.` : `Your friend was ahead: ${friend} vs your ${mine}.`;
    }
    box.innerHTML = `<p class="friend-banner">${icon('trophy', 18)} ${esc(text)}</p>`;
  }

  function renderStrip() {
    const current = reviewing === null ? firstOpen() : -1;
    $('#strip').innerHTML = record.items.map((item, i) => {
      const state = S.grade(item);
      const mark = state === 'first' || state === 'later' ? '✓' : state === 'miss' ? '✕' : i + 1;
      const now = i === current ? ' is-current' : '';
      return `<li class="q-dot q-${state}${now}" aria-label="Question ${i + 1}, ${GRADE_LABEL[state]}"${i === current ? ' aria-current="step"' : ''}>${mark}</li>`;
    }).join('');
  }

  function clueCards(item, fresh) {
    return item.clues.map((clue, i) => {
      const isNew = fresh && i === item.clues.length - 1 && item.guesses.length > 0 ? ' is-new' : '';
      if (clue.type === 'frame') return `<figure class="clue-card clue-frame${isNew}"><img src="${esc(clue.src)}" alt="${esc(clue.label)} from the film" width="820" height="460"><figcaption>${esc(clue.label)}</figcaption></figure>`;
      if (clue.type === 'line') return `<blockquote class="clue-card clue-line${isNew}"><p>${esc(clue.text)}</p><footer>${esc(clue.label)}</footer></blockquote>`;
      return `<div class="clue-card clue-hint${isNew}"><span>${esc(clue.label)}</span><strong>${esc(clue.value)}</strong></div>`;
    }).reverse().join('');
  }

  function renderQuestion(index) {
    const item = record.items[index];
    const kind = typeOf(index);
    const pips = Array.from({ length: tries }, (_, i) => {
      const guess = item.guesses[i];
      return guess ? '<span class="pip wrong" aria-label="wrong">✕</span>' : '<span class="pip"></span>';
    }).join('');
    const wrong = item.guesses.filter(guess => !guess.skipped);
    $('#stage').innerHTML = `<div class="q-meta"><h2 id="q-title" tabindex="-1">Question ${index + 1} of ${S.QUESTIONS}</h2><span class="q-kind">${kind === 'frame' ? icon('frame', 16) : icon('lyric', 16)} ${TYPE_LABEL[kind]}</span></div>
      <p class="q-ask">${kind === 'frame' ? 'Which Telugu film is this frame from?' : 'Which Telugu film is this dialogue from?'}</p>
      <div class="clue-stack">${clueCards(item, true)}</div>
      <div class="pips" role="img" aria-label="${item.guesses.length} of ${tries} guesses used">${pips}</div>${wrong.length ? `<ul class="wrong-list">${wrong.map(guess => `<li>${esc(shownTitle(guess))}</li>`).join('')}</ul>` : ''}
      <form class="guess-form" autocomplete="off" novalidate>
        <label class="sr-only" for="g-input">Film name</label>
        <div class="guess-line"><div class="combo"><input id="g-input" type="text" role="combobox" aria-expanded="false" aria-controls="g-list" aria-autocomplete="list" placeholder="Type a film name…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go">
          <ul id="g-list" class="combo-list" role="listbox" hidden></ul></div>
          <button class="btn primary" type="submit">Guess</button></div>
        <div class="guess-meta"><button class="btn secondary small" type="button" data-skip>Skip question</button><p class="guess-count">Guess ${item.guesses.length + 1} of ${tries}. Skipping uses a guess.</p></div>
        <p class="status" id="g-status" role="status"></p></form>`;
    bindForm($('#stage'), index);
  }

  function bindForm(box, index) {
    const item = record.items[index];
    const form = $('form', box);
    const input = $('#g-input', box);
    const list = $('#g-list', box);
    const status = $('#g-status', box);
    const guessedIds = () => new Set(item.guesses.map(guess => guess.id).filter(Boolean));
    let active = -1;
    let options = [];
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const norm = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
    const suggest = () => {
      const q = norm(input.value);
      if (!q) { close(); return; }
      const taken = guessedIds();
      options = films.filter(film => !taken.has(film.id)).map(film => {
        const forms = [film.title, film.te, ...film.aliases].filter(Boolean).map(norm);
        const first = norm(titleOf(film));
        const rank = first.startsWith(q) ? 0 : forms.some(form => form.startsWith(q)) ? 1 : forms.some(form => form.includes(q)) ? 2 : 9;
        return { film, rank };
      }).filter(entry => entry.rank < 9).sort((a, b) => a.rank - b.rank || titleOf(a.film).localeCompare(titleOf(b.film))).slice(0, 8).map(entry => entry.film);
      list.innerHTML = options.map((film, i) => `<li role="option" id="opt-${i}" data-id="${esc(film.id)}" aria-selected="false"><span>${esc(titleOf(film))}</span>${otherTitle(film) ? `<small ${lang === 'te' ? '' : 'lang="te"'}>${esc(otherTitle(film))}</small>` : ''}</li>`).join('');
      list.hidden = !options.length;
      input.setAttribute('aria-expanded', String(options.length > 0));
      active = -1;
    };
    const highlight = next => {
      active = (next + options.length) % options.length;
      list.querySelectorAll('[role=option]').forEach((entry, i) => entry.setAttribute('aria-selected', String(i === active)));
      input.setAttribute('aria-activedescendant', `opt-${active}`);
      $(`#opt-${active}`, list).scrollIntoView({ block: 'nearest' });
    };
    const pick = film => { input.value = titleOf(film); input.dataset.film = film.id; close(); input.focus(); };

    input.addEventListener('input', () => { delete input.dataset.film; status.textContent = ''; suggest(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' && options.length) { event.preventDefault(); if (list.hidden) { list.hidden = false; input.setAttribute('aria-expanded', 'true'); } highlight(active + 1); }
      else if (event.key === 'ArrowUp' && options.length) { event.preventDefault(); highlight(active - 1); }
      else if (event.key === 'Enter' && active >= 0 && !list.hidden) { event.preventDefault(); pick(options[active]); }
      else if (event.key === 'Escape') close();
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
    list.addEventListener('mousedown', event => event.preventDefault());
    list.addEventListener('click', event => {
      const entry = event.target.closest('[role=option]');
      if (entry) pick(filmMap.get(entry.dataset.id));
    });

    let busy = false;
    async function send(extra) {
      if (busy) return;
      busy = true;
      form.querySelectorAll('button').forEach(button => { button.disabled = true; });
      status.className = 'status';
      status.textContent = '';
      try {
        const res = await request('/api/daily/guess', { n, q: index + 1, misses: item.guesses.length, ...extra });
        if (res.unknown) {
          status.className = 'status error';
          status.innerHTML = `We could not find “${esc(input.value.trim())}” in our list. Pick a film from the suggestions, or <button type="button" class="link-button" data-unknown>suggest it</button>.`;
          $('[data-unknown]', status).addEventListener('click', () => suggestDialog(input.value.trim()));
          return;
        }
        if (res.guessed && guessedIds().has(res.guessed.id)) {
          status.className = 'status error';
          status.textContent = 'You already guessed that one.';
          return;
        }
        item.guesses.push(res.guessed ? { id: res.guessed.id, title: res.guessed.title } : { skipped: true });
        if (res.clue) item.clues.push(res.clue);
        if (res.correct || res.over) {
          item.status = res.correct ? 'won' : 'lost';
          item.answer = res.answer;
          reviewing = index;
          if (S.isFinished(record)) record.live = isToday;
        }
        save();
        renderAll();
        if (reviewing !== null) $('#fb-title')?.focus(); else $('#g-input')?.focus();
      } catch (error) {
        status.className = 'status error';
        status.textContent = error.message;
      } finally {
        busy = false;
        form.querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) { status.className = 'status error'; status.textContent = 'Type a film name, or pick one from the list.'; return; }
      send(input.dataset.film ? { film: input.dataset.film } : { guess: text });
    });
    $('[data-skip]', form).addEventListener('click', () => send({ skip: true }));
  }

  const answerCard = item => {
    const answer = item.answer ?? {};
    const film = filmMap.get(answer.id);
    const name = film ? titleOf(film) : answer.title;
    const other = film ? otherTitle(film) : '';
    return `<div class="answer-card">${answer.image ? `<img src="${esc(answer.image)}" alt="A frame from ${esc(name)}" width="820" height="460">` : ''}
      <div><h3>${esc(name)}</h3>${other ? `<p class="alt-title"${lang === 'te' ? '' : ' lang="te"'}>${esc(other)}</p>` : ''}
        <dl><div><dt>Year</dt><dd>${esc(answer.year ?? '')}</dd></div><div><dt>Hero</dt><dd>${esc(answer.hero ?? '')}</dd></div><div><dt>Director</dt><dd>${esc(answer.director ?? '')}</dd></div><div><dt>Music</dt><dd>${esc(answer.music ?? '')}</dd></div></dl></div></div>`;
  };

  function renderFeedback(index) {
    const item = record.items[index];
    const won = item.status === 'won';
    const last = S.isFinished(record);
    const title = won ? (item.guesses.length === 1 ? 'First guess!' : 'You got it!') : 'Not this time';
    $('#stage').innerHTML = `<div class="feedback ${won ? 'is-won' : 'is-lost'}"><p class="q-kind">Question ${index + 1} of ${S.QUESTIONS}</p>
      <h2 id="fb-title" tabindex="-1">${title}</h2><p class="result-score">${won ? `Solved with guess ${item.guesses.length} of ${tries}.` : 'The film was:'}</p>
      ${answerCard(item)}
      <div class="share-row"><button type="button" class="btn primary" id="next">${last ? 'See my score' : 'Next question'} ${icon('arrow', 18)}</button></div></div>`;
    $('#next').addEventListener('click', () => {
      reviewing = null;
      renderAll();
      if (S.isFinished(record)) $('#r-title')?.focus(); else $('#q-title')?.focus();
    });
  }

  function renderResult() {
    const mine = S.scoreOf(record);
    const link = `${location.origin}/play${isToday ? '' : `/${n}`}`;
    const text = S.shareText(n, record, link);
    const challenge = S.challengeText(n, record, S.challengeLink(location.origin, n, record));
    const stat = S.stats(meta.today);
    const heading = mine === S.QUESTIONS ? 'Perfect score!' : mine >= 7 ? 'Great run!' : mine >= 4 ? 'Not bad!' : 'Tough day.';
    const review = record.items.map((item, i) => {
      const state = S.grade(item);
      const film = filmMap.get(item.answer?.id);
      return `<li class="rv-${state}"><span class="rv-n">${i + 1}</span><span class="rv-mark" aria-label="${GRADE_LABEL[state]}">${state === 'miss' ? '✕' : '✓'}</span><span class="rv-title">${esc(film ? titleOf(film) : item.answer?.title ?? '')}</span><span class="rv-kind">${TYPE_LABEL[typeOf(i)]}</span></li>`;
    }).join('');
    $('#stage').innerHTML = `<div class="result"><h2 id="r-title" tabindex="-1">${heading}</h2>
      <p class="score-big"><strong>${mine}</strong><span>/ ${S.QUESTIONS}</span></p>
      <pre class="share-preview" aria-label="Your result">${esc(text)}</pre>
      <div class="share-row"><button type="button" class="btn primary" data-copy="result">Copy result</button>
        <a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">WhatsApp</a>
        <a class="btn secondary" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}">Post on X</a>
        ${navigator.share ? '<button type="button" class="btn secondary" data-share>Share…</button>' : ''}
        <button type="button" class="btn secondary" data-copy="challenge">${icon('trophy', 18)} Challenge a friend</button></div>
      <h3 class="rv-head">The ten films</h3><ol class="review">${review}</ol>
      <div class="stat-grid mini"><div><strong>${stat.played}</strong><span>Days played</span></div><div><strong>${stat.average}</strong><span>Average</span></div><div><strong>${stat.current}</strong><span>Streak</span></div><div><strong>${stat.best}</strong><span>Best score</span></div></div>
      ${isToday ? '<p class="next-line">New questions in <time id="count">--:--:--</time> (midnight IST)</p>' : '<p class="next-line"><a href="/play">Play today\'s quiz</a></p>'}
      <div class="more-games"><a class="btn secondary small" href="/">More games</a><button type="button" class="btn secondary small" data-suggest>Suggest a film</button></div></div>`;
    const stage = $('#stage');
    $('[data-copy=result]', stage).addEventListener('click', async () => toast((await copy(text)) ? 'Result copied' : 'Could not copy, select the text instead'));
    $('[data-copy=challenge]', stage).addEventListener('click', async () => toast((await copy(challenge)) ? 'Challenge link copied. Send it to a friend!' : 'Could not copy the link'));
    $('[data-share]', stage)?.addEventListener('click', () => navigator.share({ text }).catch(() => {}));
    const count = $('#count', stage);
    if (count) countdown(count);
  }

  function renderArchive() {
    const cells = [];
    for (let k = meta.today; k >= meta.from; k--) {
      const rec = S.getDay(k);
      const done = S.isFinished(rec);
      const state = done ? 'done' : rec && S.answered(rec) ? 'playing' : 'new';
      const label = done ? `scored ${S.scoreOf(rec)} of ${S.QUESTIONS}` : state === 'playing' ? 'in progress' : 'not played';
      cells.push(`<a class="arch-item ${state}" href="/play${k === meta.today ? '' : `/${k}`}"${k === n ? ' aria-current="page"' : ''} aria-label="Day ${k}, ${shortDate(k)}, ${label}"><strong>#${k}</strong><small>${shortDate(k)}</small><i aria-hidden="true">${done ? `${S.scoreOf(rec)}/${S.QUESTIONS}` : state === 'playing' ? '…' : ''}</i></a>`);
    }
    $('#archive-grid').innerHTML = cells.join('');
  }

  function renderAll() {
    renderFriend();
    renderStrip();
    if (reviewing !== null) renderFeedback(reviewing);
    else if (S.isFinished(record)) renderResult();
    else renderQuestion(firstOpen());
    renderArchive();
  }
  ui = { rerender: renderAll };
  renderAll();
}

// ----- start -----
async function boot() {
  const route = /^\/play(?:\/(\d+))?$/.exec(location.pathname);
  try {
    [meta, films] = await Promise.all([request('/api/daily/meta'), request('/api/daily/films')]);
    filmMap = new Map(films.map(film => [film.id, film]));
    bindMain($('#main'));
    await gamePage(route?.[1] ? Number(route[1]) : meta.today);
    $('#main h1')?.focus({ preventScroll: true });
  } catch (error) {
    $('#boot').innerHTML = `<h1>Daily Telugu movie games</h1><p class="lede">${esc(error.message || 'The puzzles could not load.')} Refresh to try again.</p>`;
  }
}
boot();
