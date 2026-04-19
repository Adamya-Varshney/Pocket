/**
 * Shared category icon registry — single source of truth for all sections.
 * Every icon has: a key (stored in DB), a Lucide component, and a display label.
 * Import getCategoryIcon(cat) anywhere to get the right component for a category.
 */
import {
  UtensilsCrossed, Plane, ShoppingBag, Home, Zap, TrendingUp,
  Clapperboard, HeartPulse, Car, GraduationCap, RefreshCw,
  Dumbbell, Coffee, Gift, Wifi, Fuel, Shirt, Briefcase, PiggyBank,
  Wrench, Music, BookOpen, Baby, Tag, Wallet, Bus, Train,
  Stethoscope, Pill, Landmark, Receipt, Phone, Tv, ShoppingCart,
  Bike, Globe, Scissors, Gem, Pizza, Beer
} from 'lucide-react';

// ── Icon registry: key → { Icon component, label } ──────────────────
export const ICON_REGISTRY = {
  food:          { Icon: UtensilsCrossed, label: 'Food & Dining' },
  grocery:       { Icon: ShoppingCart,    label: 'Groceries'     },
  travel:        { Icon: Plane,           label: 'Travel / Trips' },
  transport:     { Icon: Car,             label: 'Transport'     },
  bus:           { Icon: Bus,             label: 'Bus / Metro'   },
  train:         { Icon: Train,           label: 'Train'         },
  bike:          { Icon: Bike,            label: 'Bike'          },
  fuel:          { Icon: Fuel,            label: 'Fuel'          },
  shopping:      { Icon: ShoppingBag,     label: 'Shopping'      },
  rent:          { Icon: Home,            label: 'Rent / EMI'    },
  bills:         { Icon: Zap,             label: 'Bills'         },
  phone:         { Icon: Phone,           label: 'Phone / Recharge' },
  internet:      { Icon: Wifi,            label: 'Internet'      },
  subscription:  { Icon: RefreshCw,       label: 'Subscriptions' },
  streaming:     { Icon: Tv,              label: 'Streaming'     },
  salary:        { Icon: TrendingUp,      label: 'Salary'        },
  income:        { Icon: Wallet,          label: 'Income'        },
  investment:    { Icon: PiggyBank,       label: 'Investment'    },
  savings:       { Icon: Landmark,        label: 'Savings'       },
  entertainment: { Icon: Clapperboard,    label: 'Entertainment' },
  health:        { Icon: HeartPulse,      label: 'Health'        },
  medical:       { Icon: Stethoscope,     label: 'Medical'       },
  pharmacy:      { Icon: Pill,            label: 'Pharmacy'      },
  education:     { Icon: GraduationCap,   label: 'Education'     },
  books:         { Icon: BookOpen,        label: 'Books'         },
  fitness:       { Icon: Dumbbell,        label: 'Fitness / Gym' },
  coffee:        { Icon: Coffee,          label: 'Coffee / Café' },
  drinks:        { Icon: Beer,            label: 'Drinks'        },
  food_delivery: { Icon: Pizza,           label: 'Food Delivery' },
  gift:          { Icon: Gift,            label: 'Gifts'         },
  clothing:      { Icon: Shirt,           label: 'Clothing'      },
  beauty:        { Icon: Scissors,        label: 'Beauty / Salon'},
  jewelry:       { Icon: Gem,             label: 'Jewelry'       },
  kids:          { Icon: Baby,            label: 'Kids / Family' },
  work:          { Icon: Briefcase,       label: 'Work'          },
  freelance:     { Icon: Globe,           label: 'Freelance'     },
  music:         { Icon: Music,           label: 'Music'         },
  maintenance:   { Icon: Wrench,          label: 'Maintenance'   },
  tax:           { Icon: Receipt,         label: 'Tax / Govt'    },
  others:        { Icon: Tag,             label: 'Others'        },
};

// ── Name-to-key fallback map (for categories with no stored key) ─────
const NAME_FALLBACKS = {
  food: 'food', groceries: 'grocery', grocery: 'grocery',
  travel: 'travel', trip: 'travel', flight: 'travel',
  transport: 'transport', commute: 'transport', cab: 'transport', taxi: 'transport',
  bus: 'bus', metro: 'bus', train: 'train', bike: 'bike', fuel: 'fuel',
  shopping: 'shopping', rent: 'rent', housing: 'rent', emi: 'rent',
  bills: 'bills', electricity: 'bills', utilities: 'bills',
  phone: 'phone', mobile: 'phone', recharge: 'phone',
  internet: 'internet', wifi: 'internet', broadband: 'internet',
  subscription: 'subscription', streaming: 'streaming', netflix: 'streaming', ott: 'streaming',
  salary: 'salary', income: 'income', credit: 'income',
  investment: 'investment', savings: 'savings',
  entertainment: 'entertainment', movies: 'entertainment', party: 'entertainment',
  health: 'health', medical: 'medical', hospital: 'medical', doctor: 'medical',
  pharmacy: 'pharmacy', medicine: 'pharmacy',
  education: 'education', tuition: 'education', school: 'education', course: 'education',
  books: 'books', fitness: 'fitness', gym: 'fitness', workout: 'fitness',
  coffee: 'coffee', cafe: 'coffee', tea: 'coffee',
  drinks: 'drinks', beer: 'drinks', alcohol: 'drinks',
  food_delivery: 'food_delivery', zomato: 'food_delivery', swiggy: 'food_delivery',
  gift: 'gift', gifts: 'gift', clothing: 'clothing', fashion: 'clothing', clothes: 'clothing',
  beauty: 'beauty', salon: 'beauty', grooming: 'beauty',
  jewelry: 'jewelry', jewellery: 'jewelry',
  kids: 'kids', family: 'kids', baby: 'kids', children: 'kids',
  work: 'work', office: 'work', freelance: 'freelance',
  music: 'music', maintenance: 'maintenance', repair: 'maintenance',
  tax: 'tax', government: 'tax', others: 'others', other: 'others', misc: 'others', miscellaneous: 'others'
};

/**
 * Returns the Lucide icon component for a category.
 * @param {object} cat - Category object with { name, icon } where icon is an optional registry key
 * @returns {React.ComponentType} - Lucide icon component, defaults to Tag
 */
export const getCategoryIcon = (cat) => {
  if (!cat) return Tag;

  // If cat is just a string (category name), wrap it
  const catObj = typeof cat === 'string' ? { name: cat, icon: null } : cat;

  // 1. Check stored icon key against registry
  const storedKey = catObj.icon?.toLowerCase().trim();
  if (storedKey && ICON_REGISTRY[storedKey]) {
    return ICON_REGISTRY[storedKey].Icon;
  }

  // 2. Fall back to name-based lookup
  const nameLower = (catObj.name || '').toLowerCase().trim();
  const nameKey = NAME_FALLBACKS[nameLower];
  if (nameKey && ICON_REGISTRY[nameKey]) {
    return ICON_REGISTRY[nameKey].Icon;
  }

  // 3. Partial match on name
  const partialKey = Object.keys(NAME_FALLBACKS).find(k =>
    nameLower.startsWith(k) || k.startsWith(nameLower)
  );
  if (partialKey && ICON_REGISTRY[NAME_FALLBACKS[partialKey]]) {
    return ICON_REGISTRY[NAME_FALLBACKS[partialKey]].Icon;
  }

  return Tag; // Ultimate fallback
};
