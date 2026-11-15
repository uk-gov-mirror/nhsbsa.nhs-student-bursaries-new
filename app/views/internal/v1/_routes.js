// ********************************
// internal v1
// ********************************

// External dependencies
const express = require('express');
// const moment = require('moment');
const router = express.Router();

//requestForm

router.post('/dsa/requestForm', (req, res) => {

  req.session.data['needs'] = 'email';

  res.redirect('/internal/v1/student-details');

});


// ********************************
// DSA allowances (phase 1)
// ********************************

const base = '/internal/v1/dsa';

const typeLabels = {
  general: 'General allowance',
  nmh: 'Non-medical helper',
  equipment: 'Specialist equipment',
  travel: 'Travel allowance',
  fee: 'Needs assessment fee'
};

// Every form field used while adding one allowance
const FIELDS = [
  'allowance-type',
  'allowance-amount', 'allowance-notes',
  'nmh-service', 'nmh-provider', 'nmh-hours', 'nmh-amount', 'nmh-notes',
  'travel-amount', 'travel-journeys', 'travel-notes'
];

// Turn "1,200" or "£1200.5" into 1200.5
function num (value) {
  const n = parseFloat(String(value || '').replace(/[£,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Turn 1200.5 into "£1,200.50"
function money (value) {
  return '£' + num(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clearFields (data) {
  FIELDS.forEach(f => { delete data[f]; });
  delete data['allowance-error-list'];
  delete data['allowance-errors'];
}

// Build one allowance from the answers on the current pages
function currentAllowance (data) {
  const type = data['allowance-type'];
  const item = { type: type, label: typeLabels[type] || '' };

  if (type === 'nmh') {
    item.amount = num(data['nmh-amount']);
    item.hours = data['nmh-hours'];
    item.service = data['nmh-service'];
    item.provider = data['nmh-provider'];
    item.notes = data['nmh-notes'];
    item.details = [data['nmh-service'], data['nmh-provider']].filter(Boolean).join(', ');
  } else if (type === 'travel') {
    item.amount = num(data['travel-amount']);
    item.journeys = data['travel-journeys'];
    item.notes = data['travel-notes'];
    item.details = data['travel-notes'];
  } else {
    item.amount = num(data['allowance-amount']);
    item.notes = data['allowance-notes'];
    item.details = data['allowance-notes'];
  }

  item.amountDisplay = money(item.amount);

  if (type === 'nmh' && num(item.hours) > 0) {
    item.rate = money(item.amount / num(item.hours));
  }

  return item;
}

function listAndTotal (data) {
  const list = data['allowances'] || [];
  const total = money(list.reduce((sum, i) => sum + num(i.amount), 0));
  return { list: list, total: total };
}

// DSA summary: one decision question, routed by the answer
router.post('/dsa/summary', (req, res) => {
  const decision = req.session.data['dsa-decision'];

  if (!decision) {
    req.session.data['dsa-decision-error'] = 'true';
    return res.redirect(base + '/summary');
  }
  delete req.session.data['dsa-decision-error'];

  if (decision === 'approve') {
    return res.redirect(base + '/add-allowances');
  }
  if (decision === 'needs') {
    return res.redirect(base + '/requestForm?dsa=needs');
  }
  if (decision === 'evidence') {
    return res.redirect(base + '/requestForm?dsa=evidence');
  }
  if (decision === 'reject') {
    return res.redirect(base + '/requestForm?dsa=reject');
  }
  res.redirect(base + '/summary');
});

// Approve on the DSA summary: start adding allowances
router.get('/dsa/add-allowances', (req, res) => {
  clearFields(req.session.data);
  delete req.session.data['allowance-error-list'];
  delete req.session.data['allowance-errors'];
  delete req.session.data['edit-index'];
  res.render('internal/v1/dsa/add-allowances');
});

// What type of allowance is this? -> next page depends on the answer
router.post('/dsa/allowance-type', (req, res) => {
  const type = req.session.data['allowance-type'];
  delete req.session.data['allowance-error-list'];
  delete req.session.data['allowance-errors'];

  if (!type) {
    return res.redirect(base + '/allowance-type');
  }
  if (type === 'nmh') {
    return res.redirect(base + '/nmh-details');
  }
  if (type === 'travel') {
    return res.redirect(base + '/travel-details');
  }
  res.redirect(base + '/allowance-amount');
});

// Check the answers on an allowance page. Returns a list of errors (empty if all fine).
function allowanceErrors (data, page) {
  const errors = [];
  if (page === 'amount') {
    if (num(data['allowance-amount']) <= 0) {
      errors.push({ field: 'allowance-amount', text: 'Enter an amount more than £0' });
    }
  }
  if (page === 'nmh') {
    if (!String(data['nmh-service'] || '').trim()) {
      errors.push({ field: 'nmh-service', text: 'Enter the service' });
    }
    if (num(data['nmh-hours']) <= 0) {
      errors.push({ field: 'nmh-hours', text: 'Enter the approved hours' });
    }
    if (num(data['nmh-amount']) <= 0) {
      errors.push({ field: 'nmh-amount', text: 'Enter an amount more than £0' });
    }
  }
  if (page === 'travel') {
    if (num(data['travel-amount']) <= 0) {
      errors.push({ field: 'travel-amount', text: 'Enter an amount more than £0' });
    }
    if (num(data['travel-journeys']) <= 0) {
      errors.push({ field: 'travel-journeys', text: 'Enter the approved number of journeys' });
    }
  }
  return errors;
}

// Store the errors so the page can show them: a list for the error summary,
// and one message per field for the inline errors
function checkAllowancePage (req, res, page, path) {
  const data = req.session.data;
  const errors = allowanceErrors(data, page);

  if (errors.length) {
    data['allowance-error-list'] = errors;
    data['allowance-errors'] = {};
    errors.forEach(e => { data['allowance-errors'][e.field] = e.text; });
    return res.redirect(base + path);
  }
  delete data['allowance-error-list'];
  delete data['allowance-errors'];
  res.redirect(base + '/check-allowance');
}

// Amount, NMH details and travel details all go to the check page
router.post('/dsa/allowance-amount', (req, res) => {
  checkAllowancePage(req, res, 'amount', '/allowance-amount');
});

router.post('/dsa/nmh-details', (req, res) => {
  checkAllowancePage(req, res, 'nmh', '/nmh-details');
});

router.post('/dsa/travel-details', (req, res) => {
  checkAllowancePage(req, res, 'travel', '/travel-details');
});

// Check allowance details
router.get('/dsa/check-allowance', (req, res) => {
  const item = currentAllowance(req.session.data);
  res.render('internal/v1/dsa/check-allowance', { item: item });
});

// Save the allowance into the list (or replace it, if it was changed from the list)
router.post('/dsa/check-allowance', (req, res) => {
  const data = req.session.data;
  data['allowances'] = data['allowances'] || [];

  const item = currentAllowance(data);
  item.fields = {};
  FIELDS.forEach(f => { item.fields[f] = data[f]; });

  if (data['edit-index'] !== undefined && data['edit-index'] !== '') {
    data['allowances'][parseInt(data['edit-index'], 10)] = item;
    delete data['edit-index'];
  } else {
    data['allowances'].push(item);
  }

  clearFields(data);
  delete data['add-another'];
  res.redirect(base + '/allowances');
});

// DSA allowances list
router.get('/dsa/allowances', (req, res) => {
  const { list, total } = listAndTotal(req.session.data);

  if (list.length === 0) {
    return res.redirect(base + '/add-allowances');
  }
  res.render('internal/v1/dsa/allowances', { list: list, total: total });
});

// Do you want to add another allowance?
router.post('/dsa/allowances', (req, res) => {
  const answer = req.session.data['add-another'];

  if (answer === 'yes') {
    clearFields(req.session.data);
    delete req.session.data['add-another'];
    return res.redirect(base + '/allowance-type');
  }
  if (answer === 'no') {
    delete req.session.data['add-another'];
    return res.redirect(base + '/check-dsa-allowances');
  }
  res.redirect(base + '/allowances');
});

// Change an allowance from the list
router.get('/dsa/change-allowance/:index', (req, res) => {
  const data = req.session.data;
  const item = (data['allowances'] || [])[req.params.index];

  if (!item) {
    return res.redirect(base + '/allowances');
  }
  FIELDS.forEach(f => { data[f] = item.fields[f]; });
  data['edit-index'] = req.params.index;
  res.redirect(base + '/check-allowance');
});

// Remove an allowance: show the warning page first
router.get('/dsa/remove-allowance/:index', (req, res) => {
  const list = req.session.data['allowances'] || [];
  const index = parseInt(req.params.index, 10);
  const item = list[index];

  if (!item) {
    return res.redirect(base + '/allowances');
  }
  res.render('internal/v1/dsa/remove-allowance', { item: item, index: index });
});

// Remove an allowance: only remove it after the processor confirms
router.post('/dsa/remove-allowance/:index', (req, res) => {
  const list = req.session.data['allowances'] || [];
  const index = parseInt(req.params.index, 10);

  if (list[index]) {
    list.splice(index, 1);
  }
  res.redirect(base + '/allowances');
});

// Check DSA allowances (all of them)
router.get('/dsa/check-dsa-allowances', (req, res) => {
  const { list, total } = listAndTotal(req.session.data);
  res.render('internal/v1/dsa/check-dsa-allowances', { list: list, total: total });
});

router.post('/dsa/check-dsa-allowances', (req, res) => {
  req.session.data['dsa-allowances-saved'] = 'yes';
  res.redirect(base + '/allowances-set-up');
});

// DSA allowances set up
router.get('/dsa/allowances-set-up', (req, res) => {
  const { list, total } = listAndTotal(req.session.data);
  res.render('internal/v1/dsa/allowances-set-up', { list: list, total: total });
});

// ********************************
// DSA payments (phase 1)
// Two ways in:
//   1. Receipt uploaded by the student (Activities tab) - paid to the student
//   2. Invoice emailed by a provider (DSA allowances tab) - paid to the provider through Integra
// Both use the same screens and take the payment off the allowance.
// ********************************

const paymentTypes = {
  general: 'DSA (general)',
  equipment: 'DSA (equipment)',
  nmh: 'DSA (non-medical)',
  travel: 'DSA (travel)',
  fee: 'DSA (non-medical)'
};

const PAY_FIELDS = [
  'pay-allowance', 'pay-invoice', 'pay-amount', 'pay-for',
  'pay-from', 'pay-date-day', 'pay-date-month', 'pay-date-year', 'pay-integra',
  'pay-hours', 'pay-journeys', 'pay-missed'
];

const MISSED_SESSION_LIMIT = 2;
const STUDENT_NAME = 'John Mark';
const STUDENT_BANK = "John Mark's bank account, account ending 0003";

function clearPayFields (data) {
  PAY_FIELDS.forEach(f => { delete data[f]; });
  delete data['pay-error-list'];
  delete data['pay-errors'];
}

// Show whole numbers without decimals: 1 -> "1", 1.5 -> "1.5"
function units (value) {
  return String(Math.round(num(value) * 100) / 100);
}

function formatDate (d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Same format as the live Notes tab, for example 09/11/2026 10:05:12
function noteTimestamp (d) {
  const pad = n => String(n).padStart(2, '0');
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

// Terms used for the missed session limit
function termName (d) {
  const m = d.getMonth();
  if (m >= 8) { return 'September to December'; }
  if (m <= 3) { return 'January to April'; }
  return 'May to August';
}

function addNote (data, title, text) {
  data['dsa-notes'] = data['dsa-notes'] || [];
  data['dsa-notes'].unshift({ title: title, text: text, by: 'Michael Lee' });
}

// Work out what has been used and what is left on each allowance
function allowanceBalances (data) {
  const list = data['allowances'] || [];
  const payments = data['dsa-payments'] || [];
  const term = termName(new Date());

  return list.map((item, index) => {
    const paid = payments.filter(p => p.index === index);
    const used = paid.reduce((sum, p) => sum + num(p.amount), 0);
    const hoursUsed = paid.reduce((sum, p) => sum + num(p.hours), 0);
    const journeysUsed = paid.reduce((sum, p) => sum + num(p.journeys), 0);
    const left = num(item.amount) - used;
    const row = {
      index: index,
      type: item.type,
      label: item.label,
      details: item.details,
      name: item.label + (item.details ? ': ' + item.details : ''),
      paymentType: paymentTypes[item.type] || 'DSA',
      amount: num(item.amount),
      amountDisplay: money(item.amount),
      used: used,
      usedDisplay: money(used),
      left: left,
      leftDisplay: money(left),
      payments: paid,
      provider: item.provider
    };

    if (num(item.hours) > 0) {
      row.hours = num(item.hours);
      row.hoursLeft = num(item.hours) - hoursUsed;
      row.rate = num(item.amount) / num(item.hours);
      row.rateDisplay = money(row.rate);
      row.unitsLeft = units(row.hoursLeft) + ' of ' + units(row.hours) + ' hours';
      row.missedThisTerm = paid.filter(p => p.missed === 'yes' && p.term === term).length;
    } else if (num(item.journeys) > 0) {
      row.journeys = num(item.journeys);
      row.journeysLeft = num(item.journeys) - journeysUsed;
      row.unitsLeft = units(row.journeysLeft) + ' of ' + units(row.journeys) + ' journeys';
    } else {
      row.unitsLeft = 'Not applicable';
    }

    row.leftSummary = row.leftDisplay +
      (row.hours ? ' and ' + units(row.hoursLeft) + ' hours' : '') +
      (row.journeys ? ' and ' + units(row.journeysLeft) + ' journeys' : '');

    return row;
  });
}

function dsaTotals (rows) {
  return {
    approved: money(rows.reduce((s, r) => s + r.amount, 0)),
    used: money(rows.reduce((s, r) => s + r.used, 0)),
    left: money(rows.reduce((s, r) => s + r.left, 0))
  };
}

function selectedAllowance (data) {
  const rows = allowanceBalances(data);
  const i = parseInt(data['pay-allowance'], 10);
  return isNaN(i) ? null : rows[i];
}

// The payment being added, built from the answers so far
function currentPayment (data) {
  const a = selectedAllowance(data);
  if (!a) { return null; }

  const source = data['pay-source'] === 'email' ? 'email' : 'receipt';
  const p = {
    index: a.index,
    allowanceName: a.name,
    paymentType: a.paymentType,
    source: source,
    sourceText: source === 'email' ? 'Invoice sent by email' : 'Uploaded by the student (activity 375)',
    invoice: String(data['pay-invoice'] || '').trim(),
    whatFor: String(data['pay-for'] || '').trim(),
    term: termName(new Date())
  };

  if (a.hours) {
    p.hours = num(data['pay-hours']);
    p.unitsText = units(p.hours) + (p.hours === 1 ? ' hour' : ' hours');
    p.missed = data['pay-missed'];
    p.amount = Math.round(p.hours * a.rate * 100) / 100;
    p.amountText = money(p.amount) + ' (' + p.unitsText + ' × ' + a.rateDisplay + ')';
  } else {
    p.amount = num(data['pay-amount']);
    p.amountText = money(p.amount);
    if (a.journeys) {
      p.journeys = num(data['pay-journeys']);
      p.unitsText = units(p.journeys) + (p.journeys === 1 ? ' journey' : ' journeys');
    }
  }
  p.amountDisplay = money(p.amount);

  if (source === 'email') {
    p.from = String(data['pay-from'] || '').trim();
    p.integra = String(data['pay-integra'] || '').trim();
    const d = new Date(num(data['pay-date-year']), num(data['pay-date-month']) - 1, num(data['pay-date-day']));
    p.receivedDate = formatDate(d);
    p.paidTo = p.from + ', paid through Integra in the weekly payment run';
    p.paidToShort = p.from + ' (Integra ' + p.integra + ')';
  } else {
    p.paidTo = STUDENT_BANK + ', in the next payment run';
    p.paidToShort = STUDENT_NAME + ' (student)';
  }

  return p;
}

function paymentErrors (data) {
  const errors = [];
  const a = selectedAllowance(data);
  const add = (field, text) => errors.push({ field: field, text: text });
  if (!a) { return errors; }

  if (data['pay-source'] === 'email') {
    if (!String(data['pay-from'] || '').trim()) {
      add('pay-from', 'Enter who sent the invoice');
    }
    const day = num(data['pay-date-day']);
    const month = num(data['pay-date-month']);
    const year = num(data['pay-date-year']);
    const d = new Date(year, month - 1, day);
    if (!day || !month || !year || d.getDate() !== day || d.getMonth() !== month - 1) {
      add('pay-date-day', 'Enter the date the invoice was received, for example 2 11 2026');
    } else if (d > new Date()) {
      add('pay-date-day', 'The date the invoice was received must be today or in the past');
    }
  }

  if (!String(data['pay-invoice'] || '').trim()) {
    add('pay-invoice', data['pay-source'] === 'email' ? 'Enter the invoice number' : 'Enter the invoice or receipt number');
  }

  if (data['pay-source'] === 'email' && !String(data['pay-integra'] || '').trim()) {
    add('pay-integra', 'Enter the Integra supplier reference');
  }

  if (a.hours) {
    const hours = num(data['pay-hours']);
    if (hours <= 0) {
      add('pay-hours', 'Enter the number of hours, for example 1 or 1.5');
    } else if (hours > a.hoursLeft) {
      add('pay-hours', 'Hours must be ' + units(a.hoursLeft) + ' or less, which is what is left');
    } else if (hours * a.rate > a.left + 0.001) {
      add('pay-hours', 'This would cost more than the ' + a.leftDisplay + ' left in this allowance');
    }
    if (!data['pay-missed']) {
      add('pay-missed-yes', 'Select yes if this is for a missed session');
    } else if (data['pay-missed'] === 'yes' && a.missedThisTerm >= MISSED_SESSION_LIMIT) {
      add('pay-missed-yes', 'This provider has already been paid for ' + MISSED_SESSION_LIMIT + ' missed sessions this term');
    }
  } else {
    const amount = num(data['pay-amount']);
    if (amount <= 0) {
      add('pay-amount', 'Enter an amount more than £0');
    } else if (amount > a.left + 0.001) {
      add('pay-amount', 'Amount must be ' + a.leftDisplay + ' or less, which is what is left');
    }
    if (a.journeys) {
      const journeys = num(data['pay-journeys']);
      if (journeys <= 0) {
        add('pay-journeys', 'Enter the number of journeys taken');
      } else if (journeys > a.journeysLeft) {
        add('pay-journeys', 'Journeys must be ' + units(a.journeysLeft) + ' or less, which is what is left');
      }
    }
  }

  if (!String(data['pay-for'] || '').trim()) {
    add('pay-for', 'Enter what the payment is for');
  }

  return errors;
}

// Student record: work out the DSA balances for the DSA allowances tab
router.get('/student-details', (req, res) => {
  const rows = allowanceBalances(req.session.data);
  res.render('internal/v1/student-details', { dsaRows: rows, dsaTotals: dsaTotals(rows) });
});

// ---------- Way 1: receipt uploaded by the student ----------

// DSA receipts activity: check the receipt and decide
router.get('/dsa/receipts', (req, res) => {
  res.render('internal/v1/dsa/receipts');
});

router.post('/dsa/receipts', (req, res) => {
  const data = req.session.data;
  const decision = data['receipt-decision'];

  if (!decision) {
    data['receipt-decision-error'] = 'true';
    return res.redirect(base + '/receipts');
  }
  delete data['receipt-decision-error'];

  if (decision === 'accept') {
    clearPayFields(data);
    data['pay-source'] = 'receipt';
    // Filled in from what the student entered when they uploaded the receipt
    data['pay-amount'] = '25.00';
    data['pay-for'] = 'Ink cartridge for printer';
    return res.redirect(base + '/payment-allowance');
  }
  res.redirect(base + '/receipt-email?type=' + decision);
});

// Ask for more information or reject: email the student
router.post('/dsa/receipt-email', (req, res) => {
  const data = req.session.data;
  const type = data['type'] === 'reject' ? 'reject' : 'more-info';
  const now = noteTimestamp(new Date());

  if (type === 'reject') {
    addNote(data, "Email notification of Disabled Students' Allowance receipt rejected sent on " + now, data['receipt-message'] || 'No message entered.');
    data['dsa-receipt'] = 'closed';
  } else {
    addNote(data, "Email notification of Disabled Students' Allowance receipt further information request sent on " + now, data['receipt-message'] || 'No message entered.');
  }

  delete data['receipt-message'];
  delete data['receipt-decision'];
  res.redirect('/internal/v1/student-details#tab-2');
});

// ---------- Way 2: invoice emailed by a provider ----------

router.get('/dsa/payment-email', (req, res) => {
  clearPayFields(req.session.data);
  req.session.data['pay-source'] = 'email';
  res.redirect(base + '/payment-allowance');
});

// ---------- Screens used by both ways ----------

// Which allowance is this payment for?
router.get('/dsa/payment-allowance', (req, res) => {
    const rows = allowanceBalances(req.session.data);
  // CHANGE (15 November 2026): if there are no allowances, show a page that explains
  // what to do, instead of sending the processor back to the DSA tab with no message.
  // OLD LINE: return res.redirect('/internal/v1/student-details#tab-dsa');
  if (rows.length === 0) {
    return res.redirect(base + '/payment-no-allowance');
  }
  res.render('internal/v1/dsa/payment-allowance', { rows: rows });
});

router.post('/dsa/payment-allowance', (req, res) => {
  const data = req.session.data;
  if (!selectedAllowance(data)) {
    data['pay-error-list'] = [{ field: 'pay-allowance-0', text: 'Select which allowance this payment is for' }];
    data['pay-errors'] = { 'pay-allowance': 'Select which allowance this payment is for' };
    return res.redirect(base + '/payment-allowance');
  }
  delete data['pay-error-list'];
  delete data['pay-errors'];
  res.redirect(base + '/payment-details');
});

// Payment details
router.get('/dsa/payment-details', (req, res) => {
  const a = selectedAllowance(req.session.data);
  if (!a) {
    return res.redirect(base + '/payment-allowance');
  }
  res.render('internal/v1/dsa/payment-details', { a: a, term: termName(new Date()), limit: MISSED_SESSION_LIMIT });
});

router.post('/dsa/payment-details', (req, res) => {
  const data = req.session.data;
  const errors = paymentErrors(data);

  if (errors.length) {
    data['pay-error-list'] = errors;
    data['pay-errors'] = {};
    errors.forEach(e => {
      data['pay-errors'][e.field.replace('-day', '').replace('-yes', '')] = e.text;
    });
    return res.redirect(base + '/payment-details');
  }
  delete data['pay-error-list'];
  delete data['pay-errors'];
  res.redirect(base + '/payment-check');
});

// Check the payment details
router.get('/dsa/payment-check', (req, res) => {
  const data = req.session.data;
  const a = selectedAllowance(data);
  const p = currentPayment(data);
  if (!a || !p) {
    return res.redirect(base + '/payment-allowance');
  }
  const after = { left: money(a.left - p.amount) };
  if (a.hours) {
    Object.assign(after, { unitsLabel: 'Hours left', unitsBefore: units(a.hoursLeft), unitsThis: units(p.hours), unitsAfter: units(a.hoursLeft - p.hours) });
  } else if (a.journeys) {
    Object.assign(after, { unitsLabel: 'Journeys left', unitsBefore: units(a.journeysLeft), unitsThis: units(p.journeys), unitsAfter: units(a.journeysLeft - p.journeys) });
  }
  res.render('internal/v1/dsa/payment-check', { a: a, p: p, after: after, limit: MISSED_SESSION_LIMIT });
});

// Add the payment: it comes off the allowance straight away
router.post('/dsa/payment-check', (req, res) => {
  const data = req.session.data;
  const p = currentPayment(data);
  if (!p || paymentErrors(data).length) {
    return res.redirect(base + '/payment-details');
  }

  const now = new Date();
  p.date = formatDate(now);
  data['dsa-payments'] = data['dsa-payments'] || [];
  data['dsa-payments'].push(p);

  const parts = [p.paymentType + ' ' + p.amountDisplay + '.', p.allowanceName + '.', 'Invoice ' + p.invoice + '.', p.whatFor + '.'];
  if (p.unitsText) { parts.push(p.unitsText + (p.missed === 'yes' ? ', missed session.' : '.')); }
  parts.push(p.source === 'email' ? 'Paid to ' + p.from + ' through Integra (' + p.integra + ').' : 'Paid to the student.');
  addNote(data, "Disabled Students' Allowance payment added on " + noteTimestamp(now), parts.join(' '));

  if (p.source === 'receipt') {
    data['dsa-receipt'] = 'closed';
  }

  data['last-payment'] = p;
  clearPayFields(data);
  delete data['receipt-decision'];
  res.redirect(base + '/payment-added');
});

// Payment added
router.get('/dsa/payment-added', (req, res) => {
  const data = req.session.data;
  const p = data['last-payment'];
  if (!p) {
    return res.redirect('/internal/v1/student-details#tab-dsa');
  }
  const a = allowanceBalances(data)[p.index];
  res.render('internal/v1/dsa/payment-added', { p: p, a: a });
});

// View payments for one allowance
router.get('/dsa/payment-history/:index', (req, res) => {
  const a = allowanceBalances(req.session.data)[parseInt(req.params.index, 10)];
  if (!a) {
    return res.redirect('/internal/v1/student-details#tab-dsa');
  }
  // Work out the balance after each payment
  let left = a.amount;
  let unitsLeft = a.hours || a.journeys || 0;
  const history = a.payments.map(p => {
    left = left - num(p.amount);
    unitsLeft = unitsLeft - num(p.hours || p.journeys);
    return Object.assign({}, p, {
      balanceAfter: money(left),
      unitsAfter: (a.hours || a.journeys) ? units(unitsLeft) : 'Not applicable'
    });
  });
  res.render('internal/v1/dsa/payment-history', { a: a, history: history, term: termName(new Date()), limit: MISSED_SESSION_LIMIT });
});

module.exports = router;