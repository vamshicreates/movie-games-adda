// The daily Telugu movie games: hub page and the three puzzles (frame, dialogue, clue tiles).
// Results, streaks and stats are kept in the browser; the server only holds the puzzles and checks guesses.
import { icon } from './art.js';
import * as S from './daily-store.js';

const GAMES = {
  frame: { name: 'Frame of the Day', icon: 'frame', blurb: 'One still from a Telugu film. Every miss unlocks another frame or clue.', rule: 'Guess the Telugu film from this frame. Each wrong guess unlocks another frame, then hints. You have six guesses.' },
  dialogue: { name: 'Dialogue of the Day', icon: 'lyric', blurb: 'Read the line and name the film. More lines and hints after every miss.', rule: 'Read the dialogue and name the film it comes from. Each wrong guess unlocks another line, then hints. You have six guesses.' },
  clues: { name: 'Clue Tiles', icon: 'choices', blurb: 'Guess any film. The tiles show its hero, director, music, year, genre and language against the secret one.', rule: 'Guess any film from the list. The tiles show what it shares with the secret film. Ten guesses, with optional hints after the fifth and eighth.' },
};
const ORDER = ['frame', 'dialogue', 'clues'];

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
let ui = { rerender: () => {}, game: 'frame' };
function bindMain(main) {
  main.addEventListener('click', event => {
    const target = event.target.closest('[data-lang], [data-stats], [data-suggest]');
    if (!target) return;
    if (target.dataset.lang) {
      lang = target.dataset.lang;
      S.setLang(lang);
      main.querySelectorAll('[data-lang]').forEach(other => other.setAttribute('aria-pressed', String(other.dataset.lang === lang)));
      ui.rerender();
    } else if (target.hasAttribute('data-stats')) showStats(ui.game);
    else suggestDialog('');
  });
}

// ----- stats and suggestions -----
// The page's content security policy blocks style attributes in markup, so bar widths are set from script.
const sizeBars = root => root.querySelectorAll('[data-w]').forEach(bar => { bar.style.width = `${bar.dataset.w}%`; });
function showStats(start) {
  const body = game => {
    const stat = S.stats(game, meta.today);
    const top = Math.max(1, ...stat.distribution);
    return `<div class="stat-grid">
      <div><strong>${stat.played}</strong><span>Played</span></div><div><strong>${stat.winRate}%</strong><span>Win rate</span></div>
      <div><strong>${stat.current}</strong><span>Streak</span></div><div><strong>${stat.best}</strong><span>Best streak</span></div></div>
      <h3>Guesses it took</h3>
      <ol class="dist">${stat.distribution.map((count, i) => `<li><span>${i + 1}</span><i data-w="${Math.max(6, Math.round((count / top) * 100))}">${count}</i></li>`).join('')}</ol>`;
  };
  openDialog(`<h2>Your stats</h2>
    <div class="tabs" role="tablist">${ORDER.map(game => `<button type="button" role="tab" data-tab="${game}" aria-selected="${game === start}">${GAMES[game].name}</button>`).join('')}</div>
    <div id="stat-body">${body(start)}</div>
    <p class="fine">Saved in this browser only. A streak counts days you solved the puzzle on the day it came out.</p>
    <div class="dialog-actions"><button type="button" class="btn secondary" data-close>Close</button></div>`, 'Your stats', dialog => {
    sizeBars(dialog);
    dialog.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
      dialog.querySelectorAll('[data-tab]').forEach(other => other.setAttribute('aria-selected', String(other === tab)));
      $('#stat-body', dialog).innerHTML = body(tab.dataset.tab);
      sizeBars(dialog);
    }));
  });
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

// ----- hub -----
function hub() {
  const main = $('#main');
  const cards = ORDER.map(game => {
    const record = S.getRecord(game, meta.today);
    const stat = S.stats(game, meta.today);
    const max = S.MAX[game];
    const state = !record ? 'Not played yet' : record.status === 'won' ? `Solved in ${record.guesses.length}/${max}` : record.status === 'lost' ? 'Missed, see the answer' : `In progress · ${record.guesses.length}/${max}`;
    return `<a class="daily-card daily-${game}${S.isDone(record) ? ' is-done' : ''}" href="/play/${game}">
      <span class="daily-card-icon">${icon(GAMES[game].icon, 28)}</span>
      <h2>${GAMES[game].name}</h2><p>${GAMES[game].blurb}</p>
      <span class="daily-card-foot"><span class="state state-${record?.status ?? 'new'}">${state}</span>${stat.current ? `<span class="streak" title="Current streak">🔥 ${stat.current}</span>` : ''}</span></a>`;
  }).join('');
  main.innerHTML = `<div class="shell daily">
    <div class="daily-head"><div><p class="eyebrow">Puzzle #${meta.today} · ${dateLabel(meta.today)}</p><h1 tabindex="-1">Daily Telugu movie games</h1>
      <p class="lede">Three new Tollywood puzzles every day. Same film for everyone, no login, and your streak stays in your browser.</p></div>
      <div class="daily-tools">${langControl()}<button type="button" class="btn secondary small" data-stats>${icon('trophy', 18)} Stats</button></div></div>
    <div class="daily-grid">${cards}</div>
    <p class="next-line">New puzzles in <time id="count">--:--:--</time> (midnight IST)</p>
    <div class="hub-links"><button type="button" class="btn secondary small" data-suggest>${icon('plus', 18)} Suggest a film</button>
      <a class="btn secondary small" href="/how-to-play">How to play</a><a class="btn secondary small" href="/">More games</a></div></div>`;
  ui = { rerender: hub, game: 'frame' };
  countdown($('#count', main));
}

// ----- the game page -----
async function gamePage(game, n) {
  const main = $('#main');
  const cfg = GAMES[game];
  const max = S.MAX[game];
  const isToday = n === meta.today;
  let record = S.getRecord(game, n);
  if (!record) {
    try {
      const puzzle = await request(`/api/daily/puzzle?game=${game}&n=${n}`);
      record = { status: 'playing', guesses: [], clues: puzzle.clue ? [puzzle.clue] : [], hints: [], shown: {} };
    } catch (error) {
      main.innerHTML = `<div class="shell prose"><h1>${esc(cfg.name)}</h1><p class="lede">${esc(error.message)}</p><p><a class="btn primary" href="/play/${game}">Play today's puzzle</a></p></div>`;
      return;
    }
  }
  const friend = S.friendScore(game, location.search);
  const finished = () => S.isDone(record);
  const save = () => S.putRecord(game, n, record);

  main.innerHTML = `<div class="shell daily game-page">
    <div class="game-top"><a class="back-link" href="/play">${icon('back', 18)} Daily games</a>
      <div class="daily-tools">${langControl()}<button type="button" class="btn secondary small" data-stats>${icon('trophy', 18)} Stats</button></div></div>
    <header class="game-head"><p class="eyebrow">${isToday ? 'Today' : 'Archive'} · #${n} · ${dateLabel(n)}</p><h1 tabindex="-1">${cfg.name}</h1><p class="lede">${cfg.rule}</p></header>
    <div id="friend"></div><section id="clues" aria-label="Clues"></section>${game === 'clues'
      ? '<section id="entry"></section><section id="board" aria-label="Your guesses"></section>'
      : '<section id="board" aria-label="Your guesses"></section><section id="entry"></section>'}
    <details class="archive" id="archive"><summary>Archive: the last ${meta.today - meta.from + 1} puzzles</summary><div class="archive-grid" id="archive-grid"></div></details>
    <p class="game-foot"><button type="button" class="link-button" data-suggest>Suggest a film</button> <span aria-hidden="true">·</span> <a href="/how-to-play">How to play</a></p></div>`;

  const guessedIds = () => new Set(record.guesses.map(guess => guess.id).filter(Boolean));

  function renderFriend() {
    const box = $('#friend');
    if (!friend) { box.innerHTML = ''; return; }
    let text = friend.solved ? `A friend solved this in ${friend.tries} ${friend.tries === 1 ? 'guess' : 'guesses'}. Can you beat it?` : 'A friend could not solve this one. Can you?';
    if (record.status === 'won' && friend.solved) {
      const tries = record.guesses.length;
      text = tries < friend.tries ? `You beat your friend! ${tries} vs ${friend.tries}.` : tries === friend.tries ? `You tied your friend, both ${tries}.` : `Your friend was quicker: ${friend.tries} vs your ${tries}.`;
    } else if (record.status === 'won') text = 'You solved the one your friend missed!';
    else if (record.status === 'lost') text = friend.solved ? `Your friend got it in ${friend.tries}. Try again tomorrow.` : 'Neither of you got this one.';
    box.innerHTML = `<p class="friend-banner">${icon('trophy', 18)} ${esc(text)}</p>`;
  }

  function renderClues() {
    const box = $('#clues');
    if (game === 'clues') {
      const hints = record.hints.map((hint, i) => record.shown[i]
        ? `<p class="hint-open"><span>${esc(hint.label)}</span><strong>${esc(hint.value)}</strong></p>`
        : `<button type="button" class="btn secondary small" data-hint="${i}">Show hint ${i + 1}</button>`).join('');
      box.innerHTML = `<div class="legend" aria-label="Tile colours"><span class="tile-key hit"></span> exact <span class="tile-key near"></span> close <span class="tile-key miss"></span> no match <span class="arrow-key">▲▼ the secret year is later or earlier</span></div>${hints ? `<div class="hint-box"><h2>Hints</h2>${hints}</div>` : ''}`;
      box.querySelectorAll('[data-hint]').forEach(button => button.addEventListener('click', () => {
        record.shown[button.dataset.hint] = true;
        save();
        renderClues();
      }));
      return;
    }
    const cards = record.clues.map((clue, i) => {
      const fresh = i === record.clues.length - 1 && record.guesses.length > 0 && !finished() ? ' is-new' : '';
      if (clue.type === 'frame') return `<figure class="clue-card clue-frame${fresh}"><img src="${esc(clue.src)}" alt="${esc(clue.label)} from the film" width="820" height="460"><figcaption>${esc(clue.label)}</figcaption></figure>`;
      if (clue.type === 'line') return `<blockquote class="clue-card clue-line${fresh}"><p>${esc(clue.text)}</p><footer>${esc(clue.label)}</footer></blockquote>`;
      return `<div class="clue-card clue-hint${fresh}"><span>${esc(clue.label)}</span><strong>${esc(clue.value)}</strong></div>`;
    }).reverse();
    box.innerHTML = `<div class="clue-stack">${cards.join('')}</div>`;
  }

  function renderBoard() {
    const box = $('#board');
    if (game === 'clues') {
      const rows = record.guesses.map((guess, i) => {
        const film = filmMap.get(guess.id);
        const tiles = guess.tiles ? guess.tiles.map(tile => {
          const arrow = tile.arrow ? `<em class="arrow" aria-label="the secret film is ${tile.arrow === 'up' ? 'later' : 'earlier'}">${tile.arrow === 'up' ? '▲' : '▼'}</em>` : '';
          const label = { hit: 'exact match', near: 'close', miss: 'no match' }[tile.state];
          return `<div class="tile ${tile.state}" role="listitem" aria-label="${esc(tile.label)}: ${esc(tile.value)}, ${label}"><span class="tile-label">${esc(tile.label)}</span><span class="tile-value">${esc(tile.value)}</span>${arrow}</div>`;
        }).join('') : '<p class="skipped">Skipped</p>';
        return `<li class="guess-row-board"><p class="guess-name"><span>${i + 1}</span> ${esc(film ? titleOf(film) : guess.title ?? 'Skipped')}</p><div class="tile-row" role="list">${tiles}</div></li>`;
      }).reverse();
      box.innerHTML = rows.length ? `<ol class="tile-board">${rows.join('')}</ol>` : '<p class="muted-note">Your first guess shows how close you are.</p>';
      return;
    }
    const pips = Array.from({ length: max }, (_, i) => {
      const guess = record.guesses[i];
      if (!guess) return '<span class="pip"></span>';
      const right = record.status === 'won' && i === record.guesses.length - 1;
      return `<span class="pip ${right ? 'right' : 'wrong'}" aria-label="${right ? 'correct' : 'wrong'}">${right ? '✓' : '✕'}</span>`;
    }).join('');
    const wrong = record.guesses.filter((_, i) => !(record.status === 'won' && i === record.guesses.length - 1));
    box.innerHTML = `<div class="pips" role="img" aria-label="${record.guesses.length} of ${max} guesses used">${pips}</div>${wrong.length ? `<ul class="wrong-list">${wrong.map(guess => `<li>${guess.id ? esc(shownTitle(guess)) : 'Skipped'}</li>`).join('')}</ul>` : ''}`;
  }

  function renderEntry() {
    const box = $('#entry');
    if (finished()) { renderResult(box); return; }
    box.innerHTML = `<form class="guess-form" autocomplete="off" novalidate>
      <label class="sr-only" for="g-input">Film name</label>
      <div class="guess-line"><div class="combo"><input id="g-input" type="text" role="combobox" aria-expanded="false" aria-controls="g-list" aria-autocomplete="list" placeholder="Type a film name…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go">
        <ul id="g-list" class="combo-list" role="listbox" hidden></ul></div>
        <button class="btn primary" type="submit">Guess</button></div>
      <div class="guess-meta"><button class="btn secondary small" type="button" data-skip>Skip</button><p class="guess-count">Guess ${record.guesses.length + 1} of ${max}. Skip uses a guess.</p></div>
      <p class="status" id="g-status" role="status"></p></form>`;
    bindForm(box);
  }

  function bindForm(box) {
    const form = $('form', box);
    const input = $('#g-input', box);
    const list = $('#g-list', box);
    const status = $('#g-status', box);
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
      }).filter(item => item.rank < 9).sort((a, b) => a.rank - b.rank || titleOf(a.film).localeCompare(titleOf(b.film))).slice(0, 8).map(item => item.film);
      list.innerHTML = options.map((film, i) => `<li role="option" id="opt-${i}" data-id="${esc(film.id)}" aria-selected="false"><span>${esc(titleOf(film))}</span>${otherTitle(film) ? `<small ${lang === 'te' ? '' : 'lang="te"'}>${esc(otherTitle(film))}</small>` : ''}</li>`).join('');
      list.hidden = !options.length;
      input.setAttribute('aria-expanded', String(options.length > 0));
      active = -1;
    };
    const highlight = next => {
      active = (next + options.length) % options.length;
      list.querySelectorAll('[role=option]').forEach((item, i) => item.setAttribute('aria-selected', String(i === active)));
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
      const item = event.target.closest('[role=option]');
      if (item) pick(filmMap.get(item.dataset.id));
    });

    let busy = false;
    async function send(extra) {
      if (busy) return;
      busy = true;
      form.querySelectorAll('button').forEach(button => { button.disabled = true; });
      status.className = 'status';
      status.textContent = '';
      try {
        const res = await request('/api/daily/guess', { game, n, misses: record.guesses.length, ...extra });
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
        record.guesses.push(res.guessed ? { id: res.guessed.id, title: res.guessed.title, tiles: res.tiles } : { skipped: true, tiles: null });
        if (res.clue) record.clues.push(res.clue);
        if (res.hint) { record.hints.push(res.hint); toast('A hint is ready. Open it if you want it.'); }
        if (res.correct || res.over) {
          record.status = res.correct ? 'won' : 'lost';
          record.answer = res.answer;
          record.live = isToday;
        }
        save();
        renderAll();
        if (finished()) $('#r-title')?.focus();
        else $('#g-input')?.focus();
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

  function renderResult(box) {
    const won = record.status === 'won';
    const answer = record.answer ?? {};
    const film = filmMap.get(answer.id);
    const link = `${location.origin}/play/${game}${isToday ? '' : `/${n}`}`;
    const text = S.shareText(game, n, record, link);
    const challenge = S.challengeLink(location.origin, game, n, record);
    const challengeText = S.challengeText(game, n, record, challenge);
    const stat = S.stats(game, meta.today);
    const name = film ? titleOf(film) : answer.title;
    const other = film ? otherTitle(film) : '';
    box.innerHTML = `<div class="result"><h2 id="r-title" tabindex="-1">${won ? (record.guesses.length === 1 ? 'First try!' : 'You got it!') : 'Not this time'}</h2>
      <p class="result-score">${won ? `Solved in ${record.guesses.length} of ${max}.` : 'The answer was:'}</p>
      <div class="answer-card">${answer.image ? `<img src="${esc(answer.image)}" alt="A frame from ${esc(name)}" width="820" height="460">` : ''}
        <div><h3>${esc(name)}</h3>${other ? `<p class="alt-title"${lang === 'te' ? '' : ' lang="te"'}>${esc(other)}</p>` : ''}
          <dl><div><dt>Year</dt><dd>${esc(answer.year ?? '')}</dd></div><div><dt>Hero</dt><dd>${esc(answer.hero ?? '')}</dd></div><div><dt>Director</dt><dd>${esc(answer.director ?? '')}</dd></div><div><dt>Music</dt><dd>${esc(answer.music ?? '')}</dd></div></dl></div></div>
      <pre class="share-preview" aria-label="Your result">${esc(text)}</pre>
      <div class="share-row"><button type="button" class="btn primary" data-copy="result">Copy result</button>
        <a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">WhatsApp</a>
        <a class="btn secondary" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}">Post on X</a>
        ${navigator.share ? '<button type="button" class="btn secondary" data-share>Share…</button>' : ''}
        <button type="button" class="btn secondary" data-copy="challenge">${icon('trophy', 18)} Challenge a friend</button></div>
      <div class="stat-grid mini"><div><strong>${stat.played}</strong><span>Played</span></div><div><strong>${stat.winRate}%</strong><span>Win rate</span></div><div><strong>${stat.current}</strong><span>Streak</span></div><div><strong>${stat.best}</strong><span>Best</span></div></div>
      ${isToday ? '<p class="next-line">Next puzzle in <time id="count">--:--:--</time></p>' : `<p class="next-line"><a href="/play/${game}">Play today's puzzle</a></p>`}
      <div class="more-games">${ORDER.filter(other => other !== game).map(other => `<a class="btn secondary small" href="/play/${other}">${GAMES[other].name}</a>`).join('')}<button type="button" class="btn secondary small" data-suggest>Suggest a film</button></div></div>`;
    $('[data-copy=result]', box).addEventListener('click', async () => toast((await copy(text)) ? 'Result copied' : 'Could not copy, select the text instead'));
    $('[data-copy=challenge]', box).addEventListener('click', async () => toast((await copy(challengeText)) ? 'Challenge link copied. Send it to a friend!' : 'Could not copy the link'));
    $('[data-share]', box)?.addEventListener('click', () => navigator.share({ text }).catch(() => {}));
    const count = $('#count', box);
    if (count) countdown(count);
  }

  function renderArchive() {
    const grid = $('#archive-grid');
    const cells = [];
    for (let k = meta.today; k >= meta.from; k--) {
      const rec = S.getRecord(game, k);
      const state = rec?.status === 'won' ? 'won' : rec?.status === 'lost' ? 'lost' : rec ? 'playing' : 'new';
      const label = { won: 'solved', lost: 'missed', playing: 'in progress', new: 'not played' }[state];
      cells.push(`<a class="arch-item ${state}" href="/play/${game}${k === meta.today ? '' : `/${k}`}"${k === n ? ' aria-current="page"' : ''} aria-label="Puzzle ${k}, ${shortDate(k)}, ${label}"><strong>#${k}</strong><small>${shortDate(k)}</small><i aria-hidden="true">${state === 'won' ? '✓' : state === 'lost' ? '✕' : state === 'playing' ? '…' : ''}</i></a>`);
    }
    grid.innerHTML = cells.join('');
  }

  function renderAll() {
    renderFriend();
    renderClues();
    renderBoard();
    renderEntry();
    renderArchive();
  }
  ui = { rerender: renderAll, game };
  renderAll();
}

// ----- start -----
async function boot() {
  const route = /^\/play(?:\/(frame|dialogue|clues)(?:\/(\d+))?)?$/.exec(location.pathname);
  try {
    [meta, films] = await Promise.all([request('/api/daily/meta'), request('/api/daily/films')]);
    filmMap = new Map(films.map(film => [film.id, film]));
    bindMain($('#main'));
    if (route?.[1]) await gamePage(route[1], route[2] ? Number(route[2]) : meta.today);
    else hub();
    $('#main h1')?.focus({ preventScroll: true });
  } catch (error) {
    $('#boot').innerHTML = `<h1>Daily Telugu movie games</h1><p class="lede">${esc(error.message || 'The puzzles could not load.')} Refresh to try again.</p>`;
  }
}
boot();
