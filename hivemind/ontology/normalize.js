// Normalisation used for duplicate detection. Pure functions, no I/O.

const ORG_SUFFIXES = [
  'private limited', 'pvt ltd', 'pvt. ltd.', 'pvt. ltd', 'pvt ltd.', 'p ltd', 'limited', 'ltd', 'ltd.',
  'llp', 'inc', 'inc.', 'llc', 'co', 'co.', 'company', 'corporation', 'corp', 'corp.', 'gmbh', 'plc',
];

/** "Ankur Carbons Pvt. Ltd." → "ankur carbons" */
export function orgKey(name = '') {
  let s = String(name).toLowerCase().replace(/&/g, ' and ').replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of ORG_SUFFIXES) {
      if (s.endsWith(' ' + suf)) { s = s.slice(0, -(suf.length + 1)).trim(); changed = true; }
    }
  }
  return s.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export function emailKey(email = '') {
  return String(email).trim().toLowerCase();
}

/** Indian numbers to +91XXXXXXXXXX; anything else to digits with a leading + when given. */
export function phoneKey(phone = '') {
  const raw = String(phone).trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1);
  return (raw.startsWith('+') ? '+' : '') + digits;
}

export function personNameKey(name = '') {
  return String(name).toLowerCase().replace(/^(mr|mrs|ms|dr|shri|smt)\.?\s+/, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Candidate duplicates for a person among existing people.
 * Strong match: same email or same phone. Weak match: same name, or one name is the
 * other plus a surname ("Ramesh" vs "Ramesh Das"), which a human must confirm.
 */
export function findPersonDuplicates(candidate, people) {
  const e = emailKey(candidate.email), p = phoneKey(candidate.phone), n = personNameKey(candidate.name);
  const out = [];
  for (const other of people) {
    if (other.id === candidate.id) continue;
    if (e && emailKey(other.email) === e) { out.push({ person: other, strength: 'strong', reason: 'same email' }); continue; }
    if (p && phoneKey(other.phone) === p) { out.push({ person: other, strength: 'strong', reason: 'same phone' }); continue; }
    const on = personNameKey(other.name);
    if (!n || !on) continue;
    if (on === n) out.push({ person: other, strength: 'weak', reason: 'same name' });
    else if (on.startsWith(n + ' ') || n.startsWith(on + ' ')) out.push({ person: other, strength: 'weak', reason: 'name is a prefix' });
  }
  return out;
}

export function findOrgDuplicates(candidate, orgs) {
  const k = orgKey(candidate.name);
  if (!k) return [];
  return orgs.filter(o => o.id !== candidate.id && (o.name_key || orgKey(o.name)) === k);
}
