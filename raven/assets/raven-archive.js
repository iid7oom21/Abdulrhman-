import { createArchiveCard } from './raven-story-card.js?v=archive-1';

const container = document.getElementById('raven-archive');

if (container && !container.dataset.archiveReady) {
  container.dataset.archiveReady = 'true';
  const storageKey = 'raven_archive_other_side_v1';
  const clueIds = ['door', 'clock', 'camera', 'trace'];
  const copy = {
    ar: {
      eyebrow: 'ملف جانبي · تجربة مستقلة',
      title: 'على الجانب الآخر',
      lead: 'أربع أوراق. شهادة واحدة لا تستقيم.',
      preview: 'ختم مفقود وباب مكسور. افحص الأدلة، اكشف رمز البصيرة، واحتفظ ببطاقة تحمل إنجازك.',
      start: 'افتح ملف التحقيق',
      nav: 'الأرشيف السري',
      story: 'عند جرد قاعة المقتنيات، غاب ختم برونزي من صندوق العرض، ووُجد الباب الزجاجي مكسورًا. قال مالك إنه كسره من الممر لفتح القاعة. افحص السجلات قبل أن تختار الشهادة التي يناقضها دليل مباشر.',
      scope: 'ملف مستقل عن «التوقيع الرابع». نستنتج تناقض شهادة، لا هوية سارق الختم.',
      status: 'الأرشيف مفتوح للفحص',
      progress: 'تقدم الفحص',
      progressUnit: 'من',
      milestoneClues: 'فحص الأوراق الأربع',
      milestoneSecret: 'فتح رمز البصيرة',
      milestoneSolved: 'إسناد الاستنتاج الصحيح',
      complete: 'مكتمل',
      pending: 'لم يكتمل',
      saved: 'يُحفظ تقدم هذا الملف على هذا الجهاز. الاسم للبطاقة فقط.',
      unsaved: 'الحفظ غير متاح؛ يبقى تقدمك في هذه الجلسة. الاسم للبطاقة فقط.',
      castLabel: 'أصحاب الإفادات',
      cast: [
        ['نبيل مراد', 'مسؤول سجل الجرد'],
        ['هالة مراد', 'مُصوّرة جلسة التقييم'],
        ['مالك مراد', 'مشرف القاعة'],
        ['كمال ناصر', 'خبير الترميم'],
      ],
      deskEyebrow: '01 / أوراق الفحص',
      deskTitle: 'سلّط الضوء على ما نعرفه.',
      uvOn: 'تشغيل عدسة UV',
      uvOff: 'إيقاف عدسة UV',
      uvHelp: 'حرّك المؤشر أو إصبعك داخل اللوحة. افتح كل علامة لقراءة ورقتها؛ الأزرار أسفل اللوحة تعرض الأدلة نفسها دون العدسة.',
      boardLabel: 'مخطط قاعة المقتنيات ومواضع الأوراق',
      boardHelp: 'بعد تشغيل العدسة، حرّكها بمفاتيح الأسهم أو افتح الأوراق بالأزرار التالية.',
      room: 'قاعة المقتنيات',
      corridor: 'الممر الخارجي',
      display: 'صندوق العرض',
      doorLabel: 'الباب الزجاجي',
      evidenceLabel: 'أوراق المصدر',
      read: 'تم الفحص',
      unread: 'افتح الورقة',
      inspected: 'الأوراق المفحوصة',
      readerLabel: 'الورقة المفتوحة',
      readerEmpty: 'ابدأ بورقة فحص الباب، ثم قارنها ببقية السجلات.',
      fullReport: 'اقرأ التقرير وحدود الاستنتاج',
      clueItems: [
        { id: 'door', ref: 'EX-01', title: 'فحص الباب', short: 'الكسر: من الداخل إلى الممر', text: 'تقرير EX-01: بدأ الكسر من الوجه الداخلي للباب، المواجه للقاعة. وُثّقت حواف الكسر ومواضع الشظايا قبل تحريك الباب. نتيجة الفحص المثبتة: ضربة من داخل القاعة باتجاه الممر. لا يحدد التقرير الشخص الذي أحدثها.', limit: 'ما يثبته: اتجاه الكسر. ما لا يثبته: هوية من أخذ الختم أو أحدث الضربة.' },
        { id: 'clock', ref: 'TM-02', title: 'ضبط ساعة السجل', short: 'تصحيح الوقت موثّق', text: 'محضر TM-02: تبيّن قبل جلسة التقييم أن ساعة سجل الجرد متأخرة دقيقتين. صحّح نبيل الوقت بحضور الموظف المناوب، وسُجّل الوقت قبل التصحيح وبعده. لا يسجّل المحضر تعديلًا على قائمة القطع.', limit: 'التصحيح موثّق. لا يكفي تغيّر الوقت وحده لإثبات تزوير السجل أو حجة غياب.' },
        { id: 'camera', ref: 'CM-03', title: 'حدود زاوية الكاميرا', short: 'نقطة عمياء؛ بلا دليل إدانة', text: 'سجل CM-03: كانت هالة تحمل معدات التصوير في زاوية لا تغطيها كاميرا الممر. يسجّل جدول العمل وجودها هناك لتجهيز الإضاءة. لا توجد لقطة في هذا الملف تُظهرها تفتح صندوق العرض أو تنقل الختم.', limit: 'وجود نقطة عمياء يحدّ مما نراه؛ لا يثبت وحده فعلًا وقع خارج الصورة.' },
        { id: 'trace', ref: 'TR-04', title: 'أثر مادة الترميم', short: 'مادة تنظيف مستخدمة في الجلسة', text: 'ورقة TR-04: وُجدت على الطاولة مادة تنظيف من النوع المستخدم في قفازات الترميم. يسجّل طلب العمل استعمال كمال هذه المادة لتنظيف الحوامل قبل التقييم. لم يحدد الفحص متى انتقل الأثر إلى الموضع الذي عُثر عليه فيه.', limit: 'الأثر متسق مع عمل الترميم الموثّق؛ لا يثبت استبدال القطعة أو الاشتراك في سرقتها.' },
      ],
      secretEyebrow: '02 / رمز البصيرة',
      secretTitle: 'تفصيل ينتظر انتباهك.',
      secretHelp: 'انقر حرف R ثلاث مرات متتابعة، أو افتح الرمز بالزر. يمكن استخدام Enter أو المسافة على حرف R أيضًا.',
      secretTrigger: 'رمز البصيرة: انقر ثلاث مرات، أو اضغط Enter أو المسافة',
      secretAlternative: 'افتح رمز البصيرة',
      secretFound: 'تم العثور على الرمز',
      secretDialogTitle: 'البصيرة تبدأ من حدود الدليل.',
      secretDialogText: 'الورقة التي تُضعف شهادةً لا تُثبت كل ما حدث. احتفظ بالسؤال مفتوحًا حين ينتهي الدليل.',
      secretCodeLabel: 'رمز هذا الملف',
      secretClose: 'عد إلى الفحص',
      quizEyebrow: '03 / الاستنتاج',
      quizTitle: 'أي شهادة يناقضها تقرير مباشر؟',
      quizHelp: 'افتح الأوراق الأربع أولًا. اختر التناقض الذي يسنده النص، دون توسيعه إلى اتهام بالسرقة.',
      nameLabel: 'اسمك على البطاقة — اختياري',
      namePlaceholder: 'اسم أو لقب',
      nameHint: 'لن يُرسل الاسم أو يُحفظ في سجل؛ يظهر فقط على الصورة التي تختار مشاركتها.',
      optionsLabel: 'اختر الشهادة المتناقضة',
      options: [
        ['malik', 'مالك: «كسرت الباب من الممر، باتجاه داخل القاعة».'],
        ['nabil', 'نبيل: «صحّحت ساعة السجل وفق محضر ضبط الوقت».'],
        ['kamal', 'كمال: «استُخدمت مادة تنظيف أثناء جلسة الترميم».'],
      ],
      locked: 'اقرأ الأوراق الأربع لفتح الاستنتاج.',
      ready: 'الأوراق متاحة الآن. اختر الشهادة التي يناقضها التقرير.',
      correct: 'أصبت التناقض: EX-01 يثبت كسرًا من داخل القاعة إلى الممر؛ وهذا يناقض وصف مالك. لا يحدد هذا وحده من أخذ الختم أو من أحدث الضربة.',
      nabil: 'راجع TM-02: تصحيح نبيل موثّق في محضر ضبط الوقت. تغيّر الساعة ليس تناقضًا مع شهادته هنا.',
      kamal: 'راجع TR-04: استخدام مادة التنظيف موثّق ضمن الترميم. وجودها لا يناقض شهادة كمال ولا يثبت جريمة.',
      retry: 'أعد فحص الاستنتاج',
      solvedStatus: 'ثُبّت الاستنتاج بدليله.',
      cardPending: 'ستظهر بطاقة الملف بعد تثبيت الاستنتاج الصحيح.',
      cardError: 'تعذّر تجهيز البطاقة الآن. يمكنك إعادة المحاولة.',
      retryCard: 'أعد تجهيز البطاقة',
    },
    en: {
      eyebrow: 'Side file · Standalone experience',
      title: 'On the Other Side',
      lead: 'Four records. One account that does not hold.',
      preview: 'A missing seal. A broken door. Inspect the evidence, uncover the insight code, and keep a card of your findings.',
      start: 'Open the investigation file',
      nav: 'Secret archive',
      story: 'During an inventory of the collection room, a bronze seal was missing from its display case and the glass door was found broken. Malik said he broke it from the corridor to open the room. Read the records, then choose the account that direct evidence contradicts.',
      scope: 'A separate file from The Fourth Signature. Establish a contradiction, not the identity of the thief.',
      status: 'Archive open for inspection',
      progress: 'Inspection progress',
      progressUnit: 'of',
      milestoneClues: 'Read all four records',
      milestoneSecret: 'Open the insight code',
      milestoneSolved: 'Support the correct conclusion',
      complete: 'Complete',
      pending: 'Incomplete',
      saved: 'This file’s progress stays on this device. Your name is used only on the card.',
      unsaved: 'Storage is unavailable; progress lasts for this session. Your name is used only on the card.',
      castLabel: 'People in the records',
      cast: [
        ['Nabil Murad', 'Inventory records'],
        ['Hala Murad', 'Session photographer'],
        ['Malik Murad', 'Room supervisor'],
        ['Kamal Nasser', 'Conservation specialist'],
      ],
      deskEyebrow: '01 / Inspect the records',
      deskTitle: 'Bring what we know into focus.',
      uvOn: 'Turn on the UV lens',
      uvOff: 'Turn off the UV lens',
      uvHelp: 'Move your pointer or finger over the plan. Open each marker to read its record; the buttons below provide the same evidence without the lens.',
      boardLabel: 'Collection room plan and record locations',
      boardHelp: 'With the lens on, use the arrow keys to move it, or open the records with the buttons below.',
      room: 'COLLECTION ROOM',
      corridor: 'OUTER CORRIDOR',
      display: 'DISPLAY CASE',
      doorLabel: 'GLASS DOOR',
      evidenceLabel: 'Source records',
      read: 'Read',
      unread: 'Open record',
      inspected: 'Records inspected',
      readerLabel: 'Open record',
      readerEmpty: 'Start with the door examination, then compare the other records.',
      fullReport: 'Read the report and its limits',
      clueItems: [
        { id: 'door', ref: 'EX-01', title: 'Door examination', short: 'Break: room → corridor', text: 'EX-01: The break began on the interior face of the door, facing the room. Fracture edges and fragment positions were documented before the door was moved. The recorded finding is a strike from inside the room toward the corridor. The report does not identify the person responsible.', limit: 'Established: the direction of the break. Unresolved: who took the seal or struck the glass.' },
        { id: 'clock', ref: 'TM-02', title: 'Clock adjustment', short: 'The clock correction is documented', text: 'TM-02: Before the assessment session, the inventory clock was found to be two minutes slow. Nabil corrected it in the presence of the staff member on duty; both times were logged. This record contains no change to the list of objects.', limit: 'The correction is documented. A changed time alone does not establish a forged record or an alibi.' },
        { id: 'camera', ref: 'CM-03', title: 'Camera coverage', short: 'A blind spot is not proof', text: 'CM-03: Hala was carrying photographic equipment in a corner outside the corridor camera’s view. The work schedule places her there to prepare the lighting. No image in this file shows her opening the display case or moving the seal.', limit: 'A blind spot limits what we can see; it does not establish what happened outside the frame.' },
        { id: 'trace', ref: 'TR-04', title: 'Conservation residue', short: 'Cleaning material used in the session', text: 'TR-04: Cleaning material of the kind used on conservation gloves was found on the table. The work order records Kamal using it to clean supports before the assessment. The examination did not establish when the residue reached the place where it was found.', limit: 'The trace is consistent with documented conservation work; it does not prove a substitution or involvement in theft.' },
      ],
      secretEyebrow: '02 / Insight code',
      secretTitle: 'A detail waiting for your attention.',
      secretHelp: 'Tap R three times in a row, or use the button to open the code. Enter or Space on R works too.',
      secretTrigger: 'Insight code: tap three times, or press Enter or Space',
      secretAlternative: 'Open the insight code',
      secretFound: 'Code found',
      secretDialogTitle: 'Insight begins at the limits of evidence.',
      secretDialogText: 'A record that undermines one account does not prove everything that happened. Leave a question open when the evidence ends.',
      secretCodeLabel: 'This file’s code',
      secretClose: 'Return to the records',
      quizEyebrow: '03 / The conclusion',
      quizTitle: 'Which account does a report directly contradict?',
      quizHelp: 'Read all four records first. Choose the contradiction supported by the text, without turning it into an accusation of theft.',
      nameLabel: 'Name on your card — optional',
      namePlaceholder: 'Name or nickname',
      nameHint: 'Your name is not sent or saved to a register. It appears only on the image you choose to share.',
      optionsLabel: 'Choose the contradicted account',
      options: [
        ['malik', 'Malik: “I broke the door from the corridor, toward the inside of the room.”'],
        ['nabil', 'Nabil: “I corrected the inventory clock according to the adjustment record.”'],
        ['kamal', 'Kamal: “Cleaning material was used during conservation work.”'],
      ],
      locked: 'Read all four records to unlock the conclusion.',
      ready: 'You have read the records. Choose the account contradicted by the report.',
      correct: 'You found the contradiction: EX-01 establishes a break from the room toward the corridor, contrary to Malik’s account. This alone does not identify who took the seal or struck the glass.',
      nabil: 'Check TM-02: Nabil’s correction is documented in the clock adjustment record. The changed time does not contradict his account here.',
      kamal: 'Check TR-04: the cleaning material was used in documented conservation work. Its presence does not contradict Kamal’s account or establish a crime.',
      retry: 'Review your conclusion',
      solvedStatus: 'Conclusion supported by its record.',
      cardPending: 'Your file card appears after the correct conclusion is supported.',
      cardError: 'The card could not be prepared. You can try again.',
      retryCard: 'Prepare the card again',
    },
  };

  function element(tag, attributes = {}, children = []) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'text') node.textContent = value;
      else if (name === 'class') node.className = value;
      else node.setAttribute(name, String(value));
    }
    for (const child of children) node.append(child);
    return node;
  }

  let language = window.RavenI18n?.language() === 'en' || document.documentElement.lang === 'en' ? 'en' : 'ar';
  let storageAvailable = true;
  let state = { read: [], secretFound: false, solved: false };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      state.read = clueIds.filter(id => Array.isArray(saved.read) && saved.read.includes(id));
      state.secretFound = saved.secretFound === true;
      state.solved = saved.solved === true && state.read.length === clueIds.length;
    }
  } catch { storageAvailable = false; }
  let selectedAnswer = state.solved ? 'malik' : '';
  let openClueId = '';
  let uvActive = false;
  let card = null;
  let cardSignature = '';
  let nameTimer;
  let secretOrigin = null;
  let tapCount = 0;
  let tapTimer;
  let lensPosition = { x: 50, y: 50 };
  const t = key => copy[language][key];
  const numeral = value => new Intl.NumberFormat(language === 'ar' ? 'ar' : 'en').format(value);
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const refs = {};
  const textNode = (tag, key, attributes = {}) => {
    const node = element(tag, attributes);
    node.dataset.archiveText = key;
    return node;
  };
  const progressCount = refs.progressCount = element('strong', { class: 'archive-progress-count' });
  const milestoneNodes = ['milestoneClues', 'milestoneSecret', 'milestoneSolved'].map(key => {
    const node = element('li', { class: 'archive-milestone' }, [
      element('span', { class: 'archive-milestone-mark', 'aria-hidden': 'true' }),
      textNode('span', key),
      element('span', { class: 'archive-sr-only archive-milestone-state' }),
    ]);
    return node;
  });
  refs.saved = element('p', { class: 'archive-save-note' });
  const progress = element('div', { id: 'archive-progress', class: 'archive-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '3', 'aria-valuenow': '0', 'aria-live': 'polite', 'aria-atomic': 'true' }, [
    element('div', { class: 'archive-progress-heading' }, [textNode('span', 'progress'), progressCount]),
    element('ol', { class: 'archive-milestones' }, milestoneNodes),
  ]);

  const cast = refs.cast = element('ul', { class: 'archive-cast' });
  const header = element('header', { class: 'archive-header' }, [
    element('div', { class: 'archive-intro' }, [
      textNode('p', 'eyebrow', { class: 'archive-eyebrow' }),
      textNode('h2', 'title', { id: 'archive-title' }),
      textNode('p', 'lead', { class: 'archive-lead' }),
      textNode('p', 'preview', { class: 'archive-preview' }),
    ]),
  ]);
  const overview = element('div', { class: 'archive-overview' }, [
    element('div', {}, [
      textNode('p', 'story', { class: 'archive-story' }),
      textNode('p', 'scope', { class: 'archive-scope' }),
    ]),
    element('aside', { class: 'archive-file-status' }, [
      textNode('p', 'status', { class: 'archive-open' }),
      progress,
      refs.saved,
    ]),
  ]);

  const uvToggle = refs.uvToggle = element('button', {
    type: 'button', id: 'archive-uv-toggle', class: 'archive-button archive-uv-button',
    'aria-pressed': 'false', 'aria-controls': 'archive-scene',
  });
  const board = refs.board = element('div', {
    id: 'archive-scene', class: 'archive-scene', tabindex: '0', role: 'group',
    'aria-describedby': 'archive-board-help',
  });
  const uvLayer = element('div', { class: 'archive-uv-layer', 'aria-hidden': 'true' });
  const boardHotspots = [];
  const clueButtons = [];
  const uvNotes = [];
  const positions = [
    { x: 76, y: 28 }, { x: 25, y: 25 }, { x: 21, y: 76 }, { x: 73, y: 74 },
  ];
  clueIds.forEach((id, index) => {
    const button = element('button', {
      type: 'button', class: 'archive-hotspot', 'data-archive-clue': id,
      'aria-controls': 'archive-reader', 'aria-expanded': 'false',
    }, [element('span', { text: String(index + 1).padStart(2, '0'), 'aria-hidden': 'true' })]);
    button.style.setProperty('--marker-x', `${positions[index].x}%`);
    button.style.setProperty('--marker-y', `${positions[index].y}%`);
    boardHotspots.push(button);
    const note = element('span', { class: `archive-uv-note archive-uv-note-${index + 1}` });
    uvNotes.push(note);
    uvLayer.append(note);
    const listButton = element('button', {
      type: 'button', class: 'archive-clue-button', 'data-archive-clue': id,
      'aria-controls': 'archive-reader', 'aria-expanded': 'false',
    }, [
      element('span', { class: 'archive-clue-ref', lang: 'en', dir: 'ltr' }),
      element('span', { class: 'archive-clue-title' }),
      element('span', { class: 'archive-clue-state' }),
    ]);
    clueButtons.push(listButton);
  });
  board.append(
    element('div', { class: 'archive-plan', 'aria-hidden': 'true' }, [
      textNode('span', 'room', { class: 'archive-plan-room' }),
      textNode('span', 'corridor', { class: 'archive-plan-corridor' }),
      textNode('span', 'display', { class: 'archive-plan-case' }),
      textNode('span', 'doorLabel', { class: 'archive-plan-door' }),
    ]),
    uvLayer,
    ...boardHotspots,
  );
  refs.inspected = element('p', { id: 'archive-clue-progress', class: 'archive-inspected', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '4', 'aria-valuenow': '0' });
  const readerTitle = refs.readerTitle = element('h4', { id: 'archive-reader-title', tabindex: '-1' });
  refs.readerReference = element('span', { class: 'archive-reader-ref', dir: 'ltr', lang: 'en' });
  refs.readerText = element('p');
  refs.readerFinding = element('p', { class: 'archive-reader-finding' });
  refs.readerLimit = element('p', { class: 'archive-reader-limit' });
  refs.readerReport = element('details', { class: 'archive-reader-report' }, [
    textNode('summary', 'fullReport'), refs.readerText, refs.readerLimit,
  ]);
  refs.reader = element('article', { id: 'archive-reader', class: 'archive-reader', 'aria-labelledby': 'archive-reader-title' }, [
    refs.readerReference, readerTitle, refs.readerFinding, refs.readerReport,
  ]);
  const clues = element('div', { class: 'archive-desk' }, [
    element('div', { class: 'archive-desk-heading' }, [
      element('div', {}, [
        textNode('p', 'deskEyebrow', { class: 'archive-eyebrow' }),
        textNode('h3', 'deskTitle'),
      ]),
      uvToggle,
    ]),
    textNode('p', 'uvHelp', { class: 'archive-help' }),
    textNode('p', 'boardHelp', { id: 'archive-board-help', class: 'archive-sr-only' }),
    board,
    element('div', { id: 'archive-clues', class: 'archive-clues', role: 'group' }, clueButtons),
    refs.inspected,
    refs.reader,
  ]);

  const secretTrigger = refs.secretTrigger = element('button', {
    type: 'button', id: 'archive-secret-trigger', class: 'archive-secret-mark', 'aria-haspopup': 'dialog',
    'aria-controls': 'archive-secret-dialog', text: 'R',
  });
  const secretOpen = textNode('button', 'secretAlternative', {
    type: 'button', id: 'archive-secret-open', class: 'archive-text-button', 'aria-haspopup': 'dialog',
    'aria-controls': 'archive-secret-dialog',
  });
  refs.secretStatus = element('p', { class: 'archive-secret-status', role: 'status' });
  const secret = element('div', { class: 'archive-secret' }, [
    secretTrigger,
    element('div', {}, [
      textNode('p', 'secretEyebrow', { class: 'archive-eyebrow' }),
      textNode('h3', 'secretTitle'),
      textNode('p', 'secretHelp', { class: 'archive-help' }),
      secretOpen, refs.secretStatus,
    ]),
  ]);
  const secretClose = textNode('button', 'secretClose', {
    type: 'button', id: 'archive-secret-close', class: 'archive-button', autofocus: '',
  });
  const dialog = refs.dialog = element('dialog', {
    id: 'archive-secret-dialog', class: 'archive-secret-dialog',
    'aria-labelledby': 'archive-secret-dialog-title', 'aria-describedby': 'archive-secret-dialog-description',
  }, [
    element('div', { class: 'archive-dialog-inner' }, [
      element('span', { class: 'archive-dialog-emblem', 'aria-hidden': 'true', text: 'R' }),
      textNode('h3', 'secretDialogTitle', { id: 'archive-secret-dialog-title' }),
      textNode('p', 'secretDialogText', { id: 'archive-secret-dialog-description' }),
      textNode('p', 'secretCodeLabel', { class: 'archive-eyebrow' }),
      element('p', { class: 'archive-secret-code', dir: 'ltr', lang: 'en', text: 'RAVEN-EYE-17' }),
      secretClose,
    ]),
  ]);

  const name = refs.name = element('input', {
    id: 'archive-name', type: 'text', maxlength: '40', autocomplete: 'off', dir: 'auto',
    'aria-describedby': 'archive-name-help',
  });
  const optionButtons = ['malik', 'nabil', 'kamal'].map((id, index) =>
    element('button', {
      type: 'button', class: 'archive-option', 'data-archive-answer': id,
      'aria-pressed': 'false',
    }, [
      element('span', { class: 'archive-option-index', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0') }),
      element('span', { class: 'archive-option-copy' }),
    ]),
  );
  refs.feedback = element('p', { id: 'archive-feedback', class: 'archive-feedback', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  const retry = refs.retry = textNode('button', 'retry', { type: 'button', class: 'archive-text-button' });
  const options = element('div', { id: 'archive-options', class: 'archive-options', role: 'group', 'aria-labelledby': 'archive-question-title', 'aria-describedby': 'archive-question-help' }, optionButtons);
  const quiz = element('div', { class: 'archive-quiz' }, [
    textNode('p', 'quizEyebrow', { class: 'archive-eyebrow' }),
    textNode('h3', 'quizTitle', { id: 'archive-question-title' }),
    textNode('p', 'quizHelp', { id: 'archive-question-help', class: 'archive-help' }),
    options, refs.feedback, retry,
    element('div', { class: 'archive-name-field' }, [
      textNode('label', 'nameLabel', { for: 'archive-name' }),
      name,
      textNode('p', 'nameHint', { id: 'archive-name-help', class: 'archive-help' }),
    ]),
  ]);
  refs.card = element('div', { id: 'archive-card', class: 'archive-card-host' });
  const cardPlaceholder = refs.cardPlaceholder = textNode('p', 'cardPending', { class: 'archive-card-placeholder' });
  refs.card.append(cardPlaceholder);
  container.classList.add('raven-archive');
  container.removeAttribute('aria-label');
  container.setAttribute('aria-labelledby', 'archive-title');
  container.replaceChildren(element('div', { class: 'archive-wrap' }, [
    header,
    element('details', { id: 'archive-interactive-panel', class: 'archive-interactive-panel' }, [
      textNode('summary', 'start', { id: 'archive-start', class: 'archive-start' }),
      element('div', { class: 'archive-expanded' }, [
        overview, cast,
        element('div', { class: 'archive-workspace' }, [
          clues,
          element('div', { class: 'archive-investigation' }, [secret, quiz]),
        ]),
        refs.card,
      ]),
    ]),
    dialog,
  ]));

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { storageAvailable = false; }
  }

  function updateCard(force = false) {
    if (!state.solved) return;
    const cardData = {
      language,
      name: name.value.trim().slice(0, 40),
      cluesRead: state.read.length,
      clueTotal: clueIds.length,
      secretFound: state.secretFound,
      solved: state.solved,
    };
    const signature = JSON.stringify(cardData);
    if (!force && signature === cardSignature) return;
    card?.dispose?.();
    card = null;
    try {
      card = createArchiveCard(cardData);
      refs.card.replaceChildren(card);
      cardSignature = signature;
    } catch {
      cardSignature = '';
      const retryCard = element('button', { type: 'button', class: 'archive-button', text: t('retryCard') });
      retryCard.addEventListener('click', () => updateCard(true));
      refs.card.replaceChildren(element('p', { text: t('cardError'), role: 'status' }), retryCard);
    }
  }

  function renderReader() {
    const clue = t('clueItems').find(item => item.id === openClueId);
    refs.readerReference.textContent = clue?.ref || 'EX-01 / TM-02 / CM-03 / TR-04';
    refs.readerTitle.textContent = clue?.title || t('readerLabel');
    refs.readerFinding.textContent = clue?.short || t('readerEmpty');
    refs.readerText.textContent = clue?.text || '';
    refs.readerLimit.textContent = clue?.limit || '';
    refs.readerLimit.hidden = !clue;
    refs.readerReport.hidden = !clue;
    refs.reader.classList.toggle('has-record', Boolean(clue));
  }

  function updateState() {
    const milestones = [state.read.length === clueIds.length, state.secretFound, state.solved];
    const total = milestones.filter(Boolean).length;
    progressCount.textContent = `${numeral(total)} ${t('progressUnit')} ${numeral(3)}`;
    progress.setAttribute('aria-label', t('progress'));
    progress.setAttribute('aria-valuenow', String(total));
    progress.setAttribute('aria-valuetext', `${progressCount.textContent}. ${['milestoneClues', 'milestoneSecret', 'milestoneSolved'].map((key, index) => `${t(key)}: ${t(milestones[index] ? 'complete' : 'pending')}`).join('. ')}`);
    milestoneNodes.forEach((node, index) => {
      node.classList.toggle('is-done', milestones[index]);
      node.querySelector('.archive-milestone-mark').textContent = milestones[index] ? '✓' : numeral(index + 1);
      node.querySelector('.archive-milestone-state').textContent = ` — ${t(milestones[index] ? 'complete' : 'pending')}`;
    });
    refs.saved.textContent = t(storageAvailable ? 'saved' : 'unsaved');
    refs.inspected.textContent = `${t('inspected')}: ${numeral(state.read.length)} / ${numeral(clueIds.length)}`;
    refs.inspected.setAttribute('aria-label', t('inspected'));
    refs.inspected.setAttribute('aria-valuenow', String(state.read.length));
    clueButtons.forEach((button, index) => {
      const clue = t('clueItems')[index];
      const read = state.read.includes(clue.id);
      const expanded = openClueId === clue.id;
      button.querySelector('.archive-clue-ref').textContent = clue.ref;
      button.querySelector('.archive-clue-title').textContent = clue.title;
      button.querySelector('.archive-clue-state').textContent = t(read ? 'read' : 'unread');
      button.classList.toggle('is-read', read);
      button.setAttribute('aria-expanded', String(expanded));
      boardHotspots[index].setAttribute('aria-label', `${clue.ref}: ${clue.title} — ${t(read ? 'read' : 'unread')}`);
      boardHotspots[index].setAttribute('aria-expanded', String(expanded));
      boardHotspots[index].classList.toggle('is-read', read);
      uvNotes[index].textContent = clue.short;
    });
    secretTrigger.classList.toggle('is-found', state.secretFound);
    refs.secretStatus.textContent = state.secretFound ? t('secretFound') : '';
    optionButtons.forEach((button, index) => {
      const [id, text] = t('options')[index];
      button.querySelector('.archive-option-copy').textContent = text;
      button.disabled = !milestones[0] || state.solved;
      button.setAttribute('aria-pressed', String(selectedAnswer === id));
      button.classList.toggle('is-correct', state.solved && id === 'malik');
      button.classList.toggle('is-selected', selectedAnswer === id);
    });
    refs.feedback.textContent = state.solved ? t('correct') : selectedAnswer ? t(selectedAnswer) : t(milestones[0] ? 'ready' : 'locked');
    refs.feedback.classList.toggle('is-correct', state.solved);
    retry.hidden = !selectedAnswer || state.solved;
    renderReader();
    updateCard();
  }

  function translate() {
    container.lang = language;
    container.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-archive-nav]').forEach(node => { node.textContent = t('nav'); });
    container.querySelectorAll('[data-archive-text]').forEach(node => {
      node.textContent = t(node.dataset.archiveText);
    });
    cast.setAttribute('aria-label', t('castLabel'));
    cast.replaceChildren(...t('cast').map(([person, role], index) => element('li', {}, [
      element('span', { class: 'archive-cast-number', text: String(index + 1).padStart(2, '0'), 'aria-hidden': 'true' }),
      element('div', {}, [element('strong', { text: person }), element('span', { text: role })]),
    ])));
    document.getElementById('archive-clues').setAttribute('aria-label', t('evidenceLabel'));
    board.setAttribute('aria-label', t('boardLabel'));
    uvToggle.textContent = t(uvActive ? 'uvOff' : 'uvOn');
    secretTrigger.setAttribute('aria-label', t('secretTrigger'));
    name.placeholder = t('namePlaceholder');
    updateState();
  }

  function openClue(id) {
    if (!clueIds.includes(id)) return;
    openClueId = id;
    refs.readerReport.open = false;
    if (!state.read.includes(id)) {
      state.read.push(id);
      save();
    }
    updateState();
    refs.readerTitle.focus({ preventScroll: true });
    const rect = refs.reader.getBoundingClientRect();
    if (rect.bottom > window.innerHeight || rect.top < 0) {
      refs.reader.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'instant' : 'smooth' });
    }
  }

  container.querySelectorAll('[data-archive-clue]').forEach(button => {
    button.addEventListener('click', () => openClue(button.dataset.archiveClue));
  });
  function setLens(x, y) {
    lensPosition = { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
    board.style.setProperty('--uv-x', `${lensPosition.x}%`);
    board.style.setProperty('--uv-y', `${lensPosition.y}%`);
  }
  function positionLens(event) {
    if (!uvActive) return;
    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setLens((event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100);
  }
  board.addEventListener('pointermove', positionLens, { passive: true });
  board.addEventListener('pointerdown', positionLens, { passive: true });
  board.addEventListener('keydown', event => {
    if (!uvActive || event.target !== board) return;
    const movement = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[event.key];
    if (!movement) return;
    event.preventDefault();
    setLens(lensPosition.x + movement[0], lensPosition.y + movement[1]);
  });
  uvToggle.addEventListener('click', () => {
    uvActive = !uvActive;
    board.classList.toggle('is-uv-active', uvActive);
    uvToggle.setAttribute('aria-pressed', String(uvActive));
    uvToggle.textContent = t(uvActive ? 'uvOff' : 'uvOn');
  });

  function openSecret(origin) {
    if (dialog.open) return;
    clearTimeout(tapTimer);
    tapCount = 0;
    secretOrigin = origin;
    dialog.showModal();
    if (!state.secretFound) {
      state.secretFound = true;
      save();
    }
    container.classList.toggle('archive-insight-pulse', !reducedMotion());
    window.setTimeout(() => container.classList.remove('archive-insight-pulse'), 750);
    try {
      if (typeof window.RavenArchiveAudio?.pulse === 'function') window.RavenArchiveAudio.pulse();
      else if (window.parent !== window && window.parent.location.origin === location.origin) window.parent.RavenSite?.pulse?.();
    } catch { /* The optional sound effect never blocks the record. */ }
    updateState();
  }
  secretTrigger.addEventListener('click', event => {
    if (event.detail === 0) {
      clearTimeout(tapTimer);
      tapCount = 0;
      openSecret(secretTrigger);
      return;
    }
    tapCount += 1;
    clearTimeout(tapTimer);
    if (tapCount >= 3) {
      tapCount = 0;
      openSecret(secretTrigger);
    } else {
      tapTimer = setTimeout(() => { tapCount = 0; }, 750);
    }
  });
  secretOpen.addEventListener('click', () => openSecret(secretOpen));
  secretClose.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (secretOrigin?.isConnected) secretOrigin.focus({ preventScroll: true });
  });

  optionButtons.forEach(button => button.addEventListener('click', () => {
    if (state.read.length < clueIds.length || state.solved) return;
    selectedAnswer = button.dataset.archiveAnswer;
    if (selectedAnswer === 'malik') {
      state.solved = true;
      save();
    }
    updateState();
    refs.feedback.focus({ preventScroll: true });
  }));
  retry.addEventListener('click', () => {
    selectedAnswer = '';
    updateState();
    optionButtons[0].focus();
  });
  name.addEventListener('input', () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => updateCard(), 350);
  });
  name.addEventListener('blur', () => {
    clearTimeout(nameTimer);
    updateCard();
  });
  document.addEventListener('raven:language', event => {
    const next = (event.detail?.language || window.RavenI18n?.language() || document.documentElement.lang) === 'en' ? 'en' : 'ar';
    if (next !== language) {
      language = next;
      translate();
    }
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(nameTimer);
    clearTimeout(tapTimer);
    card?.dispose?.();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && state.solved) updateCard(true);
  });
  translate();
}
