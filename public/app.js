import { answerFormats, modes } from './modes.js';
import { icon, cardArt } from './art.js';
import * as sound from './sound.js';

const main = document.querySelector('main');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const letters = ['A', 'B', 'C', 'D'];
const placeholder = 'No fresh sets right now';
let selectedIndustry = new URLSearchParams(location.search).get('industry') || 'tollywood';
let renderedPath = location.pathname;
let openingRound = false;

async function api(path, { method = 'GET', body, signal } = {}) {
  const binary = body instanceof Blob;
  const response = await fetch('/api' + path, {
    method,
    signal,
    headers: body === undefined ? {} : { 'Content-Type': binary ? 'application/octet-stream' : 'application/json' },
    body: body === undefined || binary ? body : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Something went wrong. Try again.'), { status: response.status });
  return result;
}
function post(path, body = {}) { return api(path, { method: 'POST', body }); }
function status(message, error = false, scope = main) {
  const region = scope.querySelector('.status');
  if (!region) return;
  region.textContent = message;
  region.classList.toggle('error', error);
}
function action(button, work) {
  return async event => {
    event?.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    const scope = button.closest('dialog') ?? main;
    status('', false, scope);
    try { await work(event); }
    catch (error) { status(error.message, true, scope); }
    finally { button.disabled = false; }
  };
}
function button(selector, work) {
  const el = main.querySelector(selector);
  if (el) el.addEventListener('click', action(el, work));
}
function modeOptions(value) {
  return Object.entries(modes).map(([id, mode]) => `<option value="${id}" ${id === value ? 'selected' : ''}>${mode.name}</option>`).join('');
}
function industryOptions(industries, value) {
  return industries.map(({ id, name }) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(name)}</option>`).join('');
}
function lobbyURL(industry) {
  return industry === 'tollywood' ? '/#games' : `/?industry=${encodeURIComponent(industry)}#games`;
}
async function startRound(industry, mode, trigger, answerFormat, level) {
  if (openingRound) return;
  openingRound = true;
  const label = trigger.querySelector('.format-label') ?? trigger;
  const originalText = label.innerHTML;
  label.textContent = 'Opening…';
  trigger.setAttribute('aria-busy', 'true');
  try {
    const round = await api('/rounds', {
      method: 'POST',
      body: { industry, mode, answerFormat, ...(level ? { level } : {}) },
      signal: AbortSignal.timeout(8000),
    });
    if (!trigger.isConnected) return;
    trigger.closest('dialog')?.close();
    const path = `/round/${round.id}`;
    if (location.pathname !== path) history.pushState(null, '', path);
    renderedPath = path;
    showRound(round);
    window.scrollTo(0, 0);
  } catch (error) {
    if (!trigger.isConnected) return;
    if (error.name === 'TimeoutError' || error instanceof TypeError) {
      throw new Error('The round couldn’t load. Try again.');
    }
    throw error;
  } finally {
    openingRound = false;
    label.innerHTML = originalText;
    trigger.removeAttribute('aria-busy');
  }
}

function beginRound(industry, mode, trigger) {
  if (modes[mode].reveal) return startRound(industry, mode, trigger, 'reveal');
  chooseFormat(industry, mode);
}

function showLevels(data, industryId, modeId) {
  const mode = modes[modeId];
  const levels = data.levels.filter(item => item.industry === industryId && item.mode === modeId);
  const done = levels.filter(item => item.state === 'done').length;
  document.title = `${mode.name} | Movie Games Adda`;
  main.innerHTML = `<div class="shell play-shell"><a href="${lobbyURL(industryId)}" class="back-link">${icon('back', 18)} All games</a>
    <section class="panel levels">
      <p class="subtle">${esc(mode.name)}</p>
      <h1 id="question-title" tabindex="-1">Choose a level</h1>
      <p>Each level has ten ${mode.unit ?? 'questions'}. Finish a level to unlock the next one. ${done} of ${levels.length} complete.</p>
      <div class="level-grid">${levels.map(item => {
        const locked = item.state === 'locked';
        const label = { done: `${item.score} / 10`, playing: 'Resume', open: 'Start', locked: 'Locked' }[item.state];
        const glyph = item.state === 'done' ? icon('check', 18) : locked ? icon('lock', 18) : icon('play', 18);
        return `<button type="button" class="level-tile level-${item.state}" data-level="${item.level}" ${locked || item.state === 'done' ? 'disabled' : ''} aria-label="Level ${item.level}, ${label}">
          <span class="level-glyph">${glyph}</span><strong>Level ${item.level}</strong><small>${label}</small></button>`;
      }).join('')}</div>
      <p class="status" role="status"></p>
    </section></div>`;
  main.querySelectorAll('[data-level]').forEach(el => {
    el.addEventListener('click', action(el, () => startRound(industryId, modeId, el, 'reveal', Number(el.dataset.level))));
  });
  main.querySelector('#question-title').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

let revealTimer;
function chooseFormat(industry, mode) {
  const dialog = document.createElement('dialog');
  dialog.className = 'format-picker';
  dialog.setAttribute('aria-labelledby', 'format-title');
  dialog.innerHTML = `<div class="dialog-top"><div><p class="subtle">${esc(modes[mode].name)}</p><h2 id="format-title">How do you want to answer?</h2></div>
    <button class="icon-button" type="button" aria-label="Close">${icon('close')}</button></div>
    <div class="format-choices">${Object.entries(answerFormats).filter(([id]) => id !== 'reveal').map(([id, format]) => `
      <button class="format-choice" type="button" data-format="${id}">
        <span class="format-icon">${icon(id === 'typed' ? 'keyboard' : 'choices', 22)}</span>
        <span><strong class="format-label">${esc(format.label)}</strong><small>${esc(format.description)}</small></span>
        ${icon('arrow', 17)}
      </button>`).join('')}</div><p class="status" role="status"></p>`;
  main.append(dialog);
  dialog.querySelector('.icon-button').addEventListener('click', () => dialog.close());
  dialog.querySelectorAll('[data-format]').forEach(el => {
    el.addEventListener('click', action(el, () => startRound(industry, mode, el, el.dataset.format)));
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

window.addEventListener('popstate', () => {
  if (location.pathname !== renderedPath) location.reload();
});

function home(data) {
  const industry = data.industries.find(item => item.id === selectedIndustry) ?? data.industries[0];
  selectedIndustry = industry.id;
  const stats = id => data.counts.find(row => row.industry === industry.id && row.mode === id) ?? { live: 0, played: 0 };
  const activeRound = id => data.active.find(round => round.industry === industry.id && round.mode === id);
  const statsText = id => {
    const { live, played } = stats(id);
    const active = activeRound(id);
    if (modes[id].soon) return 'In the works';
    if (modes[id].levels) {
      const list = data.levels.filter(item => item.industry === industry.id && item.mode === id);
      const finished = list.filter(item => item.state === 'done').length;
      if (!list.length) return 'New questions coming';
      return finished === list.length ? 'All levels complete' : `${list.length} levels · ${finished} done`;
    }
    if (active) return answerFormats[active.answerFormat].label;
    if (!live) return 'New questions coming';
    if (live === played) return placeholder;
    return live - played === 1 ? '10 questions' : `${live - played} fresh rounds`;
  };
  const liveModes = Object.entries(modes).filter(([, mode]) => !mode.soon);
  const soonModes = Object.entries(modes).filter(([, mode]) => mode.soon);
  const games = liveModes.map(([id, mode]) => {
    const active = activeRound(id);
    const ready = stats(id).live > stats(id).played || active || (modes[id].levels && stats(id).live > 0);
    return `<article class="game-card game-${id}">
      <div class="card-visual">${cardArt(id)}</div>
      <div class="card-body">
        <h3>${esc(mode.name)}</h3><p>${esc(mode.desc)}</p>
        <div class="card-bottom"><span>${esc(statsText(id))}</span>
        <button type="button" class="round-link" data-mode="${id}" ${ready ? '' : 'disabled'} aria-label="${active ? 'Resume' : 'Play'} ${esc(mode.name)}">${active ? 'Resume' : 'Play'} ${icon('arrow', 16)}</button></div>
      </div>
    </article>`;
  }).join('');
  const soonItems = soonModes.map(([id, mode]) => `<article class="soon-item">${icon(id, 20)}<h4>${esc(mode.name)}</h4><p>${esc(mode.desc)}</p></article>`).join('');
  document.title = `Movie Games Adda | The ${industry.name} movie quiz`;
  main.innerHTML = `<div class="shell home">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <h1 id="hero-title">The ${esc(industry.name)}<br>movie quiz.</h1>
        <p>Name actors from a blurred photo and songs from five seconds of audio. Ten questions a level.</p>
        <a class="btn primary" href="#games">Choose a game ${icon('arrow', 18)}</a>
      </div>
    </section>
    <section id="games" class="games-section" aria-labelledby="games-title">
      <div class="section-top">
        <div><h2 id="games-title">Choose a game</h2><p>${Object.values(modes).filter(item => !item.soon).length} games to play now, ${Object.values(modes).filter(item => item.soon).length} more coming soon.</p></div>
        ${data.industries.length > 1 ? `<label class="industry-pill">${icon('film', 17)}<span class="sr-only">Film industry</span><select id="industry">${industryOptions(data.industries, industry.id)}</select></label>` : `<div class="industry-pill">${icon('film', 17)} ${esc(industry.name)}</div>`}
      </div>
      <p class="status" role="status"></p>
      <div class="game-grid">${games}</div>
      <div class="soon"><h3>Coming soon</h3><div class="soon-list">${soonItems}</div></div>
    </section>
    <section id="how" class="how" aria-labelledby="how-title">
      <h2 id="how-title">How to play</h2>
      <div class="steps">
        <div>${icon('film', 20)}<div><strong>Pick a game</strong><p>Each level has ten questions.</p></div></div>
        <div>${icon('play', 20)}<div><strong>Type it, or pass</strong><p>Name the actor or actress from the photo. Close spellings count. For songs, reveal the answer and score yourself.</p></div></div>
        <div>${icon('lock', 20)}<div><strong>Unlock the next level</strong><p>Finish a level to open the next one.</p></div></div>
      </div>
    </section>
  </div>`;
  main.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', action(el, () => {
    const mode = el.dataset.mode;
    if (modes[mode].levels) return showLevels(data, industry.id, mode);
    const active = activeRound(mode);
    if (active) return startRound(industry.id, mode, el, active.answerFormat);
    return beginRound(industry.id, mode, el);
  })));
  main.querySelector('#industry')?.addEventListener('change', event => {
    selectedIndustry = event.target.value;
    history.replaceState({}, '', lobbyURL(selectedIndustry));
    home(data);
    main.querySelector('#industry').focus();
  });
  if (location.hash === '#games' || location.hash === '#how') document.querySelector(location.hash).scrollIntoView();
}

function showRound(round) {
  const mode = modes[round.mode];
  const typed = round.answerFormat === 'typed';
  const reveal = round.answerFormat === 'reveal';
  const song = reveal && mode.clue === 'audio';
  const photoGuess = reveal && !song && Boolean(mode.typedGuess);
  clearInterval(revealTimer);
  const back = lobbyURL(round.industry);
  document.title = `${mode.name} | Movie Games Adda`;
  if (round.complete) {
    main.innerHTML = `<div class="shell play-shell"><a href="${back}" class="back-link">${icon('back', 18)} All games</a>
      <section class="results panel">
        <p class="subtle">${esc(mode.name)}${round.level ? ` · Level ${round.level}` : ''}${reveal ? '' : typed ? ' · Typed answers' : ' · Multiple choice'}</p>
        <h1 tabindex="-1" id="question-title">Round complete</h1>
        <div class="score">${round.score}<span> / 10</span></div>
        <p>${reveal ? (photoGuess ? `You named ${round.score} of 10.` : `You recognised ${round.score} of 10.`) : `You got ${round.score} of 10 correct.`}</p>
        <div class="result-actions">${mode.levels
          ? `<button type="button" class="btn primary" id="${round.nextLevel ? 'next-level' : 'all-levels'}">${round.nextLevel ? `Continue to Level ${round.nextLevel} ${icon('arrow', 18)}` : 'All levels'}</button>`
          : `<button type="button" class="btn primary" id="replay">${icon('repeat', 19)} Play again</button>`}<a class="btn secondary" href="${back}">Choose a game</a></div>${mode.levels && round.nextLevel ? `<p class="unlock-note">${icon('check', 16)} Level ${round.nextLevel} unlocked.</p>` : ''}
        <p class="status" role="status"></p>
        <details class="review"><summary>Review your answers</summary><ol>${round.review.map(item => `<li><span class="${item.correct ? 'correct-text' : 'incorrect-text'}">${icon(item.correct ? 'check' : 'close', 18)}</span><div>${esc(item.answer)}${item.correct ? '' : `<small>Your answer: ${esc(item.picked)}</small>`}</div></li>`).join('')}</ol></details>
      </section></div>`;
    button('#replay', () => beginRound(round.industry, round.mode, main.querySelector('#replay')));
    button('#next-level', () => startRound(round.industry, round.mode, main.querySelector('#next-level'), 'reveal', round.nextLevel));
    button('#all-levels', async () => showLevels(await api('/catalog'), round.industry, round.mode));
    main.querySelector('#question-title').focus({ preventScroll: true });
    return;
  }
  const { question, feedback, position } = round;
  const prompt = round.starter && round.mode === 'frame' ? 'Which movie inspired this scene?' : mode.prompt;
  const clueRenderers = {
    image: () => `<figure class="clue clue-frame"><img src="${esc(question.media)}" alt="${esc(question.alt)}">${question.text ? `<figcaption>${esc(question.text)}</figcaption>` : ''}</figure>`,
    audio: () => `<div class="clue clue-audio">${cardArt('audio')}<audio aria-label="Movie audio clue" controls preload="none" src="${esc(question.media)}"></audio><details><summary>Read the audio clue</summary><p>${esc(question.alt)}</p></details></div>`,
    lyric: () => `<blockquote class="clue clue-lyric">“${esc(question.text)}”</blockquote>`,
    emoji: () => `<div class="clue clue-emoji">${esc(question.text)}</div>`,
    text: () => `<div class="clue clue-text">${esc(question.text)}</div>`,
  };
  const revealed = Boolean(feedback);
  const d = question.details ?? {};
  const row = (label, value) => value ? `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>` : '';
  const songClue = () => `<div class="clue clue-song ${revealed ? 'is-revealed' : ''}">
      ${revealed ? '' : `<div class="song-stage" id="song-stage"><div class="eq" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
        <p class="song-status" id="song-status" role="status">Listen closely…</p><audio id="clip" preload="auto" src="${esc(question.media)}"></audio></div>`}
      <div class="song-card" id="song-card" ${revealed ? '' : 'hidden'}>
        <h2>${esc(question.name)}</h2><p class="song-sub">${esc(d.movie ?? '')}${d.year ? ` · ${esc(d.year)}` : ''}</p>
        <dl>${row('Music', d.composer)}${row('Singers', d.singers)}${row('Lyrics', d.lyricist)}</dl>
        ${d.note ? `<p class="song-note">${esc(d.note)}</p>` : ''}
      </div></div>`;
  const clue = song ? songClue() : reveal
    ? `<figure class="clue clue-photo ${revealed ? 'is-revealed' : ''}"><img id="photo" src="${esc(question.media)}" alt="${revealed ? esc(question.name) : 'Blurred photo'}" draggable="false">
        ${revealed ? '' : '<div class="photo-timer" aria-live="off"><span id="count">5</span></div>'}
        <figcaption id="reveal-name" ${revealed ? '' : 'hidden'}>${esc(question.name)}</figcaption></figure>`
    : (clueRenderers[mode.clue ?? round.mode] ?? clueRenderers.text)();
  const options = question.options?.map((option, index) => {
    const correct = feedback && index === feedback.correctIndex;
    const wrong = feedback && index === feedback.picked && !feedback.correct;
    return `<button type="button" class="option ${correct ? 'option-correct' : ''} ${wrong ? 'option-wrong' : ''}" data-pick="${index}" ${feedback ? 'disabled' : ''}><span class="option-letter">${letters[index]}</span><span>${esc(option)}</span>${correct || wrong ? icon(correct ? 'check' : 'close', 19) : ''}</button>`;
  }).join('');
  const revealControl = feedback
    ? `<p class="submitted-guess">${photoGuess ? (feedback.passed ? '<strong>You passed</strong>' : `<strong>You typed</strong> ${esc(feedback.guess)}`) : `<strong>You said</strong> ${feedback.correct ? 'I guessed it' : 'I didn’t'}`}</p>`
    : photoGuess ? `<form class="guess-form" id="guess-form" novalidate>
        <label class="sr-only" for="guess">Your answer</label>
        <div class="guess-row"><input id="guess" name="guess" type="text" maxlength="120" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Type the name"><button class="btn primary" type="submit">Submit</button></div>
        <button type="button" class="btn secondary guess-pass" id="guess-pass">Pass</button>
      </form>`
    : `<div class="reveal-actions" id="reveal-actions" hidden><button type="button" class="btn guess-yes" data-self="0">${icon('check', 20)} Yes, I guessed</button><button type="button" class="btn guess-no" data-self="1">${icon('close', 20)} No, I didn’t</button></div>
       ${song ? '<div class="song-actions" id="song-actions"><button type="button" class="btn secondary" id="play-clip">Play clip</button><button type="button" class="btn primary" id="reveal-song">Reveal song</button></div>' : '<button type="button" class="btn secondary reveal-now" id="reveal-now">Reveal now</button>'}`;
  const answerControl = reveal ? revealControl : typed ? (feedback
    ? `<p class="submitted-guess"><strong>Your answer</strong> ${esc(feedback.guess)}</p>`
    : `<form class="typed-answer"><label>Your answer<input name="guess" type="text" required maxlength="120" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Type your guess"></label><button class="btn primary" type="submit">Submit answer</button></form>`)
    : `<div class="options">${options}</div>`;
  main.innerHTML = `<div class="shell play-shell">
    <div class="play-top"><a href="${back}" class="back-link">${icon('back', 18)} All games</a>${reveal && !song ? `<button type="button" class="sound-toggle" id="sound-toggle" aria-pressed="${sound.isMuted()}">${icon(sound.isMuted() ? 'mute' : 'volume', 18)}<span>${sound.isMuted() ? 'Sound off' : 'Sound on'}</span></button>` : ''}</div>
    <section class="panel quiz${photoGuess ? ' typed-photo' : ''}" aria-labelledby="question-title">
      <div class="quiz-meta"><span>${esc(mode.name)} · ${esc(round.title)}</span><strong>Question ${position + 1} of 10</strong></div>
      <h1 id="question-title" tabindex="-1">${esc(prompt)}</h1>
      ${clue}
      ${round.starter && mode.clue === 'image' && !reveal ? `<p class="clue-credit">Illustrated ${round.mode === 'meme' ? 'meme' : 'scene'} recreation</p>` : ''}
      ${round.starter && round.mode === 'audio' ? '<p class="clue-credit">Original narrated clue</p>' : ''}
      ${answerControl}
      <p class="status" role="status"></p>
      ${feedback ? `<div class="answer-footer"><p class="${feedback.correct ? 'correct-text' : 'incorrect-text'}" role="status">${reveal ? (feedback.correct ? 'Nice! +1 point' : `It was ${esc(feedback.correctAnswer)}`) : feedback.correct ? 'Correct! +1 point' : `Correct answer: ${esc(feedback.correctAnswer)}`}</p><button type="button" id="next" class="btn primary">${position === 9 ? 'See score' : 'Next question'} ${icon('arrow', 18)}</button></div>` : ''}
    </section>
  </div>`;
  let pending = false;
  const submitAnswer = async answer => {
    if (pending) return;
    pending = true;
    try { showRound(await post(`/rounds/${round.id}/answer`, { questionId: question.id, ...answer })); }
    finally { pending = false; }
  };
  main.querySelectorAll('[data-pick]').forEach(el => {
    el.addEventListener('click', action(el, () => submitAnswer({ picked: Number(el.dataset.pick) })));
  });
  main.querySelectorAll('[data-self]').forEach(el => {
    el.addEventListener('click', action(el, async () => {
      if (pending) return;
      pending = true;
      try {
        const reaction = sound.react(Number(el.dataset.self) === 0);
        el.classList.add('is-chosen');
        el.closest('.reveal-actions')?.classList.add('is-reacting');
        await post(`/rounds/${round.id}/answer`, { questionId: question.id, picked: Number(el.dataset.self) });
        const nextRound = await post(`/rounds/${round.id}/next`, { questionId: question.id });
        await Promise.race([reaction, new Promise(resolve => setTimeout(resolve, 4000))]);
        showRound(nextRound);
        window.scrollTo(0, 0);
      } finally { pending = false; }
    }));
  });
  if (song && !feedback) {
    const clip = main.querySelector('#clip');
    const statusText = main.querySelector('#song-status');
    const stage = main.querySelector('#song-stage');
    const playButton = main.querySelector('#play-clip');
    const left = () => Math.max(0, Math.ceil(5 - clip.currentTime));
    clip.addEventListener('playing', () => { stage.classList.add('playing'); playButton.textContent = 'Play again'; });
    clip.addEventListener('timeupdate', () => { statusText.textContent = `Listening… ${left()}`; });
    clip.addEventListener('ended', () => { stage.classList.remove('playing'); statusText.textContent = 'Clip finished. Do you know it?'; });
    const play = () => { clip.currentTime = 0; return clip.play(); };
    playButton.addEventListener('click', () => { play().catch(() => { statusText.textContent = 'Tap Play clip to listen.'; }); });
    play().catch(() => { statusText.textContent = 'Tap Play clip to listen.'; });
    main.querySelector('#reveal-song').addEventListener('click', () => {
      clip.pause();
      stage.remove();
      main.querySelector('.clue-song').classList.add('is-revealed');
      main.querySelector('#song-card').hidden = false;
      main.querySelector('#song-actions').remove();
      main.querySelector('#reveal-actions').hidden = false;
    });
  }
  if (reveal && !song && !feedback) {
    clearInterval(revealTimer);
    sound.stop();
    sound.play('appear');
    sound.tick(5);
    const photo = main.querySelector('#photo');
    const count = main.querySelector('#count');
    let left = 5;
    // Typed games unblur the photo when time is up but keep the name hidden until the answer is in.
    const clearPhoto = () => {
      clearInterval(revealTimer);
      main.querySelector('.clue-photo').classList.add('is-clear');
      main.querySelector('.photo-timer')?.remove();
      if (window.matchMedia('(pointer: fine)').matches) main.querySelector('#guess')?.focus({ preventScroll: true });
    };
    const showName = () => {
      clearInterval(revealTimer);
      main.querySelector('.clue-photo').classList.add('is-revealed');
      main.querySelector('.photo-timer')?.remove();
      main.querySelector('.photo-bar')?.remove();
      main.querySelector('#reveal-name').hidden = false;
      main.querySelector('#reveal-now')?.remove();
      main.querySelector('#reveal-actions').hidden = false;
      photo.alt = question.name;
    };
    revealTimer = setInterval(() => {
      left -= 1;
      if (count) count.textContent = String(left);
      sound.tick(left);
      if (left <= 0) (photoGuess ? clearPhoto : showName)();
    }, 1000);
    main.querySelector('#reveal-now')?.addEventListener('click', () => { sound.stop(['appear', 'tick', 'tick-hi']); showName(); });
  }
  main.querySelector('#sound-toggle')?.addEventListener('click', event => {
    const off = !sound.isMuted();
    sound.setMuted(off);
    event.currentTarget.setAttribute('aria-pressed', String(off));
    event.currentTarget.innerHTML = `${icon(off ? 'mute' : 'volume', 18)}<span>${off ? 'Sound off' : 'Sound on'}</span>`;
  });
  const guessForm = main.querySelector('#guess-form');
  if (guessForm) {
    const controls = guessForm.querySelectorAll('input, button');
    const send = async body => {
      if (pending) return;
      pending = true;
      clearInterval(revealTimer);
      sound.stop();
      controls.forEach(el => { el.disabled = true; });
      try {
        const next = await post(`/rounds/${round.id}/answer`, { questionId: question.id, ...body });
        if (!body.pass) sound.react(Boolean(next.feedback?.correct));
        showRound(next);
      } catch (error) {
        status(error.message, true);
        controls.forEach(el => { el.disabled = false; });
      } finally { pending = false; }
    };
    guessForm.addEventListener('submit', event => {
      event.preventDefault();
      const value = guessForm.elements.guess.value.trim();
      if (!/[\p{L}\p{N}]/u.test(value)) { status('Type a name, or press Pass.', true); guessForm.elements.guess.focus(); return; }
      send({ guess: value });
    });
    main.querySelector('#guess-pass').addEventListener('click', () => send({ pass: true }));
  }
  const typedForm = main.querySelector('.typed-answer');
  if (typedForm) {
    typedForm.addEventListener('submit', action(typedForm.querySelector('button'), () => {
      return submitAnswer({ guess: typedForm.elements.guess.value });
    }));
  }
  button('#next', async () => {
    showRound(await post(`/rounds/${round.id}/next`, { questionId: question.id }));
    main.querySelector('#question-title').scrollIntoView({ block: 'nearest' });
  });
  if (feedback) main.querySelector('#next').focus({ preventScroll: true });
  else if (photoGuess && window.matchMedia('(pointer: fine)').matches) main.querySelector('#guess').focus({ preventScroll: true });
  else main.querySelector('#question-title').focus({ preventScroll: true });
}

async function admin(message = '') {
  document.title = 'Admin | Movie Games Adda';
  let library;
  try { library = await api('/admin/library'); }
  catch (error) {
    if (error.status !== 401) throw error;
    main.innerHTML = `<div class="shell play-shell"><a href="/" class="back-link">${icon('back', 18)} Back to games</a><section class="panel login">
      <div class="trophy">${icon('lock', 26)}</div><h1>Admin sign-in</h1><p>Sign in to manage your question sets.</p>
      <form><label>Admin password<input type="password" name="password" autocomplete="current-password" required maxlength="1000"></label><button class="btn primary" type="submit">Sign in</button></form>
      <p class="status" role="status"></p></section></div>`;
    const form = main.querySelector('form');
    form.addEventListener('submit', action(form.querySelector('button'), async () => {
      await post('/admin/login', { password: form.elements.password.value });
      await admin();
    }));
    return;
  }
  const industryName = id => library.industries.find(item => item.id === id)?.name ?? id;
  main.innerHTML = `<div class="shell admin">
    <div class="admin-top"><div><a href="/" class="back-link">${icon('back', 18)} Back to games</a><h1>Question library</h1><p>Build ten-question sets and publish them to the games.</p></div><button class="btn secondary" id="logout" type="button">Sign out</button></div>
    <div class="admin-tools">
      <button class="btn primary" id="new" type="button">${icon('plus', 18)} New question set</button>
      <button class="btn secondary" id="import" type="button">${icon('upload', 18)} Import JSON</button>
      <button class="btn secondary" id="new-industry" type="button">${icon('plus', 18)} Add industry</button>
    </div>
    <p class="status" role="status"></p>
    <section class="panel set-library" aria-labelledby="sets-heading">
      <h2 id="sets-heading">Question sets <span>${library.sets.length}</span></h2>
      ${library.sets.length ? `<ul class="set-list">${library.sets.map(set => `<li><div><strong>${esc(set.title)}</strong><small>${esc(industryName(set.industry))} · ${esc(modes[set.mode].name)} · 10 questions</small></div><div class="set-actions"><span class="badge badge-${esc(set.status)}">${esc(set.status)}</span><button class="btn small secondary" type="button" data-open="${esc(set.id)}">${set.status === 'draft' ? 'Edit' : 'View'}</button>${set.status === 'live' ? `<button class="btn small secondary" type="button" data-archive="${esc(set.id)}">Archive</button>` : ''}</div></li>`).join('')}</ul>` : '<p>No sets yet. Create a set to get started.</p>'}
    </section>
    <dialog id="dialog"></dialog>
  </div>`;
  status(message);
  button('#logout', async () => { await post('/admin/logout'); await admin(); });
  button('#new', () => editSet(library));
  button('#import', () => importSets(library));
  button('#new-industry', () => addIndustry());
  main.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', action(el, async () => {
    editSet(library, await api(`/admin/sets/${el.dataset.open}`));
  })));
  main.querySelectorAll('[data-archive]').forEach(el => el.addEventListener('click', action(el, () => {
    showDialog('Archive this set?', '<p>It will stop appearing in new rounds. Players can finish rounds already in progress.</p><button class="btn primary" type="submit">Archive set</button>', async () => {
      await post(`/admin/sets/${el.dataset.archive}/archive`);
      await admin('Set archived.');
    });
  })));
}
function showDialog(title, content, submit) {
  const dialog = main.querySelector('#dialog');
  dialog.innerHTML = `<div class="dialog-top"><h2>${esc(title)}</h2><button class="icon-button" type="button" aria-label="Close dialog">${icon('close')}</button></div><form>${content}<p class="dialog-status" role="status"></p></form>`;
  dialog.setAttribute('aria-label', title);
  dialog.querySelector('.icon-button').addEventListener('click', () => dialog.close());
  const form = dialog.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const control = event.submitter;
    const notice = dialog.querySelector('.dialog-status');
    control.disabled = true;
    notice.textContent = '';
    try { await submit(form); }
    catch (error) { notice.textContent = error.message; }
    finally { control.disabled = false; }
  });
  dialog.showModal();
}
function addIndustry() {
  showDialog('Add a film industry', '<label>Industry name<input name="name" required maxlength="60" placeholder="e.g. Kollywood"></label><button class="btn primary" type="submit">Add industry</button>', async form => {
    await post('/admin/industries', { name: form.elements.name.value });
    await admin('Industry added.');
  });
}
function importSets(library) {
  showDialog('Import question sets', `<p>Each set needs ten questions, four options per question, and a correct answer index from 0 to 3. Include an optional aliases array for alternate spellings. For media questions, upload the file first and use its uploaded path.</p>
    <label>Sets JSON<textarea name="json" required rows="10" spellcheck="false" placeholder='[{"industry":"${esc(library.industries[0].id)}","mode":"emoji","title":"Round name","questions":[{"text":"🎞️","options":["Film A","Film B","Film C","Film D"],"correct":0}]}]'></textarea></label>
    <label>Import as<select name="state"><option value="draft">Draft</option><option value="live">Publish immediately</option></select></label>
    <button class="btn primary" type="submit">Import sets</button>`, async form => {
    let sets;
    try { sets = JSON.parse(form.elements.json.value); }
    catch { throw new Error('Enter a valid JSON array of sets.'); }
    const result = await post('/admin/sets', { sets, status: form.elements.state.value });
    await admin(`${result.ids.length} ${result.ids.length === 1 ? 'set' : 'sets'} imported.`);
  });
}
function editSet(library, existing) {
  const readonly = existing && existing.status !== 'draft';
  const initialMode = existing?.mode ?? 'frame';
  const questions = existing?.questions ?? Array.from({ length: 10 }, () => ({ options: ['', '', '', ''], correct: 0 }));
  const editor = `<div class="shell admin editor">
    <button class="back-link link-button" type="button" id="library-back">${icon('back', 18)} Question library</button>
    <h1>${existing ? (readonly ? 'View question set' : 'Edit question set') : 'New question set'}</h1>
    <p>${readonly ? 'This set has already been published.' : 'Add ten clues and mark one correct answer for each.'}</p>
    <form class="editor-form">
      <fieldset class="panel editor-meta" ${readonly ? 'disabled' : ''}>
        <label>Set title<input name="title" required maxlength="100" value="${esc(existing?.title)}"></label>
        <label><span id="edit-industry-label">Industry</span><select name="industry" aria-labelledby="edit-industry-label">${industryOptions(library.industries, existing?.industry ?? 'tollywood')}</select></label>
        <label><span id="edit-mode-label">Game</span><select name="mode" aria-labelledby="edit-mode-label">${modeOptions(initialMode)}</select></label>
      </fieldset>
      <div id="question-fields">${questions.map((q, i) => `<fieldset class="panel question-fields" ${readonly ? 'disabled' : ''}>
        <legend>Question ${i + 1}</legend>
        <div class="text-fields"><label><span class="clue-label">Clue</span><textarea name="text-${i}" rows="2" maxlength="350">${esc(q.text)}</textarea></label></div>
        <div class="media-fields"><label><span class="file-label">Upload media</span><input name="file-${i}" type="file"></label><label>Uploaded path<input name="media-${i}" value="${esc(q.media)}" maxlength="2000" placeholder="/uploads/…"></label><label><span class="alt-label">Accessible clue text</span><textarea name="alt-${i}" rows="2" maxlength="350">${esc(q.alt)}</textarea></label></div>
        <div class="edit-options">${q.options.map((option, j) => `<label>Option ${letters[j]}<input name="option-${i}-${j}" required maxlength="120" value="${esc(option)}"></label>`).join('')}</div>
        <label class="correct-field">Correct answer<select name="correct-${i}">${letters.map((letter, j) => `<option value="${j}" ${j === q.correct ? 'selected' : ''}>Option ${letter}</option>`).join('')}</select></label>
        <label class="alias-field">Alternate typed answers <small>Optional. Add one spelling, nickname, or Telugu answer per line.</small><textarea name="aliases-${i}" rows="2" maxlength="1451">${esc((q.aliases ?? []).join('\n'))}</textarea></label>
      </fieldset>`).join('')}</div>
      ${readonly ? '' : '<div class="panel editor-actions"><p class="status" role="status"></p><button class="btn secondary" type="submit" value="draft">Save draft</button><button class="btn primary" type="submit" value="live">Publish set</button></div>'}
    </form></div>`;
  main.innerHTML = editor;
  main.scrollIntoView();
  button('#library-back', () => admin());
  const form = main.querySelector('form');
  const fields = form.elements;
  const toggleClues = () => {
    const mode = fields.mode.value;
    const clue = modes[mode].clue;
    const usesMedia = Boolean(clue);
    main.querySelectorAll('.question-fields').forEach((el, i) => {
      el.querySelector('.media-fields').hidden = !usesMedia;
      el.querySelector('.text-fields').hidden = usesMedia && mode !== 'meme';
      el.querySelector('.file-label').textContent = clue === 'image' ? 'Clue image (max 8 MB)' : 'Audio clip (max 8 MB)';
      el.querySelector('.alt-label').textContent = clue === 'image' ? 'Describe the image without giving away the answer' : 'Audio transcript';
      el.querySelector('.clue-label').textContent = {
        emoji: 'Emoji clue', lyric: 'Lyric clue', hero: 'Clues about his roles', heroine: 'Clues about her roles',
        plot: 'Badly explained plot', meme: 'Meme context (optional)',
      }[mode] ?? 'Clue';
      fields[`file-${i}`].accept = clue === 'image' ? 'image/jpeg,image/png,image/webp' : 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,.m4a';
      fields[`text-${i}`].required = !usesMedia;
      fields[`alt-${i}`].required = usesMedia;
    });
  };
  fields.mode.addEventListener('change', toggleClues);
  toggleClues();
  let saving = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (readonly || saving) return;
    const submitter = event.submitter;
    const publish = submitter.value === 'live';
    const mode = fields.mode.value;
    const usesMedia = Boolean(modes[mode].clue);
    saving = true;
    form.querySelectorAll('button[type="submit"]').forEach(el => { el.disabled = true; });
    status('Saving set…');
    try {
      if (usesMedia) {
        for (let i = 0; i < 10; i++) {
          const file = fields[`file-${i}`].files[0];
          const path = fields[`media-${i}`];
          if (file) {
            const media = await post('/admin/media', file);
            path.value = media.url;
            fields[`file-${i}`].value = '';
          }
          if (!path.value.trim()) throw new Error(`Question ${i + 1} needs a media file.`);
        }
      }
      const set = {
        title: fields.title.value, mode, industry: fields.industry.value,
        questions: questions.map((_, i) => ({
          text: fields[`text-${i}`].value, alt: fields[`alt-${i}`].value,
          media: fields[`media-${i}`].value,
          aliases: fields[`aliases-${i}`].value.split(/\r?\n/).map(alias => alias.trim()).filter(Boolean),
          options: letters.map((_, j) => fields[`option-${i}-${j}`].value),
          correct: Number(fields[`correct-${i}`].value),
        })),
      };
      if (existing) {
        await api(`/admin/sets/${existing.id}`, { method: 'PUT', body: set });
        if (publish) await post(`/admin/sets/${existing.id}/publish`);
      } else {
        await post('/admin/sets', { sets: [set], status: publish ? 'live' : 'draft' });
      }
      await admin(publish ? 'Set published. It is now available in the game.' : 'Draft saved.');
      main.scrollIntoView();
    } catch (error) { status(error.message, true); }
    finally {
      saving = false;
      form.querySelectorAll('button[type="submit"]').forEach(el => { el.disabled = false; });
    }
  });
}

try {
  if (location.pathname === '/admin') await admin();
  else if (location.pathname.startsWith('/round/')) showRound(await api(`/rounds/${location.pathname.split('/').at(-1)}`));
  else home(await api('/catalog'));
} catch (error) {
  main.innerHTML = `<div class="shell play-shell"><section class="panel login"><h1>Unable to load this page</h1><p>${esc(error.message)}</p><a class="btn primary" href="/">Back to games</a></section></div>`;
}
