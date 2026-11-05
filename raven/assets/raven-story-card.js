// Local-only share artwork. Progress is supplied by the archive, never invented.
const WIDTH = 1080;
const HEIGHT = 1920;
const FILE_NAME = 'raven-on-the-other-side.png';
const FONT_URL = new URL('../../fourth-signature/assets/fonts/NotoSansArabic.ttf', import.meta.url);
const DISCOVERY_URL = new URL('../#raven-archive', import.meta.url).href;
const GOLD = '#d3b27c';
const PAPER = '#f2e9d7';
const MUTED = '#b4bcae';
let sequence = 0;
let fontReady = false;
let fontRequest = null;

const COPY = {
  ar: {
    kicker: 'RAVEN · بطاقة من الأرشيف',
    title: 'على الجانب الآخر',
    note: 'بطاقة مشاركة لتقدّمك في التجربة، بلا تفاصيل الحل. يُجهّز الاسم والصورة على جهازك فقط.',
    displayName: 'اسم العرض',
    visitor: 'زائر الأرشيف',
    clues: 'الأدلة المقروءة',
    secret: 'الإشارة الخفية',
    found: 'تم اكتشافها',
    notFound: 'لم تُكتشف بعد',
    achievement: 'حالة اللغز',
    solved: 'اكتمل لغز الأرشيف',
    inProgress: 'اللغز قيد الاكتشاف',
    cardKind: 'بطاقة مشاركة · تجربة الأرشيف',
    caption: 'ما قرأته يترك أثرًا.',
    visit: 'افتح تجربة الأرشيف',
    download: 'حفظ PNG',
    share: 'مشاركة البطاقة',
    retry: 'أعد تجهيز البطاقة',
    preparing: 'يجري تجهيز بطاقتك…',
    ready: 'البطاقة جاهزة للحفظ أو المشاركة.',
    downloadOnly: 'البطاقة جاهزة للحفظ. المشاركة المباشرة غير متاحة في هذا المتصفح.',
    fontFallback: 'البطاقة جاهزة بخط بديل. يمكنك إعادة تجهيزها.',
    prepareError: 'تعذّر تجهيز البطاقة. اضغط «أعد تجهيز البطاقة» للمحاولة مجددًا.',
    downloadStarted: 'بدأ تنزيل البطاقة بصيغة PNG.',
    downloadError: 'تعذّر بدء التنزيل. حاول مجددًا.',
    shared: 'تمت مشاركة البطاقة.',
    shareError: 'تعذّرت المشاركة. يمكنك حفظ الصورة ومشاركتها من جهازك.',
    previewError: 'تعذّر عرض معاينة البطاقة. يمكنك إعادة تجهيزها.',
    preview: 'بطاقة RAVEN، على الجانب الآخر. بيانات التقدّم نفسها مكتوبة بجانب الصورة.',
    shareText: 'على الجانب الآخر — تقدّمي في تجربة أرشيف RAVEN.',
  },
  en: {
    kicker: 'RAVEN · FROM THE ARCHIVE',
    title: 'On the Other Side',
    note: 'A spoiler-free card of your actual progress. Your display name and image are prepared only on this device.',
    displayName: 'Display name',
    visitor: 'Archive visitor',
    clues: 'Clues read',
    secret: 'Hidden clue',
    found: 'Discovered',
    notFound: 'Not discovered yet',
    achievement: 'Puzzle status',
    solved: 'Archive puzzle complete',
    inProgress: 'Investigation in progress',
    cardKind: 'SHARE CARD · ARCHIVE EXPERIENCE',
    caption: 'What you read leaves a trace.',
    visit: 'Open the archive experience',
    download: 'Save PNG',
    share: 'Share card',
    retry: 'Prepare card again',
    preparing: 'Preparing your card…',
    ready: 'Your card is ready to save or share.',
    downloadOnly: 'Your card is ready to save. Direct sharing is unavailable in this browser.',
    fontFallback: 'Your card is ready with a fallback font. You can prepare it again.',
    prepareError: 'Could not prepare the card. Choose “Prepare card again” to retry.',
    downloadStarted: 'The PNG download has started.',
    downloadError: 'Could not start the download. Please try again.',
    shared: 'Card shared.',
    shareError: 'Could not share the card. You can save the image and share it from your device.',
    previewError: 'Could not show the card preview. You can prepare it again.',
    preview: 'RAVEN, On the Other Side. The same progress details are written beside this image.',
    shareText: 'On the Other Side — my progress in the RAVEN archive experience.',
  },
};

function element(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function graphemes(value) {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment);
  }
  // Preserve common emoji sequences, combining marks and flag pairs on older engines.
  const result = [];
  for (const point of Array.from(value)) {
    const previous = result.at(-1);
    const attach = previous && (/\p{Mark}|[\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]/u.test(point) ||
      previous.endsWith('\u200D') ||
      (/^[\u{1F1E6}-\u{1F1FF}]$/u.test(previous) && /[\u{1F1E6}-\u{1F1FF}]/u.test(point)));
    if (attach) result[result.length - 1] += point;
    else result.push(point);
  }
  return result;
}

function cleanName(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\u200B\u2060\uFEFF]/g, ' ')
    .replace(/\s+/gu, ' ').trim();
  const parts = graphemes(cleaned);
  return parts.length > 160 ? `${parts.slice(0, 159).join('')}…` : cleaned;
}

function direction(value, fallback) {
  const firstLetter = value.match(/\p{Letter}/u)?.[0];
  if (!firstLetter) return fallback;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(firstLetter) ? 'rtl' : 'ltr';
}

async function loadLocalFont() {
  if (fontReady) return true;
  if (typeof FontFace !== 'function' || !document.fonts) return false;
  if (!fontRequest) {
    try {
      const face = new FontFace('RavenArchiveCard', `url("${FONT_URL.href}")`, { style: 'normal', weight: '400' });
      const pending = face.load().then(loaded => {
        document.fonts.add(loaded);
        fontReady = true;
        return true;
      }).catch(() => false).finally(() => {
        if (!fontReady && fontRequest === pending) fontRequest = null;
      });
      fontRequest = pending;
    } catch { return false; }
  }
  const requested = fontRequest;
  let timer;
  try {
    const result = await Promise.race([
      requested,
      new Promise(resolve => { timer = setTimeout(() => resolve(false), 3500); }),
    ]);
    if (!result && fontRequest === requested) fontRequest = null;
    return result;
  } finally { clearTimeout(timer); }
}

function setFont(context, size, weight = 400) {
  context.font = `${weight} ${size}px RavenArchiveCard, Tahoma, Arial, sans-serif`;
}

function wrap(context, value, width) {
  const lines = [];
  let line = '';
  for (const word of value.split(/\s+/u)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= width) {
      line = candidate;
      continue;
    }
    if (line) { lines.push(line); line = ''; }
    for (const part of graphemes(word)) {
      if (line && context.measureText(line + part).width > width) {
        lines.push(line);
        line = '';
      }
      line += part;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(context, value, {
  x = WIDTH / 2, y, width = 852, size = 44, minimum = 26,
  lines = 1, color = PAPER, weight = 400, dir = 'rtl', lineHeight = 1.55,
} = {}) {
  context.save();
  context.direction = dir;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  let fitted;
  let chosen = size;
  const minimumSize = Math.min(minimum, size);
  for (; chosen >= minimumSize; chosen -= 2) {
    setFont(context, chosen, weight);
    fitted = wrap(context, value, width);
    if (fitted.length <= lines) break;
  }
  chosen = Math.max(chosen, minimumSize);
  setFont(context, chosen, weight);
  if (fitted.length > lines) {
    fitted = fitted.slice(0, lines);
    const last = graphemes(fitted[lines - 1]);
    while (last.length && context.measureText(`${last.join('')}…`).width > width) last.pop();
    fitted[lines - 1] = `${last.join('')}…`;
  }
  const offset = (fitted.length - 1) * chosen * lineHeight / 2;
  fitted.forEach((line, index) => {
    // maxWidth also protects an unusually wide single grapheme in a fallback font.
    context.fillText(line, x, y - offset + index * chosen * lineHeight, width);
  });
  context.restore();
}

function rule(context, y, x = 110, width = 860, opacity = 0.3) {
  context.save();
  context.strokeStyle = `rgba(211,178,124,${opacity})`;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + width, y);
  context.stroke();
  context.restore();
}

function drawCard(data) {
  const { copy, name, locale, dir, cluesRead, clueTotal, secretFound, solved } = data;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = '#080d0d';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = context.createRadialGradient(540, 740, 20, 540, 740, 1060);
  glow.addColorStop(0, '#153b30');
  glow.addColorStop(0.53, '#10231e');
  glow.addColorStop(1, '#080d0d');
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.strokeStyle = 'rgba(211,178,124,.55)';
  context.lineWidth = 2;
  context.strokeRect(44, 44, WIDTH - 88, HEIGHT - 88);
  context.strokeStyle = 'rgba(211,178,124,.16)';
  context.strokeRect(58, 58, WIDTH - 116, HEIGHT - 116);

  drawText(context, copy.cardKind, { y: 122, size: 24, color: MUTED, dir });
  context.save();
  context.direction = 'ltr';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '106px Georgia, serif';
  context.fillStyle = GOLD;
  context.fillText('RAVEN', 540, 240);
  context.restore();
  rule(context, 318, 428, 224, 0.6);
  drawText(context, copy.title, { y: 430, size: 76, minimum: 52, lines: 2, weight: 600, dir });
  drawText(context, copy.caption, { y: 550, size: 29, color: MUTED, dir });

  // An abstract open archive doorway, drawn locally without remote artwork.
  context.save();
  context.strokeStyle = 'rgba(211,178,124,.45)';
  context.lineWidth = 2;
  for (const inset of [0, 18, 36]) {
    const x = 350 + inset;
    const w = 380 - inset * 2;
    context.beginPath();
    context.moveTo(x, 898);
    context.lineTo(x, 785);
    context.arc(540, 785, w / 2, Math.PI, 0);
    context.lineTo(x + w, 898);
    context.stroke();
  }
  context.strokeStyle = GOLD;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(500, 880);
  context.lineTo(500, 688);
  context.lineTo(590, 660);
  context.lineTo(590, 880);
  context.stroke();
  context.fillStyle = 'rgba(211,178,124,.08)';
  context.fillRect(503, 695, 84, 181);
  context.fillStyle = GOLD;
  context.beginPath();
  context.arc(568, 790, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();
  rule(context, 918, 268, 544, 0.4);

  drawText(context, name ? copy.displayName : copy.cardKind, { y: 1000, size: 24, color: MUTED, dir });
  drawText(context, name || copy.visitor, {
    y: 1094, size: 62, minimum: 32, lines: 2,
    dir: direction(name || copy.visitor, dir), weight: 600,
  });
  rule(context, 1204);
  const count = `${new Intl.NumberFormat(locale).format(cluesRead)} / ${new Intl.NumberFormat(locale).format(clueTotal)}`;
  drawText(context, copy.clues, { x: 322, y: 1260, width: 390, size: 27, color: MUTED, dir });
  drawText(context, count, { x: 322, y: 1344, width: 390, size: 65, color: GOLD, dir: 'ltr' });
  drawText(context, copy.secret, { x: 758, y: 1260, width: 390, size: 27, color: MUTED, dir });
  drawText(context, secretFound ? copy.found : copy.notFound, {
    x: 758, y: 1344, width: 360, size: 34, minimum: 24,
    color: secretFound ? '#b8d5be' : MUTED, dir,
  });
  context.fillStyle = 'rgba(211,178,124,.12)';
  context.fillRect(148, 1418, 784, 5);
  context.fillStyle = GOLD;
  const progressWidth = clueTotal ? 784 * cluesRead / clueTotal : 0;
  context.fillRect(dir === 'rtl' ? 932 - progressWidth : 148, 1418, progressWidth, 5);
  context.fillStyle = solved ? 'rgba(86,143,111,.18)' : 'rgba(211,178,124,.06)';
  context.fillRect(110, 1480, 860, 104);
  drawText(context, solved ? copy.solved : copy.inProgress, {
    y: 1532, size: 36, minimum: 26, color: solved ? '#c4dcc8' : PAPER, dir,
  });
  rule(context, 1654);
  drawText(context, copy.visit, { y: 1724, size: 26, color: MUTED, dir });
  drawText(context, DISCOVERY_URL.replace(/^https?:\/\//, ''), {
    y: 1785, size: 23, minimum: 17, width: 840, lines: 2, color: PAPER, dir: 'ltr',
  });
  drawText(context, 'TikTok · @iid7oom211', { y: 1850, size: 22, color: GOLD, dir: 'ltr' });
  return canvas;
}

function asBlob(canvas) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PNG export timed out')), 5000);
    try {
      canvas.toBlob(blob => {
        clearTimeout(timer);
        if (blob) resolve(blob);
        else reject(new Error('PNG export unavailable'));
      }, 'image/png');
    } catch (error) { clearTimeout(timer); reject(error); }
  });
}

function download(blob) {
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = FILE_NAME;
  link.hidden = true;
  let timer;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    URL.revokeObjectURL(url);
    window.removeEventListener('pagehide', release);
  };
  try {
    document.body.append(link);
    link.click();
  } catch (error) { release(); throw error; }
  finally { link.remove(); }
  // Disposing the preview must not interrupt a download that has just started.
  timer = setTimeout(release, 30000);
  window.addEventListener('pagehide', release, { once: true });
}

export function createArchiveCard({
  language = 'ar', name = '', cluesRead = 0, clueTotal = 4,
  secretFound = false, solved = false,
} = {}) {
  const locale = language === 'en' ? 'en' : 'ar';
  const copy = COPY[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const displayName = cleanName(name);
  const total = Number.isSafeInteger(clueTotal) && clueTotal >= 0 ? Math.min(clueTotal, 9999) : 4;
  const read = Number.isSafeInteger(cluesRead) ? Math.min(total, Math.max(0, cluesRead)) : 0;
  const found = secretFound === true;
  const completed = solved === true;
  const section = element('section', 'racard');
  section.dir = dir;
  section.lang = locale;
  section.setAttribute('aria-label', copy.title);
  const text = element('div', 'racard-copy');
  text.append(element('p', 'racard-kicker', copy.kicker), element('h3', 'racard-title', copy.title), element('p', 'racard-note', copy.note));
  const preview = element('div', 'racard-preview');
  const image = element('img', 'racard-image');
  image.width = WIDTH;
  image.height = HEIGHT;
  image.alt = copy.preview;
  image.hidden = true;
  preview.append(image);
  const equivalent = element('div', 'racard-equivalent');
  if (displayName) {
    const label = element('p', 'racard-name', `${copy.displayName}: `);
    const value = element('bdi', '', displayName);
    value.dir = 'auto';
    label.append(value);
    equivalent.append(label);
  }
  const facts = element('dl', 'racard-facts');
  const count = `${new Intl.NumberFormat(locale).format(read)} / ${new Intl.NumberFormat(locale).format(total)}`;
  for (const [label, value] of [[copy.clues, count], [copy.secret, found ? copy.found : copy.notFound], [copy.achievement, completed ? copy.solved : copy.inProgress]]) {
    const detail = element('dd', '', value);
    if (label === copy.clues) detail.dir = 'ltr';
    facts.append(element('dt', '', label), detail);
  }
  equivalent.append(facts);
  const visit = element('a', 'racard-visit', copy.visit);
  visit.href = DISCOVERY_URL;
  equivalent.append(visit);
  const actions = element('div', 'racard-actions');
  const save = element('button', 'racard-download', copy.download);
  const share = element('button', 'racard-share', copy.share);
  const retry = element('button', 'racard-retry', copy.retry);
  const status = element('p', 'racard-status', copy.preparing);
  status.id = `raven-archive-card-status-${++sequence}`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  for (const button of [save, share, retry]) {
    button.type = 'button';
    button.disabled = true;
    button.setAttribute('aria-describedby', status.id);
  }
  retry.hidden = true;
  actions.append(save, share, retry);
  section.append(text, preview, equivalent, actions, status);

  let blob = null;
  let file = null;
  let previewUrl = '';
  let preparing = false;
  let sharing = false;
  let downloading = false;
  let downloadTimer;
  let disposed = false;
  let generation = 0;
  let canShare = false;
  const tell = (message, error = false) => {
    if (disposed) return;
    status.textContent = message;
    status.classList.toggle('racard-error', error);
  };
  const buttons = () => {
    const busy = disposed || preparing || sharing || downloading;
    section.setAttribute('aria-busy', String(preparing || sharing));
    save.disabled = busy || !blob;
    share.disabled = busy || !file || !canShare;
    retry.disabled = busy;
  };
  const prepare = async () => {
    if (disposed || preparing || sharing || downloading) return;
    preparing = true;
    const current = ++generation;
    retry.hidden = true;
    buttons();
    tell(copy.preparing);
    try {
      const fontLoaded = await loadLocalFont();
      if (disposed || current !== generation) return;
      const nextBlob = await asBlob(drawCard({
        copy, name: displayName, locale, dir,
        cluesRead: read, clueTotal: total, secretFound: found, solved: completed,
      }));
      if (disposed || current !== generation) return;
      const nextUrl = URL.createObjectURL(nextBlob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = nextUrl;
      blob = nextBlob;
      file = typeof File === 'function' ? new File([blob], FILE_NAME, { type: 'image/png' }) : null;
      canShare = false;
      if (file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        try { canShare = navigator.canShare({ files: [file] }); } catch {}
      }
      image.src = previewUrl;
      image.hidden = false;
      retry.hidden = fontLoaded;
      tell(!fontLoaded ? copy.fontFallback : canShare ? copy.ready : copy.downloadOnly);
    } catch {
      if (disposed || current !== generation) return;
      retry.hidden = false;
      tell(copy.prepareError, true);
    } finally {
      if (!disposed && current === generation) {
        preparing = false;
        buttons();
      }
    }
  };
  const imageError = () => {
    if (disposed) return;
    retry.hidden = false;
    tell(copy.previewError, true);
  };
  image.addEventListener('error', imageError);
  retry.addEventListener('click', () => { void prepare(); });
  save.addEventListener('click', () => {
    if (disposed || save.disabled || !blob) return;
    downloading = true;
    buttons();
    try { download(blob); tell(copy.downloadStarted); }
    catch { tell(copy.downloadError, true); }
    downloadTimer = setTimeout(() => {
      downloading = false;
      if (!disposed) buttons();
    }, 650);
  });
  share.addEventListener('click', async () => {
    if (disposed || share.disabled || !file || !canShare) return;
    sharing = true;
    const previousMessage = status.textContent;
    const previousError = status.classList.contains('racard-error');
    buttons();
    try {
      // Prepared before the click: no await precedes this user-activated call.
      await navigator.share({ files: [file], title: `RAVEN — ${copy.title}`, text: `${copy.shareText}\n${DISCOVERY_URL}` });
      tell(copy.shared);
    } catch (error) {
      if (error?.name === 'AbortError') tell(previousMessage, previousError);
      else tell(copy.shareError, true);
    } finally {
      sharing = false;
      if (!disposed) buttons();
    }
  });
  section.dispose = () => {
    if (disposed) return;
    disposed = true;
    ++generation;
    clearTimeout(downloadTimer);
    image.removeEventListener('error', imageError);
    image.removeAttribute('src');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    blob = null;
    file = null;
    buttons();
  };
  void prepare();
  return section;
}
