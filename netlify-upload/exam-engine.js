// Shared quiz engine. Each unit page only supplies its questions (no answers).
import { auth, db, isConfigured } from './firebase-init.js?v=2';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, getDocFromServer, getDocsFromServer, setDoc, collection, query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CSS = `
:root{--ink:#14213D;--ink-soft:#4A5878;--paper:#FBFCFE;--desk:#E9EFF8;--rule:#C9D6EA;--margin:#E8788D;--mark:#FFD23F;
--ok:#0F6F64;--ok-bg:#DDF3EF;--wait:#7A4E00;--wait-bg:#FFF0C7;--bad:#9B1C1C;--bad-bg:#FBE3E1;--focus:#1D4ED8;
--body:'Atkinson Hyperlegible',system-ui,-apple-system,'Segoe UI',sans-serif;--head:'Bricolage Grotesque','Atkinson Hyperlegible',system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root{--ink:#E8EEFB;--ink-soft:#A9B6D3;--paper:#18213A;--desk:#0F1628;--rule:#2C3858;--margin:#C45B73;
--ok:#7FE0D2;--ok-bg:#12403B;--wait:#FFD98A;--wait-bg:#4A3908;--bad:#FFB3AC;--bad-bg:#4A1B19;--focus:#8FB0FF}}
*{box-sizing:border-box}
body{margin:0;background:var(--desk);color:var(--ink);font:400 1.0625rem/1.5 var(--body)}
h1,h2{font-family:var(--head);line-height:1.15;margin:0}
a,button,input,select{font:inherit;color:inherit}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px;border-radius:4px}
.wrap{max-width:760px;margin:0 auto;padding:clamp(16px,4vw,40px) clamp(12px,3vw,24px) 80px}
.back{display:inline-block;margin-bottom:14px;color:var(--ink-soft)}
h1{font-size:clamp(1.8rem,5vw,2.4rem);font-weight:800;margin-bottom:14px}
.banner{padding:12px 14px;border-radius:6px;margin-bottom:20px;font-weight:700}
.banner.info{background:var(--wait-bg);color:var(--wait)}
.banner.done{background:var(--ok-bg);color:var(--ok)}
.sheet{position:relative;background:var(--paper);border:1px solid var(--rule);border-radius:6px;margin-bottom:22px;
padding:24px 24px 14px 72px;box-shadow:0 1px 0 var(--rule),0 12px 28px -18px rgba(20,33,61,.45)}
.sheet::before{content:"";position:absolute;left:48px;top:0;bottom:0;width:2px;background:var(--margin);opacity:.7}
@media (max-width:520px){.sheet{padding:20px 14px 10px 46px}.sheet::before{left:30px}}
.sec-head{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px}
.letter{font-family:var(--head);font-weight:800;font-size:1.3rem;background:var(--mark);color:#14213D;padding:0 9px;border-radius:3px}
.sec-head h2{font-size:1.2rem;font-weight:600;flex:1 1 280px}
.sec-pts{color:var(--ink-soft);font-size:.95rem}
.intro{color:var(--ink-soft);margin:4px 0 12px}
.passage{border:1px solid var(--rule);border-radius:6px;padding:12px 14px;margin:0 0 14px;background:color-mix(in srgb,var(--desk) 50%,var(--paper))}
.passage h3{font-family:var(--head);font-size:1rem;margin:0 0 4px}
.passage p{margin:0;white-space:pre-wrap}
audio{width:100%;margin:2px 0 16px}
.pic{display:block;max-width:100%;height:auto;border-radius:6px;margin:0 0 16px}
fieldset.q{border:0;border-top:1px solid var(--rule);margin:0;padding:12px 0 14px;min-width:0}
fieldset.q legend{padding:0;float:left;width:100%;margin-bottom:6px;font-weight:700}
fieldset.q legend+*{clear:both}
.pts{font-weight:400;color:var(--ink-soft);font-size:.9rem;margin-left:6px;white-space:nowrap}
.opt{display:flex;gap:10px;align-items:flex-start;padding:7px 8px;margin:0 -8px;border-radius:6px;cursor:pointer}
.opt:hover{background:color-mix(in srgb,var(--mark) 22%,transparent)}
.opt input{margin-top:.35em;accent-color:var(--ink)}
input[type=text],select{width:100%;max-width:520px;padding:10px 12px;background:var(--paper);border:1.5px solid var(--ink-soft);border-radius:6px}
input:disabled,select:disabled{opacity:1;background:color-mix(in srgb,var(--desk) 60%,var(--paper));border-style:dashed}
.fb{margin:8px 0 0;padding:6px 10px;border-radius:6px;font-size:.98rem}
.fb.right{background:var(--ok-bg);color:var(--ok)}
.fb.part{background:var(--wait-bg);color:var(--wait)}
.fb.wrong{background:var(--bad-bg);color:var(--bad)}
.fb.neutral{background:var(--wait-bg);color:var(--wait)}
.actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.btn{background:var(--ink);color:var(--paper);border:0;border-radius:6px;padding:12px 24px;font-weight:700;cursor:pointer}
.btn:disabled{opacity:.6;cursor:wait}
.err{color:var(--bad);font-weight:700;margin:0}
.note{color:var(--ink-soft)}
`;

function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid);
  return e;
}

const pts = n => `${n} ${n === 1 ? 'point' : 'points'}`;

export function startExam(exam) {
  document.head.append(h('style', { text: CSS }));
  const root = document.getElementById('exam');
  const back = `../index.html#${exam.book}`;

  if (!isConfigured) {
    root.replaceChildren(h('p', { class: 'note', text: 'Firebase isn’t connected yet. Fill in firebase-init.js.' }));
    return;
  }

  onAuthStateChanged(auth, async user => {
    if (!user) { location.replace('../index.html'); return; }
    root.replaceChildren(h('p', { class: 'note', text: 'Loading…' }));

    let sub = null;
    try {
      const snap = await getDocsFromServer(query(collection(db, 'submissions'),
        where('uid', '==', user.uid), where('book', '==', exam.book), where('unit', '==', exam.unit)));
      snap.forEach(d => { sub = d.data(); });
    } catch (err) {
      console.error(err);
      root.replaceChildren(h('p', { class: 'err', text: 'This quiz couldn’t be loaded. Check your connection and refresh the page.' }));
      return;
    }

    // A quiz that hasn't been submitted yet must be unlocked by the teacher first.
    let unlocked = !!sub;
    let lookupFailed = false;
    if (!sub) {
      try {
        unlocked = (await getDocFromServer(doc(db, 'unlocks', `${user.uid}_${exam.book}_${exam.unit}`))).exists();
      } catch (err) { console.error(err); unlocked = false; lookupFailed = true; }
    }
    if (!unlocked) {
      root.replaceChildren(
        h('a', { class: 'back', href: back, text: 'Back to quizzes' }),
        h('h1', { text: exam.title }),
        h('p', { class: 'banner info', text: lookupFailed
          ? 'We couldn’t check whether this quiz is unlocked. Check your internet connection, then reload this page.'
          : 'This quiz is locked. Your teacher will unlock it when it’s time.' }));
      return;
    }

    let key = null;
    if (sub && sub.released) {
      try {
        const k = await getDoc(doc(db, 'answerKeys', `${exam.book}_${exam.unit}`));
        if (k.exists()) key = k.data().answers;
      } catch (err) { console.error(err); }
    }
    render(root, exam, user, sub, key, back);
  });
}

function render(root, exam, user, sub, key, back) {
  const locked = !!sub;
  const draftKey = `ts-draft-${user.uid}-${exam.book}-${exam.unit}`;
  const answers = locked ? (sub.answers || {}) : readDraft(draftKey);
  const getters = {};
  const parts = [h('a', { class: 'back', href: back, text: 'Back to quizzes' }), h('h1', { text: exam.title })];

  if (!locked) {
    parts.push(h('p', { class: 'banner info', text: 'Answer every question, then select Submit quiz at the bottom. You can’t change your answers after you submit.' }));
  } else if (!sub.released) {
    parts.push(h('p', { class: 'banner info', text: 'Submitted. Your teacher will review your answers and release your results.' }));
  } else {
    const s = typeof sub.score === 'number' ? `Reviewed. Your score: ${sub.score} out of ${exam.total}.` : 'Reviewed. See the correct answers below.';
    parts.push(h('p', { class: 'banner done', text: s }));
  }

  for (const sec of exam.sections) {
    const total = sec.questions.reduce((n, q) => n + q.points, 0);
    const card = h('section', { class: 'sheet', 'aria-labelledby': `sec-${sec.letter}` },
      h('div', { class: 'sec-head' },
        h('span', { class: 'letter', text: sec.letter }),
        h('h2', { id: `sec-${sec.letter}`, text: sec.title }),
        h('span', { class: 'sec-pts', text: pts(total) })));
    if (sec.intro) card.append(h('p', { class: 'intro', text: sec.intro }));
    for (const b of sec.boxes || []) {
      card.append(h('div', { class: 'passage' }, b.title ? h('h3', { text: b.title }) : null, h('p', { text: b.text })));
    }
    if (sec.image) card.append(h('img', { class: 'pic', src: sec.image.src, alt: sec.image.alt }));
    if (sec.audio) card.append(h('audio', { controls: true, preload: 'none', src: sec.audio, 'aria-label': `Audio for section ${sec.letter}` }));
    for (const q of sec.questions) card.append(question(q, answers[q.id] || '', locked, key, sub, getters));
    parts.push(card);
  }

  if (!locked) {
    const msg = h('p', { class: 'err', role: 'alert' });
    const btn = h('button', { class: 'btn', type: 'button', text: 'Submit quiz' });
    btn.addEventListener('click', async () => {
      msg.textContent = '';
      const collected = collect(exam, getters);
      const blank = Object.values(collected).filter(v => !v).length;
      const ask = blank
        ? `${blank} ${blank === 1 ? 'question is' : 'questions are'} blank. Submit anyway? You can’t change your answers after this.`
        : 'Submit your quiz? You can’t change your answers after this.';
      if (!confirm(ask)) return;
      btn.disabled = true;
      try {
        await setDoc(doc(db, 'submissions', `${user.uid}_${exam.book}_${exam.unit}`), {
          uid: user.uid, book: exam.book, unit: exam.unit, answers: collected,
          status: 'submitted', released: false, submittedAt: serverTimestamp()
        });
        try { localStorage.removeItem(draftKey); } catch {}
        render(root, exam, user, { answers: collected, released: false, status: 'submitted' }, null, back);
        window.scrollTo(0, 0);
      } catch (err) {
        console.error(err);
        msg.textContent = 'Your quiz wasn’t saved. Check your connection and select Submit quiz again.';
        btn.disabled = false;
      }
    });
    parts.push(h('div', { class: 'actions' }, btn, msg));

    // Keep a draft on this device while the student works.
    root.addEventListener('input', () => saveDraft(draftKey, collect(exam, getters)));
    root.addEventListener('change', () => saveDraft(draftKey, collect(exam, getters)));
  } else {
    parts.push(h('a', { class: 'back', href: back, text: 'Back to quizzes' }));
  }

  root.replaceChildren(...parts);
}

function question(q, value, locked, key, sub, getters) {
  const field = h('fieldset', { class: 'q' },
    h('legend', {}, q.text, h('span', { class: 'pts', text: `(${pts(q.points)})` })));

  if (q.type === 'choice') {
    for (const opt of q.options) {
      const input = h('input', { type: 'radio', name: q.id, value: opt, disabled: locked });
      input.checked = value === opt;
      field.append(h('label', { class: 'opt' }, input, h('span', { text: opt })));
    }
    getters[q.id] = () => { const c = field.querySelector('input:checked'); return c ? c.value : ''; };
  } else if (q.type === 'select') {
    const sel = h('select', { 'aria-label': q.text, disabled: locked }, h('option', { value: '', text: 'Choose…' }));
    for (const opt of q.options) sel.append(h('option', { value: opt, text: opt }));
    sel.value = value;
    field.append(sel);
    getters[q.id] = () => sel.value;
  } else {
    const input = h('input', { type: 'text', 'aria-label': q.text, autocomplete: 'off', autocapitalize: 'off',
      autocorrect: 'off', spellcheck: 'false', disabled: locked });
    input.value = value;
    field.append(input);
    getters[q.id] = () => input.value.trim();
  }

  if (locked && key && key[q.id] != null) {
    const ans = key[q.id];
    const marked = sub.marks && typeof sub.marks[q.id] === 'number';
    const got = marked ? sub.marks[q.id] : (q.type !== 'text' ? (ans.split(' / ').includes(value) ? q.points : 0) : null);
    let cls, txt;
    if (got === null) { cls = 'neutral'; txt = `Model answer: ${ans}`; }
    else if (got >= q.points) { cls = 'right'; txt = `Correct (${got}/${q.points})`; }
    else if (got > 0) { cls = 'part'; txt = `Partly correct (${got}/${q.points}). Answer: ${ans}`; }
    else { cls = 'wrong'; txt = `Not correct (0/${q.points}). Answer: ${ans}`; }
    field.append(h('p', { class: `fb ${cls}`, text: txt }));
  }
  return field;
}

function collect(exam, getters) {
  const out = {};
  for (const sec of exam.sections) for (const q of sec.questions) out[q.id] = getters[q.id]();
  return out;
}
function readDraft(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } }
function saveDraft(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
