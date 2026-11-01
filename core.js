'use strict';
/**
 * core.js - pure planning logic for "Anushthan Bondhu" (অনুষ্ঠান বন্ধু).
 *
 * Runs in the browser (window.AnushthanCore) and in Node (require).
 * No network, no DOM, no randomness: the same input always gives the same plan,
 * which keeps every rule easy to test. Money, dates and task dependencies live
 * here on purpose; the AI model is only used for ideas and wording (see assist-handler.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AnushthanCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // ---------------------------------------------------------------- constants
  const LIMITS = Object.freeze({
    minBudget: 2000,
    maxBudget: 10000000,
    minHeadcount: 5,
    maxHeadcount: 5000,
    maxNotes: 300,
    maxDaysAhead: 730,
    maxDelayDays: 60,
  });
  // Rough planning thresholds (rupees). They are heuristics, documented in README.
  const MIN_TOTAL_PER_HEAD = 50;
  const TIGHT_TIMELINE_DAYS = 7;
  const DAY_MS = 86400000;

  const EVENT_TYPES = Object.freeze({
    puja: { bn: 'পাড়ার পুজো', en: 'Neighbourhood puja' },
    college_fest: { bn: 'কলেজ ফেস্ট', en: 'College fest' },
    birthday: { bn: 'জন্মদিন', en: 'Birthday party' },
    home_event: { bn: 'ঘরোয়া অনুষ্ঠান (বিয়ে, অন্নপ্রাশন)', en: 'Family event (wedding, annaprashan)' },
  });

  const cat = (bn, en) => ({ bn, en });
  const CATEGORIES = Object.freeze({
    pandal_decor: cat('মণ্ডপ ও সাজসজ্জা', 'Pandal and decoration'),
    idol_ritual: cat('প্রতিমা ও পূজার সামগ্রী', 'Idol and puja items'),
    food_bhog: cat('ভোগ ও প্রসাদ', 'Bhog and prasad'),
    sound_light: cat('সাউন্ড ও আলো', 'Sound and lights'),
    printing_publicity: cat('ছাপা ও প্রচার', 'Printing and publicity'),
    volunteers_logistics: cat('স্বেচ্ছাসেবক ও ব্যবস্থাপনা', 'Volunteers and logistics'),
    stage_decor: cat('স্টেজ ও সাজসজ্জা', 'Stage and decoration'),
    food_refreshments: cat('খাবার ও জল', 'Food and water'),
    prizes_certificates: cat('পুরস্কার ও সার্টিফিকেট', 'Prizes and certificates'),
    logistics_safety: cat('নিরাপত্তা ও প্রাথমিক চিকিৎসা', 'Safety and first aid'),
    venue_decor: cat('জায়গা ও সাজসজ্জা', 'Venue and decoration'),
    food: cat('খাবার', 'Food'),
    cake_gifts: cat('কেক ও রিটার্ন গিফট', 'Cake and return gifts'),
    entertainment: cat('খেলা ও বিনোদন', 'Games and entertainment'),
    photography: cat('ছবি তোলা', 'Photography'),
    food_catering: cat('খাবার ও ক্যাটারিং', 'Food and catering'),
    invitations_printing: cat('কার্ড ও আমন্ত্রণ', 'Invitations'),
    entertainment_music: cat('গান-বাজনা', 'Music'),
    logistics_transport: cat('অতিথির থাকা ও যাতায়াত', 'Guest stay and travel'),
    contingency: cat('অপ্রত্যাশিত খরচের তহবিল', 'Contingency fund'),
  });

  // Share of the total budget per category (percent). Each preset must add up to 100.
  const PRESETS = Object.freeze({
    puja: {
      shares: [['pandal_decor', 30], ['idol_ritual', 20], ['food_bhog', 20], ['sound_light', 10],
        ['printing_publicity', 5], ['volunteers_logistics', 5], ['contingency', 10]],
      foodCategory: 'food_bhog', minFoodPerHead: 20, trimFirst: ['printing_publicity', 'sound_light'],
    },
    college_fest: {
      shares: [['stage_decor', 20], ['sound_light', 20], ['food_refreshments', 20], ['prizes_certificates', 15],
        ['printing_publicity', 10], ['logistics_safety', 5], ['contingency', 10]],
      foodCategory: 'food_refreshments', minFoodPerHead: 30, trimFirst: ['printing_publicity', 'stage_decor'],
    },
    birthday: {
      shares: [['venue_decor', 20], ['food', 40], ['cake_gifts', 15], ['entertainment', 10],
        ['photography', 5], ['contingency', 10]],
      foodCategory: 'food', minFoodPerHead: 80, trimFirst: ['photography', 'entertainment'],
    },
    home_event: {
      shares: [['food_catering', 40], ['venue_decor', 20], ['photography', 10], ['invitations_printing', 5],
        ['entertainment_music', 10], ['logistics_transport', 5], ['contingency', 10]],
      foodCategory: 'food_catering', minFoodPerHead: 80, trimFirst: ['entertainment_music', 'photography'],
    },
  });

  // Task templates. dueBefore = days before the event the task should be finished.
  // Rule (checked by tests): tasks are listed after everything they depend on, and a
  // task is never due earlier than a task it depends on.
  const task = (id, dueBefore, dependsOn, category, bn, en, ask) => ({
    id, dueBefore, dependsOn, category, title: { bn, en }, ask: ask || null,
  });
  const ask = (bn, en) => ({ bn, en });

  const TEMPLATES = Object.freeze({
    puja: [
      task('committee', 35, [], null, 'কমিটি গঠন ও দায়িত্ব ভাগ', 'Form the committee and split duties'),
      task('permission', 28, ['committee'], null, 'থানা ও পুরসভা/পঞ্চায়েতের অনুমতি নেওয়া', 'Get police and civic permissions',
        ask(['মাইক বাজানোর সময়সীমা কী (স্থানীয় অফিসে যাচাই করো)?', 'মণ্ডপ বা রাস্তা ব্যবহারের অনুমতিপত্র লাগবে কি?', 'আবেদনের শেষ তারিখ ও ফি কত?'],
          ['What are the loudspeaker time limits (confirm locally)?', 'Is a permit needed for the pandal or road use?', 'What are the application deadline and fee?'])),
      task('chanda', 30, ['committee'], null, 'বাজেট চূড়ান্ত করে চাঁদা আদায় শুরু', 'Finalise the budget and start collecting contributions'),
      task('idol', 25, ['chanda'], 'idol_ritual', 'প্রতিমা বায়না করা', 'Book the idol',
        ask(['প্রতিমার মাপ ও দাম কত?', 'অগ্রিম কত, বাকিটা কবে?', 'পৌঁছে দেওয়া ও বিসর্জনের ব্যবস্থা কার?'],
          ['What are the idol size and price?', 'How much advance, and when is the balance due?', 'Who handles delivery and immersion?'])),
      task('priest', 20, ['idol'], 'idol_ritual', 'পুরোহিত ঠিক করা ও পূজার সামগ্রীর তালিকা', 'Fix the priest and list puja items'),
      task('pandal', 18, ['permission', 'idol'], 'pandal_decor', 'মণ্ডপ ও সাজসজ্জার কারিগর ঠিক করা', 'Hire the pandal and decoration crew',
        ask(['মণ্ডপ কবে খাড়া হবে, কবে শেষ?', 'বৃষ্টি হলে ঢাকার ব্যবস্থা আছে কি?', 'মোট দাম লিখিতভাবে পাওয়া যাবে কি?'],
          ['When will the pandal go up and when is it finished?', 'Is there rain cover?', 'Can you give the total price in writing?'])),
      task('sound', 14, ['permission'], 'sound_light', 'মাইক, সাউন্ড ও আলো বুক করা', 'Book sound and lights',
        ask(['জেনারেটর বা বিদ্যুতের ব্যবস্থা কার?', 'কত ঘণ্টা চলবে?', 'অগ্রিম ও ফেরতের নিয়ম কী?'],
          ['Who arranges power or a generator?', 'For how many hours?', 'What are the advance and refund terms?'])),
      task('publicity', 12, ['chanda'], 'printing_publicity', 'ব্যানার, পোস্টার ও প্রচার', 'Banners, posters and publicity'),
      task('food', 7, ['chanda'], 'food_bhog', 'ভোগ ও প্রসাদের বাজার-তালিকা আর রাঁধুনি ঠিক করা', 'Plan the bhog shopping list and cooks',
        ask(['কতজনের জন্য রান্না হবে?', 'বাজার কবে ও কে করবে?', 'পরিবেশনে কতজন স্বেচ্ছাসেবক লাগবে?'],
          ['How many people will be served?', 'Who shops, and when?', 'How many volunteers are needed to serve?'])),
      task('volunteers', 5, ['committee'], 'volunteers_logistics', 'স্বেচ্ছাসেবক ও ভিড় সামলানোর ছক', 'Volunteer and crowd plan'),
      task('final', 2, ['pandal', 'sound', 'food'], null, 'সব বুকিং ও দায়িত্ব শেষবার মিলিয়ে দেখা', 'Final check of bookings and duties'),
    ],
    college_fest: [
      task('core', 40, [], null, 'কোর টিম ও দায়িত্ব ভাগ', 'Form the core team and split duties'),
      task('approval', 35, ['core'], null, 'কলেজ কর্তৃপক্ষের অনুমতি ও তারিখ-ভেন্যু চূড়ান্ত', 'Get college approval and fix date and venue',
        ask(['প্রিন্সিপাল বা দায়িত্বপ্রাপ্ত শিক্ষকের লিখিত অনুমতি আছে কি?', 'কোন কোন ঘর বা মাঠ ব্যবহার করা যাবে?', 'অনুষ্ঠান কত রাত পর্যন্ত চলবে?'],
          ['Is there written permission from the principal or teacher in charge?', 'Which rooms or grounds can be used?', 'How late can the event run?'])),
      task('sponsor', 33, ['core'], null, 'বাজেট তৈরি ও স্পনসর খোঁজা', 'Draft the budget and find sponsors',
        ask(['স্পনসরকে কী কী দেখানো হবে (ব্যানার, স্টল)?', 'টাকা কবে ও কীভাবে দেবেন?'],
          ['What will the sponsor get (banner, stall)?', 'When and how will they pay?'])),
      task('events', 28, ['approval'], null, 'প্রতিযোগিতা ও অনুষ্ঠানের তালিকা আর নিয়ম ঠিক করা', 'Fix the events list and rules'),
      task('registration', 24, ['events'], 'printing_publicity', 'রেজিস্ট্রেশন ফর্ম খোলা ও প্রচার শুরু', 'Open registration and start publicity'),
      task('stage', 18, ['approval', 'sponsor'], 'stage_decor', 'স্টেজ ও সাজসজ্জা ঠিক করা', 'Arrange stage and decoration'),
      task('sound', 16, ['approval', 'sponsor'], 'sound_light', 'সাউন্ড ও আলো বুক করা', 'Book sound and lights',
        ask(['কতগুলো মাইক ও স্পিকার পাওয়া যাবে?', 'সাউন্ড-চেকের সময় কখন?', 'অগ্রিম ও ফেরতের নিয়ম কী?'],
          ['How many mics and speakers are included?', 'When is the sound check?', 'What are the advance and refund terms?'])),
      task('prizes', 12, ['events'], 'prizes_certificates', 'পুরস্কার ও সার্টিফিকেট ছাপানো', 'Order prizes and print certificates'),
      task('food', 8, ['sponsor'], 'food_refreshments', 'খাবার ও জলের ব্যবস্থা', 'Arrange food and water'),
      task('safety', 6, ['core'], 'logistics_safety', 'স্বেচ্ছাসেবক, প্রাথমিক চিকিৎসা ও নিরাপত্তা', 'Volunteers, first aid and safety'),
      task('rehearsal', 3, ['stage', 'sound', 'registration'], null, 'রিহার্সাল ও সাউন্ড চেক', 'Rehearsal and sound check'),
      task('final', 1, ['rehearsal', 'prizes', 'food', 'safety'], null, 'শেষবার সব মিলিয়ে দেখা', 'Final check of everything'),
    ],
    birthday: [
      task('guests', 21, [], null, 'অতিথির তালিকা ও সময় ঠিক করা', 'Fix the guest list and time'),
      task('venue', 18, ['guests'], 'venue_decor', 'জায়গা ঠিক করা ও সাজসজ্জার পরিকল্পনা', 'Fix the venue and decoration plan'),
      task('invites', 14, ['guests', 'venue'], null, 'আমন্ত্রণ পাঠানো', 'Send invitations'),
      task('photo', 12, ['venue'], 'photography', 'ছবি তোলার ব্যবস্থা', 'Arrange photography'),
      task('food', 10, ['guests'], 'food', 'খাবার বা ক্যাটারার ঠিক করা', 'Fix the food or caterer',
        ask(['কতজনের মাপে দাম ধরা হয়েছে?', 'কোনও অতিথির খাবারে বাধা (নিরামিষ, এলার্জি) আছে কি?', 'অগ্রিম কত?'],
          ['What headcount is the price based on?', 'Any dietary limits (vegetarian, allergies)?', 'How much advance?'])),
      task('decor_fun', 7, ['venue'], 'entertainment', 'সাজসজ্জা ও খেলা বা বিনোদনের ব্যবস্থা', 'Decoration and games or entertainment'),
      task('gifts', 6, ['guests'], 'cake_gifts', 'রিটার্ন গিফট কেনা', 'Buy return gifts'),
      task('cake', 5, ['guests'], 'cake_gifts', 'কেক অর্ডার করা', 'Order the cake'),
      task('final', 1, ['food', 'decor_fun', 'gifts', 'cake'], null, 'শেষবার সব মিলিয়ে দেখা', 'Final check of everything'),
    ],
    home_event: [
      task('plan', 45, [], null, 'তারিখ ও অতিথির তালিকা ঠিক করা', 'Fix the date and guest list'),
      task('venue', 40, ['plan'], 'venue_decor', 'জায়গা (বাড়ি বা হল) ঠিক করা', 'Fix the venue (home or hall)'),
      task('caterer', 30, ['venue'], 'food_catering', 'ক্যাটারার বা রাঁধুনি ঠিক করা', 'Fix the caterer or cooks',
        ask(['প্লেট-পিছু দাম কত, আর কতজনের মাপে?', 'মেনু লিখিতভাবে পাওয়া যাবে কি?', 'অগ্রিম কত, বাকিটা কবে?'],
          ['What is the per-plate price and for how many?', 'Can the menu be given in writing?', 'How much advance, and when is the balance?'])),
      task('invites', 25, ['venue'], 'invitations_printing', 'কার্ড ছাপা ও আমন্ত্রণ পাঠানো', 'Print and send invitations'),
      task('photo', 20, ['venue'], 'photography', 'ফটোগ্রাফার ঠিক করা', 'Hire the photographer',
        ask(['কত ঘণ্টার জন্য, আর কতগুলো ছবি বা ভিডিও?', 'ছবি কবে পাওয়া যাবে?', 'অগ্রিম ও বাতিলের নিয়ম কী?'],
          ['For how many hours, and how many photos or videos?', 'When will the photos be delivered?', 'What are the advance and cancellation terms?'])),
      task('decor', 18, ['venue'], 'venue_decor', 'সাজসজ্জা ঠিক করা', 'Arrange decoration'),
      task('music', 14, ['venue'], 'entertainment_music', 'গান-বাজনা বা সাউন্ডের ব্যবস্থা', 'Arrange music or sound'),
      task('stay', 10, ['invites'], 'logistics_transport', 'বাইরের অতিথির থাকা ও যাতায়াত', 'Stay and travel for outstation guests'),
      task('final', 2, ['caterer', 'photo', 'decor', 'music', 'stay'], null, 'শেষবার সব মিলিয়ে দেখা', 'Final check of everything'),
    ],
  });

  // ------------------------------------------------------------- date helpers
  function parseISODate(text) {
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const [y, m, d] = text.split('-').map(Number);
    const ms = Date.UTC(y, m - 1, d);
    const check = new Date(ms);
    const real = check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
    return real ? ms : null;
  }
  const toISODate = (ms) => new Date(ms).toISOString().slice(0, 10);
  const addDays = (iso, n) => toISODate(parseISODate(iso) + n * DAY_MS);
  const daysBetween = (fromISO, toISO) => Math.round((parseISODate(toISO) - parseISODate(fromISO)) / DAY_MS);

  // ---------------------------------------------------------- text formatting
  const pick = (obj, lang) => (obj && (obj[lang] || obj.en)) || '';

  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const localizeDigits = (text, lang) => (lang === 'bn' ? String(text).replace(/\d/g, (d) => BN_DIGITS[d]) : String(text));

  /** Indian digit grouping (12,34,567), done by hand so output is identical on every device. */
  function groupIndian(n) {
    const s = String(Math.round(Math.abs(n)));
    if (s.length <= 3) return s;
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return rest + ',' + s.slice(-3);
  }
  const formatRupee = (n, lang) => localizeDigits('₹' + (n < 0 ? '-' : '') + groupIndian(n), lang);
  const formatDate = (iso, lang) => {
    const [y, m, d] = iso.split('-');
    return localizeDigits(d + '/' + m + '/' + y, lang);
  };

  // --------------------------------------------------------------- validation
  const err = (field, bn, en) => ({ field, bn, en });

  /**
   * Checks raw user input. Returns { ok, errors, value }; bad input is reported, never thrown
   * (only a malformed `today`, a programming error, throws).
   * Text is trimmed and length-limited; numbers must be whole numbers in range.
   */
  function validateInput(raw, today) {
    if (parseISODate(today) === null) throw new TypeError('today must be an ISO date (YYYY-MM-DD)');
    const body = raw && typeof raw === 'object' ? raw : {};
    const errors = [];

    const eventType = typeof body.eventType === 'string' && EVENT_TYPES[body.eventType] ? body.eventType : null;
    if (!eventType) errors.push(err('eventType', 'অনুষ্ঠানের ধরন বেছে নাও।', 'Choose an event type.'));

    const eventDate = typeof body.eventDate === 'string' && parseISODate(body.eventDate) ? body.eventDate : null;
    if (!eventDate) {
      errors.push(err('eventDate', 'সঠিক তারিখ দাও।', 'Enter a valid date.'));
    } else if (daysBetween(today, eventDate) < 0) {
      errors.push(err('eventDate', 'তারিখ আজ বা তার পরের হতে হবে।', 'The date must be today or later.'));
    } else if (daysBetween(today, eventDate) > LIMITS.maxDaysAhead) {
      errors.push(err('eventDate', 'তারিখ দুই বছরের মধ্যে হতে হবে।', 'The date must be within two years.'));
    }

    const headcount = Number(body.headcount);
    if (!Number.isInteger(headcount) || headcount < LIMITS.minHeadcount || headcount > LIMITS.maxHeadcount) {
      errors.push(err('headcount', `কতজন আসবে: ${LIMITS.minHeadcount} থেকে ${LIMITS.maxHeadcount}-এর মধ্যে একটি পূর্ণ সংখ্যা দাও।`,
        `Guests must be a whole number from ${LIMITS.minHeadcount} to ${LIMITS.maxHeadcount}.`));
    }

    const budget = Number(body.budget);
    if (!Number.isInteger(budget) || budget < LIMITS.minBudget || budget > LIMITS.maxBudget) {
      errors.push(err('budget', `বাজেট ${LIMITS.minBudget} থেকে ${LIMITS.maxBudget} টাকার মধ্যে একটি পূর্ণ সংখ্যা হতে হবে।`,
        `Budget must be a whole number of rupees from ${LIMITS.minBudget} to ${LIMITS.maxBudget}.`));
    }

    const diet = body.diet === 'veg' ? 'veg' : 'any';
    const lang = body.lang === 'en' ? 'en' : 'bn';
    const notes = typeof body.notes === 'string'
      ? body.notes.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxNotes)
      : '';

    if (errors.length) return { ok: false, errors, value: null };
    return { ok: true, errors: [], value: { eventType, eventDate, headcount, budget, diet, lang, notes } };
  }

  // ------------------------------------------------------------------- budget
  /** Splits the total by percentage; the largest-remainder rule makes the parts add up exactly. */
  function allocateBudget(total, eventType) {
    const rows = PRESETS[eventType].shares.map(([id, percent]) => {
      const exact = (total * percent) / 100;
      return { id, percent, exact, amount: Math.floor(exact) };
    });
    let left = total - rows.reduce((sum, r) => sum + r.amount, 0);
    const byRemainder = [...rows].sort((a, b) => (b.exact - b.amount) - (a.exact - a.amount) || a.id.localeCompare(b.id));
    for (const r of byRemainder) {
      if (left <= 0) break;
      r.amount += 1;
      left -= 1;
    }
    return rows.map(({ id, percent, amount }) => ({ id, percent, amount, bn: CATEGORIES[id].bn, en: CATEGORIES[id].en }));
  }

  function budgetWarnings(input, rows, timeline) {
    const warnings = [];
    const preset = PRESETS[input.eventType];
    const perHead = Math.floor(input.budget / input.headcount);
    const foodRow = rows.find((r) => r.id === preset.foodCategory);
    const foodPerHead = Math.floor(foodRow.amount / input.headcount);

    if (perHead < MIN_TOTAL_PER_HEAD) {
      const trims = preset.trimFirst.map((id) => CATEGORIES[id]);
      warnings.push({
        code: 'LOW_PER_HEAD', severity: 'high',
        bn: `জনপ্রতি বাজেট মাত্র ${formatRupee(perHead, 'bn')}। অতিথি কমাও বা বাজেট বাড়াও। আগে ছাঁটতে পারো: ${trims.map((c) => c.bn).join(', ')}।`,
        en: `Budget per guest is only ${formatRupee(perHead, 'en')}. Reduce guests or raise the budget. Trim first: ${trims.map((c) => c.en).join(', ')}.`,
      });
    }
    if (foodPerHead < preset.minFoodPerHead) {
      warnings.push({
        code: 'LOW_FOOD_PER_HEAD', severity: 'medium',
        bn: `খাবারে জনপ্রতি ${formatRupee(foodPerHead, 'bn')} পড়ছে, সাধারণত অন্তত ${formatRupee(preset.minFoodPerHead, 'bn')} লাগে।`,
        en: `Food works out to ${formatRupee(foodPerHead, 'en')} per guest; plan for at least ${formatRupee(preset.minFoodPerHead, 'en')}.`,
      });
    }
    if (timeline.daysLeft < TIGHT_TIMELINE_DAYS) {
      warnings.push({
        code: 'TIGHT_TIMELINE', severity: 'high',
        bn: `অনুষ্ঠানের আর ${localizeDigits(timeline.daysLeft, 'bn')} দিন বাকি। প্রতিমা, মণ্ডপ, ক্যাটারারের মতো বড় বুকিং আজই শুরু করো।`,
        en: `Only ${timeline.daysLeft} day(s) left. Start the big bookings (venue, caterer, sound) today.`,
      });
    } else if (timeline.compressed) {
      warnings.push({
        code: 'COMPRESSED', severity: 'medium',
        bn: 'হাতে সময় স্বাভাবিকের চেয়ে কম, তাই সব কাজের সময়সীমা চেপে সাজানো হয়েছে।',
        en: 'There is less time than usual, so every deadline has been compressed.',
      });
    }
    if (timeline.eventAtRisk) {
      warnings.push({
        code: 'EVENT_AT_RISK', severity: 'high',
        bn: 'দেরির কারণে কিছু কাজ অনুষ্ঠানের তারিখের পরে চলে গেছে। তারিখ পিছোও বা কাজ ভাগ করে নাও।',
        en: 'Because of the delay, some tasks now fall after the event date. Move the date or share the work.',
      });
    }
    return warnings;
  }

  // ----------------------------------------------------------------- timeline
  /**
   * Schedules tasks backwards from the event date. If there is less time than the
   * template needs, every deadline is scaled down (order is preserved). `delays`
   * maps a task id to extra days; a delayed task also pushes back everything that depends on it.
   */
  function buildTimeline(input, today, delays) {
    const template = TEMPLATES[input.eventType];
    const daysLeft = daysBetween(today, input.eventDate);
    const longestLead = Math.max(...template.map((t) => t.dueBefore));
    const compressed = daysLeft < longestLead;
    const scale = compressed ? daysLeft / longestLead : 1;

    const done = {};
    template.forEach((tpl, order) => {
      const dueBefore = Math.round(tpl.dueBefore * scale);
      const baseDue = addDays(input.eventDate, -dueBefore);
      const requested = Math.max(0, Math.min(LIMITS.maxDelayDays, Math.floor(Number(delays && delays[tpl.id]) || 0)));
      let due = addDays(baseDue, requested);
      for (const dep of tpl.dependsOn) {
        if (done[dep].due > due) due = done[dep].due;
      }
      const status = due > input.eventDate ? 'late' : due === today ? 'today' : 'upcoming';
      done[tpl.id] = {
        id: tpl.id, order, title: tpl.title, category: tpl.category, ask: tpl.ask,
        dependsOn: tpl.dependsOn, baseDue, due, status,
        shiftDays: daysBetween(baseDue, due),
      };
    });
    const tasks = Object.values(done).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.order - b.order));
    return { tasks, daysLeft, compressed, eventAtRisk: tasks.some((t) => t.status === 'late') };
  }

  /** Builds the full plan for validated input. `today` is an ISO date (YYYY-MM-DD). */
  function buildPlan(input, today, delays) {
    const timeline = buildTimeline(input, today, delays || {});
    const rows = allocateBudget(input.budget, input.eventType);
    return {
      input, today, eventDate: input.eventDate,
      daysLeft: timeline.daysLeft,
      budget: { total: input.budget, perHead: Math.floor(input.budget / input.headcount), rows },
      tasks: timeline.tasks,
      compressed: timeline.compressed,
      eventAtRisk: timeline.eventAtRisk,
      delays: { ...(delays || {}) },
      warnings: budgetWarnings(input, rows, timeline),
    };
  }

  // ------------------------------------------------------------------ re-plan
  function comparePlans(before, after) {
    const previous = Object.fromEntries(before.tasks.map((t) => [t.id, t]));
    const tasks = after.tasks
      .filter((t) => previous[t.id].due !== t.due)
      .map((t) => ({ id: t.id, title: t.title, from: previous[t.id].due, to: t.due, shiftDays: daysBetween(previous[t.id].due, t.due) }));
    const oldAmounts = Object.fromEntries(before.budget.rows.map((r) => [r.id, r.amount]));
    const budget = after.budget.rows
      .filter((r) => oldAmounts[r.id] !== r.amount)
      .map((r) => ({ id: r.id, bn: r.bn, en: r.en, from: oldAmounts[r.id], to: r.amount, delta: r.amount - oldAmounts[r.id] }));
    const seen = new Set(before.warnings.map((w) => w.code));
    return {
      tasks, budget,
      newWarnings: after.warnings.filter((w) => !seen.has(w.code)),
      eventAtRisk: after.eventAtRisk,
    };
  }

  /**
   * Applies one change ("the venue is 5 days late", "budget cut", ...) to a plan state
   * { input, delays } and reports exactly what moved. Never mutates its arguments.
   * change: { type: 'delay', taskId, days } | { type: 'date', eventDate } |
   *         { type: 'budget', budget } | { type: 'headcount', headcount }
   */
  function applyChange(state, change, today) {
    const before = buildPlan(state.input, today, state.delays);
    let input = { ...state.input };
    const delays = { ...state.delays };

    if (change && change.type === 'delay') {
      const known = TEMPLATES[input.eventType].some((t) => t.id === change.taskId);
      const days = Number(change.days);
      if (!known || !Number.isInteger(days) || days < 1 || days > LIMITS.maxDelayDays) {
        return { ok: false, errors: [err('delay', `দেরির দিন ১ থেকে ${LIMITS.maxDelayDays}-এর মধ্যে হতে হবে।`, `Delay must be between 1 and ${LIMITS.maxDelayDays} days.`)] };
      }
      delays[change.taskId] = Math.min(LIMITS.maxDelayDays, (delays[change.taskId] || 0) + days);
    } else if (change && ['date', 'budget', 'headcount'].includes(change.type)) {
      const field = { date: 'eventDate', budget: 'budget', headcount: 'headcount' }[change.type];
      const merged = { ...input, [field]: change[field] };
      const checked = validateInput(merged, today);
      const bad = checked.errors.filter((e) => e.field === field);
      if (bad.length) return { ok: false, errors: bad };
      input = { ...input, [field]: checked.value[field] };
    } else {
      return { ok: false, errors: [err('change', 'এই বদল চেনা যায়নি।', 'Unknown change.')] };
    }

    const plan = buildPlan(input, today, delays);
    return { ok: true, state: { input, delays }, plan, diff: comparePlans(before, plan) };
  }

  // ------------------------------------------------- built-in (no-AI) assistant
  const FALLBACK = {
    puja: {
      bn: {
        ideas: ['পাড়ার ছোটদের নিয়ে মণ্ডপের সামনে আলপনা প্রতিযোগিতা।', 'শোলা, পাট বা কাপড় দিয়ে হাতে-গড়া সাজ, স্থানীয় কারিগরদের কাজ দিয়ে।',
          'ভোগ পরিবেশনে বাজার, রান্না ও পরিবেশনের আলাদা স্বেচ্ছাসেবক দল।', 'ছোটদের ১৫ মিনিটের সাংস্কৃতিক স্লট, তালিকা আগে থেকে ঠিক করে।', 'শালপাতা বা মাটির খুরিতে প্লাস্টিকমুক্ত ভোগ।'],
        tips: ['চাঁদার হিসাব আর খরচের তালিকা মণ্ডপে টাঙিয়ে দাও, ভরসা বাড়ে।', 'সাউন্ড আর আলো একই বিক্রেতার কাছ থেকে প্যাকেজে নাও, দাম কমে।', 'প্রতিটি বুকিংয়ের অগ্রিম লিখিত রসিদে নাও।'],
      },
      en: {
        ideas: ['An alpona drawing contest for local kids in front of the pandal.', 'Handmade decoration from shola, jute or cloth, giving work to local artisans.',
          'Separate volunteer teams for shopping, cooking and serving the bhog.', 'A 15-minute cultural slot for children, with the list fixed in advance.', 'Plastic-free bhog on sal leaves or clay cups.'],
        tips: ['Display the contribution and expense list at the pandal to build trust.', 'Book sound and lights as one package from one vendor to cut the price.', 'Take a written receipt for every advance.'],
      },
    },
    college_fest: {
      bn: {
        ideas: ['একই সময়ে তিনটি ছোট মঞ্চে আলাদা প্রতিযোগিতা, যাতে ভিড় ভাগ হয়।', 'ডিপার্টমেন্ট-ভিত্তিক পয়েন্ট তালিকা, সবার সামনে সরাসরি দেখানো।', 'পুরনো ছাত্রদের নিয়ে ছোট আলোচনা বা কেরিয়ার-কথা।',
          'স্টলে স্থানীয় খাবারের দোকানকে জায়গা দিয়ে খাবারের খরচ কমানো।', 'ফেস্টের শেষে সবাইকে অনলাইন ফিডব্যাক ফর্ম।'],
        tips: ['স্পনসরকে স্পষ্টভাবে লিখে দাও বিনিময়ে কী পাবেন।', 'সার্টিফিকেটের নকশা একবারই বানিয়ে নাম বদলে ছাপো।', 'রেজিস্ট্রেশনে সামান্য ফি রাখলে অংশগ্রহণ নিশ্চিত হয়।'],
      },
      en: {
        ideas: ['Three small stages running different contests at once to spread the crowd.', 'A live department-wise points table everyone can see.', 'A short talk by alumni on careers.',
          'Give local food vendors stall space to cut the food cost.', 'An online feedback form for everyone at the end.'],
        tips: ['Write down clearly what each sponsor gets in return.', 'Design the certificate once and only change the names when printing.', 'A small registration fee makes participation more reliable.'],
      },
    },
    birthday: {
      bn: {
        ideas: ['বাড়িতে থিম ঠিক করে নিজের হাতে সাজ, যেমন বইয়ের গল্প বা রং।', 'বয়স অনুযায়ী দুটি খেলার দল, প্রতিটিতে ছোট পুরস্কার।', 'ফটো কর্নার, ফোনেই ছবি তুলে পরে সবাইকে পাঠানো।',
          'রিটার্ন গিফটে একটি বই বা গাছের চারা।', 'কেক কাটার আগে ১০ মিনিটের গল্প বা গানের স্লট।'],
        tips: ['অতিথির সংখ্যা চূড়ান্ত করে তারপর খাবারের অর্ডার দাও।', 'কেক আর খাবার আলাদা দোকান থেকে দাম মিলিয়ে নাও।', 'সাজের জিনিস ভাড়া নাও, কিনো না।'],
      },
      en: {
        ideas: ['A home theme you decorate yourself, such as a storybook or a colour.', 'Two age-based game teams with small prizes.', 'A photo corner where guests are photographed on a phone and sent the pictures later.',
          'A book or a sapling as the return gift.', 'A 10-minute story or song slot before the cake.'],
        tips: ['Fix the guest count before placing the food order.', 'Compare cake and food prices from different shops.', 'Rent decoration items instead of buying.'],
      },
    },
    home_event: {
      bn: {
        ideas: ['অতিথির জন্য ছোট স্বাগত-টেবিল, নামের কার্ডসহ।', 'পরিবারের পুরনো ছবি দিয়ে একটি স্মৃতির দেয়াল।', 'খাবারের মেনুতে একটি বাড়ির রান্নার পদ, যাতে খরচ কমে আর স্বাদ বাড়ে।',
          'বাচ্চাদের জন্য আলাদা কোণ ও দেখাশোনার একজন।', 'বাইরের অতিথিদের জন্য যাতায়াতের একটি ছোট নির্দেশিকা।'],
        tips: ['ক্যাটারারের মেনু ও দাম লিখিত নাও।', 'কার্ড ছাপার আগে নাম-বানান আরেকজনকে দিয়ে মিলিয়ে নাও।', 'অনুষ্ঠানের আগের রাতে সব জিনিস গুনে রাখো।'],
      },
      en: {
        ideas: ['A small welcome table with name cards for guests.', 'A memory wall built from old family photographs.', 'One home-cooked dish on the menu to cut cost and add taste.',
          'A separate kids corner with one person looking after it.', 'A short travel guide for guests coming from outside.'],
        tips: ['Get the caterer menu and price in writing.', 'Have someone else check the spelling of names before printing cards.', 'Count every item the night before.'],
      },
    },
  };

  function inviteMessage(input, lang) {
    const date = formatDate(input.eventDate, lang);
    const count = localizeDigits(input.headcount, lang);
    const money = formatRupee(input.budget, lang);
    const name = pick(EVENT_TYPES[input.eventType], lang);
    const bn = {
      puja: `নমস্কার! আমাদের ${name} হবে ${date} তারিখে। প্রায় ${count} জনের আয়োজন, আনুমানিক খরচ ${money}। আপনার সাধ্যমতো চাঁদা দিয়ে পাশে থাকলে খুব খুশি হব। ধন্যবাদ।`,
      college_fest: `নমস্কার! আমরা ${date} তারিখে ${name} করছি, প্রায় ${count} জন অংশ নেবে। আপনার সহযোগিতা বা স্পনসরশিপ পেলে আমরা কৃতজ্ঞ থাকব। বিস্তারিত জানাতে আমরা দেখা করতে রাজি।`,
      birthday: `নমস্কার! ${date} তারিখে আমাদের ${name}। আপনি এলে খুব ভালো লাগবে। সময় ও জায়গা আমি আলাদা করে জানিয়ে দেব।`,
      home_event: `নমস্কার! ${date} তারিখে আমাদের বাড়িতে ${name}। আপনি সপরিবারে এলে খুব আনন্দ পাব। সময় ও জায়গা আলাদা করে জানাব।`,
    };
    const en = {
      puja: `Hello! Our ${name} is on ${date}. We are planning for about ${count} people at roughly ${money}. We would be glad if you could contribute what you comfortably can. Thank you.`,
      college_fest: `Hello! We are holding our ${name} on ${date} with about ${count} participants. Your support or sponsorship would mean a lot, and we would be happy to meet and share details.`,
      birthday: `Hello! We are celebrating a ${name} on ${date}. We would love to see you there. I will share the time and place separately.`,
      home_event: `Hello! We are holding a ${name} at home on ${date}. We would be delighted to have you and your family. I will share the time and place separately.`,
    };
    return (lang === 'bn' ? bn : en)[input.eventType];
  }

  function summaryLine(plan, lang) {
    const i = plan.input;
    const type = pick(EVENT_TYPES[i.eventType], lang);
    const n = (v) => localizeDigits(v, lang);
    return lang === 'bn'
      ? `${type}: ${n(i.headcount)} জন, বাজেট ${formatRupee(i.budget, 'bn')} (জনপ্রতি প্রায় ${formatRupee(plan.budget.perHead, 'bn')}), আর ${n(plan.daysLeft)} দিন বাকি।`
      : `${type}: ${i.headcount} guests, budget ${formatRupee(i.budget, 'en')} (about ${formatRupee(plan.budget.perHead, 'en')} each), ${plan.daysLeft} day(s) left.`;
  }

  /** Same shape as the AI answer (plus a code-built summary), from fixed templates. Used when the AI is unavailable. */
  function fallbackAssist(input, plan) {
    const set = FALLBACK[input.eventType][input.lang];
    const first = plan.tasks[0];
    const when = formatDate(first.due, input.lang);
    return {
      summary: summaryLine(plan, input.lang),
      focus: input.lang === 'bn'
        ? `সবার আগে: ${first.title.bn} (${when}-র মধ্যে)।`
        : `Do this first: ${first.title.en} (by ${when}).`,
      ideas: set.ideas.slice(),
      savingTips: set.tips.slice(),
      messageDraft: inviteMessage(input, input.lang),
    };
  }

  return {
    LIMITS, EVENT_TYPES, CATEGORIES, PRESETS, TEMPLATES, MIN_TOTAL_PER_HEAD,
    parseISODate, toISODate, addDays, daysBetween,
    pick, localizeDigits, formatRupee, formatDate,
    validateInput, allocateBudget, buildPlan, applyChange, comparePlans,
    summaryLine, fallbackAssist,
  };
});