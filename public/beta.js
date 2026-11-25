// The Beta notice above the logo, and the "Found a bug?" form above the footer. Both are added to every page.
const admin = location.pathname.startsWith('/admin');
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

function addBar() {
  const bar = el(`<div class="beta-bar" role="note"><span class="beta-pill">Beta</span><span class="beta-text">We are still fixing bugs, so things may break.</span><a class="beta-link" href="#report">Report a bug</a></div>`);
  const header = document.querySelector('.site-header');
  header?.parentNode.insertBefore(bar, header);
  bar.querySelector('a').addEventListener('click', event => {
    const section = document.getElementById('report');
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => section.querySelector('textarea')?.focus({ preventScroll: true }), 350);
  });
}

// Screenshots are shrunk in the browser first, so a phone screenshot stays well under the upload limit.
async function prepare(file) {
  const asData = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    if (file.size > 2.4 * 1024 * 1024) throw new Error('That screenshot is too large. Try a smaller one.');
    return asData(file);
  }
}

function addReport() {
  const footer = document.querySelector('footer.site-footer');
  if (!footer) return;
  const section = el(`<section class="shell report" id="report" aria-labelledby="report-title"><div class="report-card">
    <div class="report-copy"><span class="beta-pill">Beta</span><h2 id="report-title">Found a bug?</h2>
      <p>Movie Games Daily is new and some bugs are still being fixed. Tell us what went wrong and add a screenshot if you can. It helps us fix it faster.</p></div>
    <form class="report-form" novalidate>
      <label>What went wrong?<textarea name="message" rows="4" maxlength="2000" required placeholder="For example: in Guess the Song, level 2, the audio does not play after I answer."></textarea></label>
      <div class="report-shot"><label class="shot-pick"><span>Add a screenshot <small>(optional)</small></span><input type="file" name="shot" accept="image/png,image/jpeg,image/webp"></label>
        <div class="shot-preview" hidden><img alt="Your screenshot" width="96" height="96"><button type="button" class="btn secondary small" data-remove>Remove</button></div></div>
      <label>Your email or name <small>(optional, only if you want a reply)</small><input name="contact" maxlength="120" autocomplete="email" placeholder="you@example.com"></label>
      <label class="trap" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
      <button class="btn primary" type="submit">Send bug report</button>
      <p class="status" role="status" aria-live="polite"></p>
    </form></div></section>`);
  footer.parentNode.insertBefore(section, footer);

  const form = section.querySelector('form');
  const status = form.querySelector('.status');
  const preview = form.querySelector('.shot-preview');
  const say = (message, error = false) => { status.className = error ? 'status error' : 'status ok'; status.textContent = message; };
  let screenshot = '';
  const clearShot = () => { screenshot = ''; form.elements.shot.value = ''; preview.hidden = true; };
  form.elements.shot.addEventListener('change', async () => {
    const file = form.elements.shot.files[0];
    if (!file) return clearShot();
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { clearShot(); return say('Choose a PNG, JPG or WebP image.', true); }
    try {
      screenshot = await prepare(file);
      preview.querySelector('img').src = screenshot;
      preview.hidden = false;
      say('');
    } catch (error) { clearShot(); say(error.message, true); }
  });
  preview.querySelector('[data-remove]').addEventListener('click', clearShot);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = form.elements.message.value.trim();
    if (message.length < 10) { say('Tell us a little more about what went wrong.', true); form.elements.message.focus(); return; }
    const send = form.querySelector('button[type=submit]');
    send.disabled = true;
    say('Sending…');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contact: form.elements.contact.value, website: form.elements.website.value, screenshot, page: location.pathname + location.search }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
      form.reset();
      clearShot();
      say('Thank you. Your report has been sent.');
    } catch (error) { say(error.message, true); }
    finally { send.disabled = false; }
  });
}

if (!admin) { addBar(); addReport(); }
