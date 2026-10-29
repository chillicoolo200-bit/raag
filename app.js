'use strict';
/**
 * app.js - the browser side of "Anushthan Bondhu".
 *
 * The plan itself (budget, dates, dependencies, re-planning) is computed in the browser
 * by core.js, so it works instantly and offline. Only the ideas and the WhatsApp message
 * come from the server (/api/assist -> Gemini). All text is written with textContent,
 * never innerHTML, so nothing typed by the user or returned by the AI can inject markup.
 */
(function () {
  const Core = window.AnushthanCore;
  if (!Core) return;

  const $ = (id) => document.getElementById(id);
  const AI_TIMEOUT_MS = 12000;

  // ------------------------------------------------------------------ text
  const TEXT = {
    bn: {
      docTitle: 'অনুষ্ঠান বন্ধু | পুজো, ফেস্ট আর পার্টির প্ল্যানার',
      skip: 'মূল অংশে যাও',
      title: 'অনুষ্ঠান বন্ধু',
      tagline: 'পাড়ার পুজো, কলেজ ফেস্ট বা ঘরোয়া অনুষ্ঠান: বাজেট, কাজের তারিখ আর আইডিয়া এক জায়গায়।',
      formTitle: 'অনুষ্ঠানের তথ্য দাও',
      eventType: 'কীসের অনুষ্ঠান?',
      eventDate: 'অনুষ্ঠানের তারিখ',
      headcount: 'কতজন আসবে?',
      budget: 'মোট বাজেট (টাকা)',
      diet: 'খাবার',
      dietAny: 'সবরকম',
      dietVeg: 'শুধু নিরামিষ',
      notes: 'আর কিছু বলার আছে? (ঐচ্ছিক)',
      notesHint: 'যেমন: বৃষ্টির ভয়, জায়গা ছোট, নতুন কমিটি। সর্বোচ্চ ৩০০ অক্ষর।',
      submit: 'প্ল্যান বানাও',
      planTitle: 'তোমার প্ল্যান',
      print: 'প্রিন্ট বা PDF করো',
      budgetTitle: 'বাজেট কোথায় কত',
      budgetCaption: 'বিভাগ অনুযায়ী বাজেট ভাগ',
      colCategory: 'বিভাগ',
      colShare: 'ভাগ',
      colAmount: 'টাকা',
      total: 'মোট',
      timelineTitle: 'কোন কাজ কবে নাগাদ শেষ',
      timelineHint: 'তারিখগুলো অনুষ্ঠান থেকে উল্টো দিকে গুনে সাজানো। কোনো কাজ আগে না হলে পরেরটাও আটকে যায়।',
      aiTitle: 'আইডিয়া ও পরামর্শ',
      focusTitle: 'সবার আগে',
      ideasTitle: 'তোমার অনুষ্ঠানের জন্য আইডিয়া',
      tipsTitle: 'খরচ কমানোর উপায়',
      messageTitle: 'WhatsApp-এ পাঠানোর বার্তা',
      messageLabel: 'বার্তার খসড়া',
      copy: 'কপি করো',
      whatsapp: 'WhatsApp-এ খোলো',
      replanTitle: 'কিছু বদলেছে?',
      replanLead: 'বদলটা বলো, কোন কাজ নড়ল আমি দেখিয়ে দেব।',
      changeType: 'কী বদলেছে?',
      changeDelay: 'একটা কাজ পিছিয়ে গেছে',
      changeDate: 'অনুষ্ঠানের তারিখ বদলেছে',
      changeBudget: 'বাজেট বদলেছে',
      changeHeadcount: 'অতিথির সংখ্যা বদলেছে',
      delayTask: 'কোন কাজ?',
      delayDays: 'কত দিন পিছোল?',
      newDate: 'নতুন তারিখ',
      newBudget: 'নতুন বাজেট (টাকা)',
      newHeadcount: 'নতুন অতিথির সংখ্যা',
      apply: 'প্ল্যান আপডেট করো',
      refreshAi: 'নতুন তথ্যে AI-র পরামর্শ আবার নাও',
      footer: 'টাকা, তারিখ আর কাজের ক্রম হিসাব করে কোড, তাই সবসময় মেলে। AI দেয় আইডিয়া ও লেখা, ভুলও হতে পারে। অনুমতি, মাইকের নিয়ম আর দাম স্থানীয় অফিস ও বিক্রেতার কাছে যাচাই করে নিও।',
      errorsTitle: 'এই তথ্যগুলো ঠিক করো:',
      planReady: 'প্ল্যান তৈরি হয়েছে।',
      loadingAi: 'আইডিয়া তৈরি হচ্ছে...',
      aiDone: 'আইডিয়া তৈরি হয়েছে।',
      aiGemini: (model) => `AI: Gemini (${model})`,
      aiFallback: (reason) => `AI পাওয়া যায়নি, তৈরি টেমপ্লেট থেকে উত্তর (কারণ: ${reason})`,
      copied: 'বার্তা কপি হয়েছে।',
      copyManual: 'কপি হয়নি। বার্তাটা চেপে ধরে কপি করো।',
      today: 'আজই শুরু',
      late: 'অনুষ্ঠানের পরে পড়ছে!',
      shift: (n) => `${Core.localizeDigits(n, 'bn')} দিন পিছিয়েছে`,
      askTitle: 'বুক করার আগে এই প্রশ্নগুলো করো',
      high: 'জরুরি:',
      medium: 'খেয়াল রাখো:',
      diffTitle: 'কী কী বদলাল',
      noChange: 'কোনো কাজের তারিখ বদলায়নি, হাতে যথেষ্ট সময় ছিল।',
      movedTitle: 'যে কাজের তারিখ সরল',
      moved: (name, from, to) => `${name}: ${from} থেকে ${to}`,
      budgetMoved: 'যে বিভাগের টাকা বদলাল',
      budgetRow: (name, from, to) => `${name}: ${from} থেকে ${to}`,
      newWarn: 'নতুন সতর্কতা',
      changeFail: 'বদলটা করা যায়নি:',
    },
    en: {
      docTitle: 'Anushthan Bondhu | Planner for pujas, fests and parties',
      skip: 'Skip to main content',
      title: 'Anushthan Bondhu',
      tagline: 'A neighbourhood puja, college fest or family event: budget, task dates and ideas in one place.',
      formTitle: 'Tell us about your event',
      eventType: 'What kind of event?',
      eventDate: 'Event date',
      headcount: 'How many guests?',
      budget: 'Total budget (rupees)',
      diet: 'Food',
      dietAny: 'Anything',
      dietVeg: 'Vegetarian only',
      notes: 'Anything else? (optional)',
      notesHint: 'For example: fear of rain, small venue, new committee. Up to 300 characters.',
      submit: 'Build my plan',
      planTitle: 'Your plan',
      print: 'Print or save as PDF',
      budgetTitle: 'Where the money goes',
      budgetCaption: 'Budget split by category',
      colCategory: 'Category',
      colShare: 'Share',
      colAmount: 'Amount',
      total: 'Total',
      timelineTitle: 'What to finish, and by when',
      timelineHint: 'Dates are counted backwards from the event. If one task slips, the tasks that depend on it slip too.',
      aiTitle: 'Ideas and advice',
      focusTitle: 'Do this first',
      ideasTitle: 'Ideas for your event',
      tipsTitle: 'Ways to spend less',
      messageTitle: 'Message to send on WhatsApp',
      messageLabel: 'Draft message',
      copy: 'Copy',
      whatsapp: 'Open in WhatsApp',
      replanTitle: 'Has something changed?',
      replanLead: 'Tell me what changed and I will show which tasks move.',
      changeType: 'What changed?',
      changeDelay: 'A task is running late',
      changeDate: 'The event date changed',
      changeBudget: 'The budget changed',
      changeHeadcount: 'The guest count changed',
      delayTask: 'Which task?',
      delayDays: 'Late by how many days?',
      newDate: 'New date',
      newBudget: 'New budget (rupees)',
      newHeadcount: 'New guest count',
      apply: 'Update the plan',
      refreshAi: 'Get fresh AI advice with the new details',
      footer: 'Money, dates and task order are calculated by code, so they always add up. The AI supplies ideas and wording and can be wrong. Check permits, loudspeaker rules and prices with the local office and vendors.',
      errorsTitle: 'Please fix these:',
      planReady: 'Your plan is ready.',
      loadingAi: 'Preparing ideas...',
      aiDone: 'Ideas are ready.',
      aiGemini: (model) => `AI: Gemini (${model})`,
      aiFallback: (reason) => `AI unavailable, showing built-in templates (reason: ${reason})`,
      copied: 'Message copied.',
      copyManual: 'Could not copy. Press and hold the message to copy it.',
      today: 'Start today',
      late: 'Falls after the event!',
      shift: (n) => `Pushed back ${n} day(s)`,
      askTitle: 'Ask these before you book',
      high: 'Urgent:',
      medium: 'Note:',
      diffTitle: 'What changed',
      noChange: 'No task dates moved; there was enough slack.',
      movedTitle: 'Tasks whose dates moved',
      moved: (name, from, to) => `${name}: ${from} to ${to}`,
      budgetMoved: 'Categories whose amount changed',
      budgetRow: (name, from, to) => `${name}: ${from} to ${to}`,
      newWarn: 'New warnings',
      changeFail: 'Could not apply the change:',
    },
  };

  const REASONS = {
    bn: { no_api_key: 'API key বসানো হয়নি', auth: 'API key কাজ করছে না', quota: 'ফ্রি সীমা শেষ', rate_limited: 'এক মিনিটে অনেকবার চেষ্টা হয়েছে, একটু পরে আবার দেখো', timeout: 'সময়মতো উত্তর আসেনি', offline: 'সার্ভারে পৌঁছানো যায়নি' },
    en: { no_api_key: 'no API key set', auth: 'API key rejected', quota: 'free quota used up', rate_limited: 'too many tries in a minute, try again shortly', timeout: 'took too long', offline: 'server unreachable' },
  };

  // ----------------------------------------------------------------- state
  let lang = 'bn';
  let state = null; // { input, delays } - what the plan is built from
  let plan = null; // result of Core.buildPlan
  let assistToken = 0; // lets a newer AI request replace an older one

  const t = (key, ...args) => {
    const value = TEXT[lang][key];
    return typeof value === 'function' ? value(...args) : value;
  };

  // --------------------------------------------------------------- helpers
  /** Tiny element builder. Text goes in through textContent/append, never as HTML. */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs || {})) {
      if (value === false || value == null) continue;
      if (name === 'class') node.className = value;
      else if (name === 'text') node.textContent = value;
      else node.setAttribute(name, value === true ? '' : value);
    }
    for (const child of children.flat()) if (child != null) node.append(child);
    return node;
  }

  const localISODate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const announce = (message) => { $('status').textContent = message; };

  function fillList(list, items) {
    list.replaceChildren(...items.map((text) => el('li', { text })));
  }

  // -------------------------------------------------------- language / labels
  function applyStrings() {
    document.documentElement.lang = lang;
    document.title = t('docTitle');
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const value = t(node.dataset.i18n);
      if (typeof value === 'string') node.textContent = value;
    });
    $('langToggle').textContent = lang === 'bn' ? 'English' : 'বাংলা';
    $('langToggle').lang = lang === 'bn' ? 'en' : 'bn';
  }

  function fillEventTypes() {
    const select = $('eventType');
    const current = select.value || 'puja';
    select.replaceChildren(...Object.keys(Core.EVENT_TYPES).map((id) => el('option', { value: id, text: Core.pick(Core.EVENT_TYPES[id], lang) })));
    select.value = current;
  }

  function fillTaskSelect() {
    if (!state) return;
    const select = $('delayTask');
    const current = select.value;
    select.replaceChildren(...Core.TEMPLATES[state.input.eventType].map((task) => el('option', { value: task.id, text: Core.pick(task.title, lang) })));
    if (current) select.value = current;
  }

  function syncReplanDefaults() {
    $('newDate').value = plan.eventDate;
    $('newBudget').value = plan.input.budget;
    $('newHeadcount').value = plan.input.headcount;
  }

  // ---------------------------------------------------------------- errors
  function clearErrors() {
    $('formErrors').hidden = true;
    $('formErrors').replaceChildren();
    document.querySelectorAll('.field-error').forEach((node) => node.remove());
    document.querySelectorAll('[aria-invalid]').forEach((node) => { node.removeAttribute('aria-invalid'); node.removeAttribute('aria-describedby'); });
  }

  function showErrors(errors) {
    const box = $('formErrors');
    box.replaceChildren(el('p', { text: t('errorsTitle') }), el('ul', {}, errors.map((e) => el('li', { text: Core.pick(e, lang) }))));
    box.hidden = false;
    for (const e of errors) {
      const field = $(e.field);
      if (!field) continue;
      const id = `err-${e.field}`;
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', id);
      field.closest('.field').append(el('p', { class: 'field-error', id, text: Core.pick(e, lang) }));
    }
    box.focus();
  }

  // -------------------------------------------------------------- rendering
  function renderPlan() {
    $('summaryText').textContent = Core.summaryLine(plan, lang);

    $('warnings').replaceChildren(...plan.warnings.map((w) => el('li', { class: `warn warn--${w.severity}` },
      el('strong', { text: t(w.severity) }), Core.pick(w, lang))));

    const widest = Math.max(...plan.budget.rows.map((r) => r.percent));
    $('budgetBody').replaceChildren(...plan.budget.rows.map((row) => {
      const fill = el('span');
      fill.style.width = `${Math.round((row.percent / widest) * 100)}%`; // CSSOM, allowed by the strict CSP
      return el('tr', {},
        el('th', { scope: 'row' }, Core.pick(row, lang), el('div', { class: 'bar', 'aria-hidden': 'true' }, fill)),
        el('td', { text: Core.localizeDigits(`${row.percent}%`, lang) }),
        el('td', { class: 'num', text: Core.formatRupee(row.amount, lang) }));
    }));
    $('budgetTotal').textContent = Core.formatRupee(plan.budget.total, lang);

    $('timelineList').replaceChildren(...plan.tasks.map((task) => {
      const tags = [];
      if (task.status === 'today') tags.push(el('span', { class: 'tag', text: t('today') }));
      if (task.status === 'late') tags.push(el('span', { class: 'tag tag--late', text: t('late') }));
      if (task.shiftDays > 0) tags.push(el('span', { class: 'tag tag--shift', text: t('shift', task.shiftDays) }));
      const questions = task.ask
        ? el('details', {}, el('summary', { text: t('askTitle') }), el('ul', {}, Core.pick(task.ask, lang).map((q) => el('li', { text: q }))))
        : null;
      return el('li', { class: `task task--${task.status}` },
        el('time', { datetime: task.due, text: Core.formatDate(task.due, lang) }),
        el('span', { class: 'task__title', text: Core.pick(task.title, lang) }),
        tags.length ? el('div', {}, tags) : null,
        questions);
    }));
  }

  function renderAssist(data) {
    $('aiFocus').textContent = data.focus;
    fillList($('ideasList'), data.ideas);
    fillList($('tipsList'), data.savingTips);
    $('messageBox').value = data.messageDraft;
    $('waLink').href = `https://wa.me/?text=${encodeURIComponent(data.messageDraft)}`;
    $('aiBadge').textContent = data.source === 'gemini'
      ? t('aiGemini', String(data.model || 'Gemini'))
      : t('aiFallback', REASONS[lang][data.reason] || data.reason || REASONS[lang].offline);
  }

  function renderDiff(diff) {
    const box = $('diffBox');
    const parts = [el('h3', { text: t('diffTitle') })];
    if (!diff.tasks.length && !diff.budget.length) parts.push(el('p', { text: t('noChange') }));
    if (diff.tasks.length) {
      parts.push(el('p', { text: t('movedTitle') }),
        el('ul', {}, diff.tasks.map((d) => el('li', { text: t('moved', Core.pick(d.title, lang), Core.formatDate(d.from, lang), Core.formatDate(d.to, lang)) }))));
    }
    if (diff.budget.length) {
      parts.push(el('p', { text: t('budgetMoved') }),
        el('ul', {}, diff.budget.map((d) => el('li', { text: t('budgetRow', Core.pick(d, lang), Core.formatRupee(d.from, lang), Core.formatRupee(d.to, lang)) }))));
    }
    if (diff.newWarnings.length) {
      parts.push(el('p', { text: t('newWarn') }), el('ul', {}, diff.newWarnings.map((w) => el('li', { text: Core.pick(w, lang) }))));
    }
    box.replaceChildren(...parts);
    box.hidden = false;
    box.focus();
  }

  // -------------------------------------------------------------- AI request
  const isUsable = (data) => {
    const strings = (list) => Array.isArray(list) && list.length > 0 && list.every((s) => typeof s === 'string');
    return Boolean(data) && typeof data.focus === 'string' && typeof data.messageDraft === 'string'
      && strings(data.ideas) && strings(data.savingTips);
  };

  async function loadAssist() {
    const token = ++assistToken;
    $('aiSection').setAttribute('aria-busy', 'true');
    $('aiBadge').textContent = t('loadingAi');
    announce(t('loadingAi'));

    let data;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const response = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state.input, today: plan.today }),
        signal: controller.signal,
      });
      if (response.status === 429) throw Object.assign(new Error('rate limited'), { reason: 'rate_limited' });
      if (!response.ok) throw new Error(`http ${response.status}`);
      data = await response.json();
      if (!isUsable(data)) throw new Error('unexpected answer');
    } catch (error) {
      // The plan never depends on the server: show built-in ideas instead.
      const reason = (error && error.reason) || (error && error.name === 'AbortError' ? 'timeout' : 'offline');
      data = { ...Core.fallbackAssist(state.input, plan), source: 'fallback', reason };
    } finally {
      clearTimeout(timer);
    }
    if (token !== assistToken) return; // a newer request owns the screen now
    renderAssist(data);
    $('aiSection').setAttribute('aria-busy', 'false');
    announce(t('aiDone'));
  }

  // ---------------------------------------------------------------- events
  function readForm() {
    return {
      eventType: $('eventType').value,
      eventDate: $('eventDate').value,
      headcount: $('headcount').value,
      budget: $('budget').value,
      diet: $('planForm').elements.diet.value,
      notes: $('notes').value,
      lang,
    };
  }

  function onSubmit(event) {
    event.preventDefault();
    clearErrors();
    const today = localISODate();
    const checked = Core.validateInput(readForm(), today);
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }
    state = { input: checked.value, delays: {} };
    plan = Core.buildPlan(state.input, today, state.delays);
    renderPlan();
    fillTaskSelect();
    syncReplanDefaults();
    $('diffBox').hidden = true;
    $('refreshAi').hidden = true;
    $('results').hidden = false;
    $('planTitle').focus();
    announce(t('planReady'));
    loadAssist();
  }

  function onChangeType() {
    const type = $('changeType').value;
    document.querySelectorAll('[data-change]').forEach((node) => { node.hidden = node.dataset.change !== type; });
  }

  function onReplan(event) {
    event.preventDefault();
    const type = $('changeType').value;
    const change = {
      delay: { type, taskId: $('delayTask').value, days: Number($('delayDays').value) },
      date: { type, eventDate: $('newDate').value },
      budget: { type, budget: Number($('newBudget').value) },
      headcount: { type, headcount: Number($('newHeadcount').value) },
    }[type];
    const result = Core.applyChange(state, change, plan.today);
    if (!result.ok) {
      const box = $('diffBox');
      box.replaceChildren(el('p', { text: t('changeFail') }), el('ul', {}, result.errors.map((e) => el('li', { text: Core.pick(e, lang) }))));
      box.hidden = false;
      box.focus();
      return;
    }
    state = result.state;
    plan = result.plan;
    renderPlan();
    syncReplanDefaults();
    renderDiff(result.diff);
    $('refreshAi').hidden = false;
  }

  async function onCopy() {
    const box = $('messageBox');
    try {
      await navigator.clipboard.writeText(box.value);
      announce(t('copied'));
    } catch (error) {
      box.focus();
      box.select();
      announce(t('copyManual'));
    }
  }

  function setLanguage(next) {
    lang = next;
    if (state) state.input = { ...state.input, lang };
    applyStrings();
    fillEventTypes();
    fillTaskSelect();
    $('diffBox').hidden = true;
    if (plan) {
      renderPlan();
      loadAssist();
    }
  }

  // ------------------------------------------------------------------ start
  function init() {
    const today = localISODate();
    $('eventDate').min = today;
    $('eventDate').max = Core.addDays(today, Core.LIMITS.maxDaysAhead);
    $('eventDate').value = Core.addDays(today, 45);
    $('headcount').value = 100;
    $('budget').value = 50000;
    $('newDate').min = today;
    $('newDate').max = Core.addDays(today, Core.LIMITS.maxDaysAhead);

    applyStrings();
    fillEventTypes();
    onChangeType();

    $('planForm').addEventListener('submit', onSubmit);
    $('replanForm').addEventListener('submit', onReplan);
    $('changeType').addEventListener('change', onChangeType);
    $('copyBtn').addEventListener('click', onCopy);
    $('printBtn').addEventListener('click', () => window.print());
    $('refreshAi').addEventListener('click', () => { $('refreshAi').hidden = true; loadAssist(); });
    $('langToggle').addEventListener('click', () => setLanguage(lang === 'bn' ? 'en' : 'bn'));
  }

  init();
})();
