// Starter food library, loaded once on first run. Everything is editable in the app.
//
// FODMAP tags are APPROXIMATE, from general published low-FODMAP guidance at a
// normal serving. They are not Monash lab values (that data is licensed). Many
// foods are fine in small amounts and only high in larger ones, which is why
// every logged food also records a portion size.
//
// Ids are fixed ("seed-..."), so if two devices ever sync, the starter foods
// match up instead of appearing twice. Do not change an existing id.

import { putRaw, getMeta, setMeta } from './db.js';

// [name, category, 'space separated tags']
const FOODS = [
  // Bread, cereals & grains
  ['White bread', 'grains', 'fructan'],
  ['Wholemeal bread', 'grains', 'fructan'],
  ['Rye bread', 'grains', 'fructan'],
  ['Spelt sourdough bread', 'grains', ''],
  ['Gluten-free bread', 'grains', ''],
  ['Crispbread (rye)', 'grains', 'fructan'],
  ['Rice cakes', 'grains', ''],
  ['Crackers (wheat)', 'grains', 'fructan'],
  ['Oats / porridge', 'grains', ''],
  ['Cornflakes', 'grains', ''],
  ['Wheat breakfast cereal', 'grains', 'fructan'],
  ['Muesli with dried fruit', 'grains', 'fructan fructose'],
  ['Rice, white', 'grains', ''],
  ['Rice, brown', 'grains', ''],
  ['Pasta (wheat)', 'grains', 'fructan'],
  ['Gluten-free pasta', 'grains', ''],
  ['Couscous', 'grains', 'fructan'],
  ['Rice noodles', 'grains', ''],
  ['Egg noodles (wheat)', 'grains', 'fructan'],
  ['Quinoa', 'grains', ''],
  ['Polenta', 'grains', ''],
  ['Tortilla wrap (wheat)', 'grains', 'fructan'],
  ['Corn tortilla', 'grains', ''],
  ['Croissant', 'grains', 'fructan fatty'],
  ['Pancakes', 'grains', 'fructan lactose'],

  // Dairy, eggs & milk drinks
  ['Milk', 'dairy', 'lactose'],
  ['Lactose-free milk', 'dairy', ''],
  ['Oat milk', 'dairy', 'gos'],
  ['Soy milk', 'dairy', 'gos'],
  ['Almond milk', 'dairy', ''],
  ['Rice milk', 'dairy', ''],
  ['Yoghurt, natural', 'dairy', 'lactose'],
  ['Greek yoghurt', 'dairy', 'lactose'],
  ['Lactose-free yoghurt', 'dairy', ''],
  ['Hard cheese (e.g. Jarlsberg, cheddar)', 'dairy', ''],
  ['Brown cheese (brunost)', 'dairy', 'lactose'],
  ['Cream cheese', 'dairy', 'lactose'],
  ['Cottage cheese', 'dairy', 'lactose'],
  ['Feta', 'dairy', ''],
  ['Mozzarella', 'dairy', ''],
  ['Cream', 'dairy', 'lactose fatty'],
  ['Sour cream (rømme)', 'dairy', 'lactose fatty'],
  ['Butter', 'dairy', ''],
  ['Ice cream', 'dairy', 'lactose fatty'],
  ['Eggs', 'dairy', ''],

  // Meat, fish & protein
  ['Chicken', 'protein', ''],
  ['Beef', 'protein', ''],
  ['Minced beef', 'protein', ''],
  ['Pork', 'protein', ''],
  ['Lamb', 'protein', ''],
  ['Ham', 'protein', ''],
  ['Bacon', 'protein', 'fatty'],
  ['Salami', 'protein', 'fatty'],
  ['Sausages', 'protein', 'fructan fatty'],
  ['Meatballs', 'protein', 'fructan'],
  ['Liver pâté (leverpostei)', 'protein', 'fatty'],
  ['Salmon', 'protein', ''],
  ['Cod', 'protein', ''],
  ['Prawns', 'protein', ''],
  ['Tuna, tinned', 'protein', ''],
  ['Mackerel in tomato sauce', 'protein', ''],
  ['Tofu, firm', 'protein', ''],
  ['Tofu, silken', 'protein', 'gos'],

  // Vegetables
  ['Potato', 'veg', ''],
  ['Sweet potato', 'veg', 'mannitol'],
  ['Carrot', 'veg', ''],
  ['Cucumber', 'veg', ''],
  ['Tomato', 'veg', ''],
  ['Lettuce', 'veg', ''],
  ['Spinach', 'veg', ''],
  ['Kale', 'veg', ''],
  ['Red pepper', 'veg', ''],
  ['Courgette', 'veg', ''],
  ['Aubergine', 'veg', ''],
  ['Broccoli', 'veg', ''],
  ['Cauliflower', 'veg', 'mannitol'],
  ['Cabbage, white', 'veg', ''],
  ['Brussels sprouts', 'veg', 'fructan'],
  ['Pak choi', 'veg', ''],
  ['Green beans', 'veg', ''],
  ['Peas', 'veg', 'fructan gos'],
  ['Sweetcorn', 'veg', 'sorbitol'],
  ['Onion', 'veg', 'fructan'],
  ['Spring onion (green part)', 'veg', ''],
  ['Leek', 'veg', 'fructan'],
  ['Garlic', 'veg', 'fructan'],
  ['Mushrooms', 'veg', 'mannitol'],
  ['Asparagus', 'veg', 'fructan fructose'],
  ['Celery', 'veg', 'mannitol'],
  ['Beetroot', 'veg', 'fructan'],
  ['Avocado', 'veg', 'sorbitol'],
  ['Parsnip', 'veg', ''],
  ['Swede (kålrot)', 'veg', ''],
  ['Olives', 'veg', ''],
  ['Chips / fries', 'veg', 'fatty'],

  // Fruit
  ['Apple', 'fruit', 'fructose sorbitol'],
  ['Pear', 'fruit', 'fructose sorbitol'],
  ['Banana, firm', 'fruit', ''],
  ['Banana, ripe', 'fruit', 'fructan'],
  ['Orange', 'fruit', ''],
  ['Mandarin / clementine', 'fruit', ''],
  ['Grapes', 'fruit', ''],
  ['Strawberries', 'fruit', ''],
  ['Blueberries', 'fruit', ''],
  ['Raspberries', 'fruit', ''],
  ['Blackberries', 'fruit', 'sorbitol'],
  ['Kiwi', 'fruit', ''],
  ['Pineapple', 'fruit', ''],
  ['Melon (cantaloupe)', 'fruit', ''],
  ['Watermelon', 'fruit', 'fructose mannitol'],
  ['Mango', 'fruit', 'fructose'],
  ['Cherries', 'fruit', 'fructose sorbitol'],
  ['Peach / nectarine', 'fruit', 'sorbitol'],
  ['Plum', 'fruit', 'sorbitol'],
  ['Apricot', 'fruit', 'sorbitol'],
  ['Raisins', 'fruit', 'fructan fructose'],
  ['Dates', 'fruit', 'fructan'],
  ['Lemon / lime', 'fruit', ''],

  // Beans, nuts & seeds
  ['Chickpeas', 'legumes', 'gos fructan'],
  ['Lentils', 'legumes', 'gos'],
  ['Kidney beans', 'legumes', 'gos fructan'],
  ['Baked beans', 'legumes', 'gos fructan'],
  ['Hummus', 'legumes', 'gos fructan'],
  ['Peanut butter', 'legumes', ''],
  ['Peanuts', 'legumes', ''],
  ['Almonds', 'legumes', 'gos'],
  ['Cashews', 'legumes', 'gos fructan'],
  ['Pistachios', 'legumes', 'gos fructan'],
  ['Walnuts', 'legumes', ''],
  ['Hazelnuts', 'legumes', 'gos'],
  ['Pumpkin seeds', 'legumes', ''],
  ['Sunflower seeds', 'legumes', ''],
  ['Chia seeds', 'legumes', ''],

  // Drinks
  ['Water', 'drinks', ''],
  ['Coffee, black', 'drinks', 'caffeine'],
  ['Coffee with milk', 'drinks', 'caffeine lactose'],
  ['Latte / cappuccino', 'drinks', 'caffeine lactose'],
  ['Tea, black', 'drinks', 'caffeine'],
  ['Green tea', 'drinks', 'caffeine'],
  ['Peppermint tea', 'drinks', ''],
  ['Chamomile tea', 'drinks', 'fructan'],
  ['Hot chocolate', 'drinks', 'lactose'],
  ['Orange juice', 'drinks', 'fructose'],
  ['Apple juice', 'drinks', 'fructose sorbitol'],
  ['Fruit smoothie', 'drinks', 'fructose sorbitol'],
  ['Cola', 'drinks', 'caffeine fizzy'],
  ['Diet cola', 'drinks', 'caffeine fizzy'],
  ['Sparkling water', 'drinks', 'fizzy'],
  ['Energy drink', 'drinks', 'caffeine fizzy'],
  ['Beer', 'drinks', 'alcohol fizzy'],
  ['Wine, red', 'drinks', 'alcohol'],
  ['Wine, white', 'drinks', 'alcohol'],
  ['Cider', 'drinks', 'alcohol fizzy fructose'],
  ['Spirits (vodka, gin, whisky)', 'drinks', 'alcohol'],
  ['Rum', 'drinks', 'alcohol fructose'],

  // Sweets & snacks
  ['Milk chocolate', 'snacks', 'lactose fatty'],
  ['Dark chocolate', 'snacks', ''],
  ['Biscuits', 'snacks', 'fructan fatty'],
  ['Cake', 'snacks', 'fructan lactose fatty'],
  ['Cinnamon bun (kanelbolle)', 'snacks', 'fructan lactose'],
  ['Waffles', 'snacks', 'fructan lactose'],
  ['Crisps', 'snacks', 'fatty'],
  ['Popcorn', 'snacks', ''],
  ['Gummy sweets', 'snacks', ''],
  ['Sugar-free gum / sweets', 'snacks', 'sorbitol mannitol'],
  ['Protein bar', 'snacks', 'fructan sorbitol'],
  ['Honey', 'snacks', 'fructose'],
  ['Jam', 'snacks', ''],
  ['Maple syrup', 'snacks', ''],

  // Sauces, oils & condiments
  ['Olive oil', 'sauces', ''],
  ['Garlic-infused oil', 'sauces', ''],
  ['Ketchup', 'sauces', ''],
  ['Mayonnaise', 'sauces', 'fatty'],
  ['Mustard', 'sauces', ''],
  ['Soy sauce', 'sauces', ''],
  ['Pesto', 'sauces', 'fructan'],
  ['Tomato pasta sauce (jar)', 'sauces', 'fructan'],
  ['Gravy / brown sauce', 'sauces', 'fructan'],
  ['Stock cube', 'sauces', 'fructan'],
  ['Salsa', 'sauces', 'fructan spicy'],
  ['Chilli', 'sauces', 'spicy'],
  ['Balsamic vinegar', 'sauces', 'fructose'],

  // Takeaway & ready meals
  ['Pizza', 'meals', 'fructan lactose fatty'],
  ['Burger', 'meals', 'fructan fatty'],
  ['Kebab', 'meals', 'fructan fatty'],
  ['Hot dog (pølse i brød)', 'meals', 'fructan fatty'],
  ['Fried chicken', 'meals', 'fructan fatty'],
  ['Curry (takeaway)', 'meals', 'fructan fatty spicy'],
  ['Chinese takeaway', 'meals', 'fructan fatty'],
  ['Sushi', 'meals', ''],
  ['Tacos', 'meals', 'fructan spicy'],
  ['Soup, shop-bought', 'meals', 'fructan'],
];

const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function seedRecords() {
  return FOODS.map(([name, category, tags]) => ({
    id: 'seed-' + slug(name),
    name,
    category,
    tags: tags ? tags.split(' ') : [],
    createdAt: 1, // very old, so any edit you make always wins in a merge
    updatedAt: 1,
    deleted: false,
  }));
}

export async function seedIfNeeded() {
  if (await getMeta('seeded')) return;
  await putRaw('foods', seedRecords());
  await setMeta('seeded', Date.now());
}
