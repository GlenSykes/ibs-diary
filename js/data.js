// The app's fixed vocabulary: food categories, tags, rating scales.
// Changing a key here breaks existing data; changing a label is safe.

export const CATEGORIES = [
  { key: 'grains', label: 'Bread, cereals & grains' },
  { key: 'dairy', label: 'Dairy, eggs & milk drinks' },
  { key: 'protein', label: 'Meat, fish & protein' },
  { key: 'veg', label: 'Vegetables' },
  { key: 'fruit', label: 'Fruit' },
  { key: 'legumes', label: 'Beans, nuts & seeds' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'snacks', label: 'Sweets & snacks' },
  { key: 'sauces', label: 'Sauces, oils & condiments' },
  { key: 'meals', label: 'Takeaway & ready meals' },
  { key: 'other', label: 'Other' },
];

export const FODMAP_TAGS = [
  { key: 'fructan', label: 'Fructans' },
  { key: 'gos', label: 'GOS' },
  { key: 'lactose', label: 'Lactose' },
  { key: 'fructose', label: 'Excess fructose' },
  { key: 'sorbitol', label: 'Sorbitol' },
  { key: 'mannitol', label: 'Mannitol' },
];

// Not FODMAPs, but common IBS triggers worth correlating.
export const OTHER_TAGS = [
  { key: 'caffeine', label: 'Caffeine' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'fatty', label: 'Fatty / fried' },
  { key: 'spicy', label: 'Spicy' },
  { key: 'fizzy', label: 'Fizzy' },
];

export const PORTIONS = [
  { key: 'small', label: 'Small' },
  { key: 'normal', label: 'Normal' },
  { key: 'large', label: 'Large' },
];

export const SEVERITY = ['None', 'Mild', 'Moderate', 'Severe']; // 0..3
export const URGENCY = ['None', 'Some', 'Strong', 'Urgent']; // 0..3

// 1..5 scales (index 0 is the label for 1)
export const MOOD = ['Very low', 'Low', 'OK', 'Good', 'Very good'];
export const STRESS = ['Very low', 'Low', 'Moderate', 'High', 'Very high'];
export const ENERGY = ['Exhausted', 'Low', 'OK', 'Good', 'Very good'];
export const SLEEP_QUALITY = ['Very poor', 'Poor', 'OK', 'Good', 'Very good'];

export const BRISTOL = [
  { n: 1, label: 'Separate hard lumps', group: 'hard' },
  { n: 2, label: 'Lumpy, sausage-shaped', group: 'hard' },
  { n: 3, label: 'Sausage with cracks', group: 'normal' },
  { n: 4, label: 'Smooth, soft sausage', group: 'normal' },
  { n: 5, label: 'Soft blobs, clear edges', group: 'loose' },
  { n: 6, label: 'Mushy, ragged edges', group: 'loose' },
  { n: 7, label: 'Watery, no solid pieces', group: 'loose' },
];

export const ENTRY_TYPES = {
  intake: { label: 'Food & drink', icon: '🍽️' },
  symptoms: { label: 'Symptoms', icon: '🌀' },
  bowel: { label: 'Bowel movement', icon: '🚽' },
  mood: { label: 'Mood & stress', icon: '🙂' },
  sleep: { label: 'Sleep', icon: '😴' },
};

export const tagLabel = (key) =>
  [...FODMAP_TAGS, ...OTHER_TAGS].find((t) => t.key === key)?.label ?? key;
export const categoryLabel = (key) =>
  CATEGORIES.find((c) => c.key === key)?.label ?? key;
export const portionLabel = (key) =>
  PORTIONS.find((p) => p.key === key)?.label ?? key;
