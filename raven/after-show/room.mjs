import { shots } from './evidence.mjs';
import { createEditingRound, CUT_LENGTH } from './round.mjs';

const $ = id => document.getElementById(id);
const round = createEditingRound();
const labels = [...document.querySelectorAll('[data-en]')].map(el => [el, el.textContent, el.dataset.en]);
const enFromUrl = () => new URL(location.href).searchParams.get('lang') === 'en';
let english = enFromUrl(), screen, timer, missingArt = false;
const text = (ar, en) => english ? en : ar;
const num = id => String(id).padStart(2, '0');
const source = id => `./storyboards.svg#s${id}`;
const shotById = id => shots.find(shot => shot.id === id);
const buttons = new Map();

// Only editorial, locally authored storyboards are loaded; the eighth asset is
// a drawn withholding slate, not a photo hidden by a CSS filter.
for (const shot of shots) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'shot'; button.dataset.shot = shot.id;
  button.innerHTML = `<span class="frame"><img src="${source(shot.id)}" width="320" height="140" alt=""><bdi class="frame-id">${num(shot.id)}</bdi><span class="mark" aria-hidden="true">+</span></span><span class="shot-copy"><strong></strong><small></small></span>`;
  button.addEventListener('click', () => { round.toggle(shot.id); draw(); });
  $('sheet').append(button); buttons.set(shot.id, button);
}

function applyLanguage() {
  const root = document.documentElement;
  root.lang = english ? 'en' : 'ar'; root.dir = english ? 'ltr' : 'rtl';
  for (const [el, ar, en] of labels) el.textContent = text(ar, en);
  document.title = text('الشريط المقطوع · RAVEN', 'The Cut Tape · RAVEN');
  document.querySelector('meta[name="description"]').content = text('ثلاث لقطات وثلاثون ثانية لاختبار شهادة من المحطة.', 'Three stills and thirty seconds to test a statement from the station.');
  $('archive').href = english ? '../?lang=en#top' : '../#top';
  $('archive').setAttribute('aria-label', text('العودة إلى RAVEN', 'Back to RAVEN'));
  $('language').textContent = text('English', 'العربية'); $('language').lang = text('en', 'ar');
  for (const shot of shots) {
    const button = buttons.get(shot.id);
    button.querySelector('strong').textContent = text(...shot.title);
    button.querySelector('small').textContent = text(...shot.caption);
  }
  if (missingArt) $('asset-note').textContent = text('تعذّر عرض بعض الرسوم. أوصاف اللقطات كاملة ومتاحة للعب.', 'Some stills could not load. You can play using their complete descriptions.');
  draw();
}

function clock(state) {
  const next = `00:${num(Math.ceil(state.remaining / 1000))}`;
  if ($('time').textContent !== next) $('time').textContent = next;
  $('time').parentElement.classList.toggle('urgent', state.remaining <= 5000);
}

function paintCut(state) {
  const { selected } = state;
  const full = selected.length === CUT_LENGTH;
  const protectedCut = selected.some(id => shotById(id).protected);
  for (const [id, button] of buttons) {
    const picked = selected.includes(id);
    button.setAttribute('aria-pressed', String(picked)); button.disabled = (full && !picked) || state.phase === 'paused';
    button.querySelector('.mark').textContent = picked ? '✓' : '+';
  }
  $('count').textContent = `${selected.length} / ${CUT_LENGTH}`;
  $('submit').disabled = !state.canSubmit;
  const slots = Array.from({ length: CUT_LENGTH }, (_, index) => {
    const li = document.createElement('li'), id = selected[index];
    if (!id) {
      li.innerHTML = `<span class="slot" aria-label="${text('خانة فارغة', 'Empty slot')}">—</span>`;
    } else {
      const title = text(...shotById(id).title), remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'slot'; remove.disabled = state.phase === 'paused';
      remove.setAttribute('aria-label', text('انزع ', 'Remove ') + title);
      remove.innerHTML = `<bdi>${num(id)}</bdi><span class="slot-title">${title}</span><span aria-hidden="true">×</span>`;
      remove.addEventListener('click', () => {
        round.toggle(id); draw();
        if (screen === 'editor') buttons.get(id).focus({ preventScroll: true });
      });
      li.append(remove);
    }
    return li;
  });
  $('slots').replaceChildren(...slots);
  const notes = [text('اختر ثلاث لقطات يمكن عرضها معًا.', 'Choose three stills you can release together.'), text('أضفت لقطة. بقيت خانتان.', 'One still in the cut. Two slots left.'), text('بقيت خانة واحدة في الشريط.', 'One slot left in your cut.'), text('الشريط مكتمل. اعتمده أو انزع لقطة لاستبدالها.', 'Your cut is full. Submit it or remove a still to replace it.')];
  $('cut-note').textContent = protectedCut ? text('زاوية الشاهد محمية. انزعها قبل اعتماد الشريط.', 'The witness angle is protected. Remove it before submitting.') : notes[selected.length];
  $('cut-note').classList.toggle('blocked', protectedCut);
}

function paintReview({ phase, selected }) {
  const outcomes = {
    proved: [text('الشريط يثبت الكذبة.', 'Your cut proves the lie.'), text('انفتحت الخزانة ٧ بعد الإغلاق بأربع دقائق. أثبتَّ ما حدث من دون أن تكشف مَن كان هناك.', 'Locker 7 opened four minutes after closing. You proved what happened without identifying anyone.')],
    incomplete: [text('هناك حلقة مفقودة.', 'A link is missing.'), text('شريطك صالح للعرض، لكنه لا يدحض الإفادة. قارن لقطاتك بالأدلة الثلاثة أدناه.', 'Your cut protects the witness, but it does not refute the statement. Compare it with the three links below.')],
    expired: [text('انتهى وقت المونتاج.', 'Time ran out.'), text('توقّفت البكرة قبل اعتماد الشريط. هذه مسودّتك عند الصفر، وليست نسخة معتمدة.', 'The reel stopped before you submitted. This is your edit at zero, not a released cut.')],
  };
  const [title, detail] = outcomes[phase];
  $('verdict').textContent = title; $('verdict-copy').textContent = detail;
  $('final-strip').replaceChildren(...Array.from({ length: CUT_LENGTH }, (_, i) => {
    const fig = document.createElement('figure'), id = selected[i];
    fig.className = 'final-frame';
    if (id) fig.innerHTML = `<img width="320" height="140" alt="" src="${source(id)}"><figcaption><bdi>${num(id)}</bdi>${text(...shotById(id).title)}</figcaption>`;
    else { fig.classList.add('empty'); fig.textContent = text('خانة فارغة', 'Empty slot'); }
    return fig;
  }));
  $('proofs').replaceChildren(...shots.filter(shot => shot.proof).map(shot => {
    const li = document.createElement('li'), has = selected.includes(shot.id);
    li.innerHTML = `<span class="proof-tag">${has ? text('✓ في شريطك', '✓ Included') : text('− غائبة', '− Missing')}</span><div><h4><bdi>${num(shot.id)}</bdi> · ${text(...shot.proof)}</h4><p>${text(...shot.reason)}</p></div>`;
    return li;
  }));
}

function draw() {
  const state = round.read();
  const next = state.phase === 'briefing' ? 'briefing' : ['editing', 'paused'].includes(state.phase) ? 'editor' : 'review';
  const changed = next !== screen;
  if (changed) {
    for (const id of ['briefing', 'editor', 'review']) $(id).hidden = id !== next;
    screen = next;
  }
  if (next === 'editor') { clock(state); paintCut(state); }
  if (next === 'review') paintReview(state);
  if (state.phase === 'editing' && timer === undefined) {
    timer = setInterval(() => {
      const current = round.read();
      if (current.phase === 'editing') clock(current); else draw();
    }, 120);
  } else if (state.phase !== 'editing') { clearInterval(timer); timer = undefined; }
  if (changed && next !== 'briefing') {
    $(next === 'editor' ? 'editor-title' : 'verdict').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

$('language').addEventListener('click', () => {
  english = !english;
  const url = new URL(location.href);
  if (english) url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
  history.replaceState(history.state, '', url);
  applyLanguage();
  document.dispatchEvent(new CustomEvent('raven:language', { detail: { language: document.documentElement.lang } }));
});
window.addEventListener('popstate', () => { english = enFromUrl(); applyLanguage(); });
for (const id of ['start', 'retry']) $(id).addEventListener('click', () => { round.start(); draw(); });
$('submit').addEventListener('click', () => { round.submit(); draw(); });
function setVisibility(hidden) { if (hidden) round.pause(); else round.resume(); draw(); }
document.addEventListener('visibilitychange', () => setVisibility(document.hidden));
window.addEventListener('pagehide', () => setVisibility(true));
window.addEventListener('pageshow', () => setVisibility(document.hidden));
applyLanguage();
// Prepare the contact sheet before the player's first timed gesture. The text
// edition stays playable even if the browser cannot decode an illustration.
Promise.allSettled([...$('sheet').querySelectorAll('img')].map(img => img.decode())).then(results => {
  missingArt = results.some(result => result.status === 'rejected');
  if (missingArt) applyLanguage();
  $('start').disabled = false;
});
