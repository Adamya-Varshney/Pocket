// ─── MERCHANT AUTO-NORMALIZER RULES ───────────────────────────────────────────
// Translates raw bank description strings into clean merchant names
export const MERCHANT_RULES = [
  [/amzn|amazon/i,          'Amazon'],
  [/zomato/i,               'Zomato'],
  [/swiggy/i,               'Swiggy'],
  [/uber(?!.*eats)/i,       'Uber'],
  [/ola\s*(?:cab|ride|money)?/i, 'Ola'],
  [/netflix/i,              'Netflix'],
  [/spotify/i,              'Spotify'],
  [/youtube|yt\s*premium/i, 'YouTube Premium'],
  [/hotstar|disney/i,       'Disney+ Hotstar'],
  [/prime\s*video|primevideo/i, 'Amazon Prime Video'],
  [/jio/i,                  'Jio'],
  [/airtel/i,               'Airtel'],
  [/bsnl/i,                 'BSNL'],
  [/vi\b|vodafone/i,        'Vi / Vodafone'],
  [/google\s*pay|gpay/i,    'Google Pay'],
  [/phonepe/i,              'PhonePe'],
  [/paytm/i,                'Paytm'],
  [/nykaa/i,                'Nykaa'],
  [/flipkart/i,             'Flipkart'],
  [/myntra/i,               'Myntra'],
  [/bigbasket/i,            'BigBasket'],
  [/grofers|blinkit/i,      'Blinkit'],
  [/instamart|swiggy\s*instamart/i, 'Instamart'],
  [/dunzo/i,                'Dunzo'],
  [/zepto/i,                'Zepto'],
  [/rapido/i,               'Rapido'],
  [/irctc/i,                'IRCTC'],
  [/redbus/i,               'RedBus'],
  [/makemytrip|mmt/i,       'MakeMyTrip'],
  [/goibibo/i,              'Goibibo'],
  [/bookmyshow/i,           'BookMyShow'],
  [/hdfc/i,                 'HDFC Bank'],
  [/icici/i,                'ICICI Bank'],
  [/sbi\s*mbs|sbimb/i,      'SBI'],
  [/axis\s*bank/i,          'Axis Bank'],
  [/kotak/i,                'Kotak Bank'],
  [/indusind/i,             'IndusInd Bank'],
  [/neft|rtgs|imps/i,       null],
];

// Auto-suggest category key based on normalized merchant name
export const MERCHANT_CATEGORY_MAP = {
  'amazon':             'shopping',
  'flipkart':           'shopping',
  'myntra':             'shopping',
  'nykaa':              'beauty',
  'zomato':             'food',
  'swiggy':             'food',
  'instamart':          'grocery',
  'blinkit':            'grocery',
  'bigbasket':          'grocery',
  'zepto':              'grocery',
  'dunzo':              'grocery',
  'uber':               'transport',
  'ola':                'transport',
  'rapido':             'transport',
  'irctc':              'train',
  'redbus':             'bus',
  'makemytrip':         'travel',
  'goibibo':            'travel',
  'bookmyshow':         'entertainment',
  'netflix':            'subscription',
  'spotify':            'subscription',
  'youtube premium':    'subscription',
  'disney+ hotstar':    'subscription',
  'amazon prime video': 'subscription',
  'jio':                'phone',
  'airtel':             'phone',
  'vi / vodafone':      'phone',
  'bsnl':               'phone',
};

// Hierarchy: User Overrides > Built-in Rules > Raw Cleanup
export const normalizeMerchant = (raw = '', userOverrides = {}) => {
  if (!raw) return '';
  // 1. Apply user-defined overrides first
  if (userOverrides[raw]) return userOverrides[raw];
  
  const rawLower = raw.toLowerCase();
  for (const [original, custom] of Object.entries(userOverrides)) {
    if (rawLower.includes(original.toLowerCase())) return custom;
  }

  // 2. Apply built-in merchant rules
  for (const [pattern, name] of MERCHANT_RULES) {
    if (pattern.test(raw)) return name || raw;
  }

  // 3. Clean up bank noise (UPI ref codes, long alphanumeric blobs)
  return raw
    .replace(/\b[A-Z0-9]{8,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || raw;
};

// Suggest a category object from the list based on merchant name
export const suggestCategory = (merchantName = '', categories = []) => {
  if (!merchantName || !categories?.length) return null;
  const lower = merchantName.toLowerCase();
  const categoryKey = MERCHANT_CATEGORY_MAP[lower];
  
  if (!categoryKey) return null;

  // Find the actual category object using fuzzy matching
  const k = categoryKey.toLowerCase();
  // Strategy 1: name starts with key
  let found = categories.find(c => c.name.toLowerCase().startsWith(k));
  if (found) return found;
  // Strategy 2: name contains key
  found = categories.find(c => c.name.toLowerCase().includes(k));
  if (found) return found;
  // Strategy 3: icon field exact match (legacy fallback)
  found = categories.find(c => c.icon?.toLowerCase() === k);
  
  return found || null;
};

// ── Deterministic row fingerprint ─────────────────────────────────────────────
// Normalizes both statement rows (debit/credit) and ledger txns (amount/type)
// into a single canonical signature for deduplication.
export const generateFingerprint = (userId, txnDate, description, debitOrAmount, creditOrType = 0) => {
  let debit = 0;
  let credit = 0;

  if (typeof creditOrType === 'string') {
    // We are passing (amount, type) from the transactions table
    const amount = Number(debitOrAmount) || 0;
    if (creditOrType === 'expense') debit = amount;
    else credit = amount;
  } else {
    // We are passing (debit, credit) from a statement row
    debit  = Number(debitOrAmount) || 0;
    credit = Number(creditOrType) || 0;
  }

  const raw = `${userId}|${txnDate}|${description?.trim().toLowerCase()}|${debit}|${credit}`;
  
  // Simple deterministic hash: FNV-1a style
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; 
  }
  return hash.toString(36);
};
