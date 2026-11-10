export interface FoodCategoryDef {
  name: string;
  slug: string;
  description: string;
}

export const INITIAL_FOOD_CATEGORIES: FoodCategoryDef[] = [
  {
    name: 'Indian Breads & Flatbreads',
    slug: 'indian-breads',
    description: 'Roti, chapati, phulka, parathas, naans, pooris, and traditional flatbreads.',
  },
  {
    name: 'Dals, Legumes & Lentils',
    slug: 'dals-and-legumes',
    description: 'Yellow dal, dal makhani, rajma, chole, sambhar, and lentil curries.',
  },
  {
    name: 'Rice, Pulao & Biryani',
    slug: 'rice-and-grains',
    description: 'Steamed rice, jeera rice, pulao varieties, khichdi, and biryanis.',
  },
  {
    name: 'South Indian Specialties',
    slug: 'south-indian',
    description: 'Idli, dosa, uttapam, vada, upma, and regional breakfast dishes.',
  },
  {
    name: 'Paneer & Vegetarian Curries',
    slug: 'vegetarian-curries',
    description: 'Paneer dishes, vegetable gravies, sabzis, and dry vegetable preparations.',
  },
  {
    name: 'Non-Vegetarian Curries & Proteins',
    slug: 'meat-and-poultry',
    description: 'Chicken curries, tandoori items, egg curries, fish, and mutton dishes.',
  },
  {
    name: 'Snacks, Street Foods & Chaat',
    slug: 'snacks-and-street-food',
    description: 'Samosas, pakoras, dhokla, poha, pav bhaji, and popular Indian snacks.',
  },
  {
    name: 'Indian Sweets & Desserts',
    slug: 'sweets-and-desserts',
    description: 'Gulab jamun, kaju katli, halwa, kheer, and traditional mithai.',
  },
  {
    name: 'Beverages & Drinks',
    slug: 'beverages',
    description: 'Masala chai, filter coffee, chaas, lassi, coconut water, and juices.',
  },
  {
    name: 'Global Staples & Fresh Whole Foods',
    slug: 'global-staples',
    description: 'Whole grains, fresh fruits, vegetables, eggs, dairy, and lean proteins.',
  },
  {
    name: 'Packaged & Branded Foods',
    slug: 'packaged-foods',
    description: 'Packaged groceries, snacks, dairy products, and packaged snacks with barcodes.',
  },
];
