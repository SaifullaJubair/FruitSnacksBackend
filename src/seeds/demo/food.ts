/**
 * Food-niche demo dataset (pure data — NO database or S3 calls here).
 *
 * The seed runner (seed-demo.ts) turns this declaration into real documents:
 * resolves images to S3, assigns publisher ids, builds variation combinations
 * from the seeded attribute value ids, and stamps is_demo=true on everything.
 *
 * Every image is a { slug, url } pair: `slug` becomes the deterministic S3 key
 * (demo/food/<slug>.<ext>) so re-runs reuse the same upload; `url` is the
 * one-time stock-photo source (only fetched if the S3 object is absent).
 *
 * Stock photos: Unsplash (free to use, hot-link source only used on first seed;
 * after that the shop serves its own S3 copy).
 */

export interface DemoImage {
  slug: string;
  url: string;
}

export interface DemoAttributeValue {
  name: string;
  slug: string;
  code?: string; // hex for swatch, or weight label
  weight_grams?: number; // when the attribute tracks weight
}

export interface DemoAttribute {
  name: string;
  slug: string;
  display_type: "swatch" | "button" | "dropdown";
  tracks_weight: boolean;
  values: DemoAttributeValue[];
}

export interface DemoCategory {
  name: string;
  slug: string;
  serial: number;
  logo?: DemoImage; // category_logo (S3)
  children?: DemoCategory[];
}

export interface DemoReview {
  name: string;
  rating: number;
  text: string;
  verified: boolean;
}

export interface DemoProduct {
  name: string;
  slug: string;
  // Which seeded category (by slug) this product lives in. Leaf preferred.
  category_slug: string;
  price: number;
  discount_price?: number;
  quantity: number;
  unit: string;
  short_description: string;
  description: string;
  badge_text?: string;
  hero_corner_badge?: string;
  main_image: DemoImage;
  other_images?: DemoImage[];
  // Small "why us" tiles under the hero (icon-less text chips).
  short_features?: string[];
  // Social share / OG meta. og_image reuses main_image when omitted.
  og_title?: string;
  og_description?: string;
  // Variation axis = which seeded attribute (by slug) drives combinations.
  // Omit for a simple (non-variation) product. Each listed value (by slug)
  // becomes one variation row with the given price/qty.
  variation?: {
    attribute_slug: string;
    rows: { value_slug: string; price: number; quantity: number; discount_price?: number }[];
  };
  // ── page-content ──
  benefits?: string[];
  use_cases?: { text: string }[];
  nutrition?: {
    per_serving?: string;
    rows: { label: string; value: string }[];
    info_tiles?: { label: string; value: string }[];
  };
  faqs?: { question: string; answer: string }[];
  reviews?: DemoReview[];
}

// ─────────────────────────── Categories (nested) ───────────────────────────
export const DEMO_CATEGORIES: DemoCategory[] = [
  {
    name: "ড্রাই ফ্রুটস",
    slug: "dry-fruits",
    serial: 1,
    logo: { slug: "cat-dryfruits", url: "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=600&q=80" },
    children: [
      { name: "বাদাম", slug: "nuts", serial: 1, logo: { slug: "cat-nuts", url: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=600&q=80" } },
      { name: "খেজুর", slug: "dates", serial: 2, logo: { slug: "cat-dates", url: "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=600&q=80" } },
    ],
  },
  {
    name: "ফ্রুট স্ন্যাকস",
    slug: "fruit-snacks",
    serial: 2,
    logo: { slug: "cat-snacks", url: "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=600&q=80" },
    children: [
      { name: "ম্যাঙ্গো বার", slug: "mango-bars", serial: 1, logo: { slug: "cat-mango", url: "https://images.unsplash.com/photo-1605027990121-cbae9e0642df?w=600&q=80" } },
      { name: "মিক্সড স্ন্যাকস", slug: "mixed-snacks", serial: 2, logo: { slug: "cat-mixed", url: "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600&q=80" } },
    ],
  },
];

// ─────────────────────────── Attributes ────────────────────────────────────
// "Pack Size" tracks weight so the variation matrix auto-fills weight_grams.
export const DEMO_ATTRIBUTES: DemoAttribute[] = [
  {
    name: "প্যাক সাইজ",
    slug: "pack-size",
    display_type: "button",
    tracks_weight: true,
    values: [
      { name: "২৫০ গ্রাম", slug: "250g", code: "250g", weight_grams: 250 },
      { name: "৫০০ গ্রাম", slug: "500g", code: "500g", weight_grams: 500 },
      { name: "১ কেজি", slug: "1kg", code: "1kg", weight_grams: 1000 },
    ],
  },
];

// ─────────────────────────── Banner + Slider ───────────────────────────────
export const DEMO_BANNERS: { title: string; serial: number; image: DemoImage }[] = [
  {
    title: "তাজা ও স্বাস্থ্যকর ফ্রুট স্ন্যাকস",
    serial: 1,
    image: {
      slug: "banner-healthy",
      url: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=1600&q=80",
    },
  },
  {
    title: "প্রিমিয়াম ড্রাই ফ্রুটস কালেকশন",
    serial: 2,
    image: {
      slug: "banner-dryfruits",
      url: "https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?w=1600&q=80",
    },
  },
];

export const DEMO_SLIDERS: { serial: number; image: DemoImage }[] = [
  {
    serial: 1,
    image: {
      slug: "slider-nuts",
      url: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=1600&q=80",
    },
  },
  {
    serial: 2,
    image: {
      slug: "slider-dates",
      url: "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=1600&q=80",
    },
  },
];

// Shared review pool snippets reused across products (each product picks a few).
const REVIEWS_A: DemoReview[] = [
  { name: "রাকিব হাসান", rating: 5, text: "খুব ফ্রেশ আর টেস্টি! পরিবারের সবাই পছন্দ করেছে।", verified: true },
  { name: "সাদিয়া আক্তার", rating: 5, text: "প্যাকেজিং দারুণ ছিল, ডেলিভারিও দ্রুত। আবার অর্ডার করব।", verified: true },
  { name: "তানভীর আহমেদ", rating: 4, text: "কোয়ালিটি ভালো, দামটা একটু কম হলে ভালো হতো।", verified: false },
];
const REVIEWS_B: DemoReview[] = [
  { name: "নুসরাত জাহান", rating: 5, text: "একদম অরিজিনাল আর তাজা। রেকমেন্ড করছি সবাইকে।", verified: true },
  { name: "ইমরান খান", rating: 5, text: "বাচ্চারা খুব পছন্দ করেছে, চিনি ছাড়া হেলদি স্ন্যাকস।", verified: true },
  { name: "ফারিয়া ইসলাম", rating: 4, text: "ভালো প্রোডাক্ট, সময়মতো পেয়েছি।", verified: false },
];

// ─────────────────────────── Products ──────────────────────────────────────
export const DEMO_PRODUCTS: DemoProduct[] = [
  // 1) Variation product — Premium Almonds (pack sizes)
  {
    name: "প্রিমিয়াম কাঠবাদাম",
    slug: "premium-almonds",
    category_slug: "nuts",
    price: 650,
    quantity: 0, // variation product — stock lives on rows
    unit: "প্যাক",
    short_description: "ক্যালিফোর্নিয়ার সেরা মানের কাঠবাদাম, প্রোটিন আর ভিটামিন-ই সমৃদ্ধ।",
    description:
      "১০০% প্রাকৃতিক কাঠবাদাম — কোনো প্রিজারভেটিভ বা বাড়তি লবণ নেই। প্রতিদিনের স্বাস্থ্যকর স্ন্যাকস হিসেবে আদর্শ।",
    badge_text: "বেস্ট সেলার",
    hero_corner_badge: "নতুন",
    short_features: ["১০০% প্রাকৃতিক", "প্রিজারভেটিভ ছাড়া", "ফ্রি হোম ডেলিভারি"],
    og_title: "প্রিমিয়াম কাঠবাদাম — তাজা ও প্রোটিন সমৃদ্ধ | FruitSnacks",
    og_description:
      "ক্যালিফোর্নিয়ার সেরা মানের ১০০% প্রাকৃতিক কাঠবাদাম। প্রোটিন ও ভিটামিন-ই সমৃদ্ধ, প্রিজারভেটিভ ছাড়া।",
    main_image: {
      slug: "almonds-main",
      url: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=900&q=80",
    },
    other_images: [
      {
        slug: "almonds-2",
        url: "https://images.unsplash.com/photo-1606914469633-bd39206ea739?w=900&q=80",
      },
    ],
    variation: {
      attribute_slug: "pack-size",
      rows: [
        { value_slug: "250g", price: 650, quantity: 40 },
        { value_slug: "500g", price: 1250, discount_price: 1150, quantity: 30 },
        { value_slug: "1kg", price: 2400, discount_price: 2200, quantity: 20 },
      ],
    },
    benefits: ["হার্টের জন্য ভালো", "প্রোটিন ও ফাইবার সমৃদ্ধ", "এনার্জি বুস্টার", "ভিটামিন-ই এর উৎস"],
    use_cases: [
      { text: "সকালের নাস্তায়" },
      { text: "অফিসের স্ন্যাকস" },
      { text: "ওয়ার্কআউটের পর" },
    ],
    nutrition: {
      per_serving: "প্রতি ১০০ গ্রাম",
      rows: [
        { label: "ক্যালরি", value: "৫৭৯ kcal" },
        { label: "প্রোটিন", value: "২১ গ্রাম" },
        { label: "ফ্যাট", value: "৪৯ গ্রাম" },
        { label: "ফাইবার", value: "১২ গ্রাম" },
      ],
      info_tiles: [
        { label: "প্রিজারভেটিভ", value: "নেই" },
        { label: "অরিজিন", value: "USA" },
      ],
    },
    faqs: [
      { question: "এটি কি কাঁচা নাকি ভাজা?", answer: "এটি ১০০% কাঁচা ও প্রাকৃতিক, কোনো ভাজা বা লবণ যোগ করা হয়নি।" },
      { question: "কতদিন ভালো থাকে?", answer: "শুকনো ও ঠান্ডা জায়গায় সংরক্ষণ করলে ৬ মাস পর্যন্ত ভালো থাকে।" },
    ],
    reviews: REVIEWS_A,
  },

  // 2) Variation product — Medjool Dates (pack sizes)
  {
    name: "মেডজুল খেজুর",
    slug: "medjool-dates",
    category_slug: "dates",
    price: 850,
    quantity: 0,
    unit: "প্যাক",
    short_description: "নরম, রসালো ও মিষ্টি মেডজুল খেজুর — প্রকৃতির ক্যান্ডি।",
    description:
      "সৌদি আরবের প্রিমিয়াম মেডজুল খেজুর। প্রাকৃতিক চিনি, ফাইবার ও পটাশিয়াম সমৃদ্ধ, রোজা ও প্রতিদিনের জন্য আদর্শ।",
    badge_text: "প্রিমিয়াম",
    short_features: ["সৌদি মেডজুল", "বাড়তি চিনি নেই", "ইফতারের জন্য আদর্শ"],
    og_title: "মেডজুল খেজুর — প্রকৃতির ক্যান্ডি | FruitSnacks",
    og_description:
      "সৌদি আরবের প্রিমিয়াম মেডজুল খেজুর। প্রাকৃতিক চিনি, ফাইবার ও পটাশিয়াম সমৃদ্ধ।",
    main_image: {
      slug: "dates-main",
      url: "https://images.unsplash.com/photo-1577003833619-76bbd7f82948?w=900&q=80",
    },
    variation: {
      attribute_slug: "pack-size",
      rows: [
        { value_slug: "250g", price: 850, quantity: 35 },
        { value_slug: "500g", price: 1600, discount_price: 1500, quantity: 25 },
      ],
    },
    benefits: ["প্রাকৃতিক এনার্জি", "ফাইবার সমৃদ্ধ", "আয়রন ও পটাশিয়াম", "চিনি ছাড়া মিষ্টি"],
    use_cases: [{ text: "ইফতারে" }, { text: "চিনির বিকল্প হিসেবে" }, { text: "স্মুদিতে" }],
    nutrition: {
      per_serving: "প্রতি ১০০ গ্রাম",
      rows: [
        { label: "ক্যালরি", value: "২৭৭ kcal" },
        { label: "কার্বোহাইড্রেট", value: "৭৫ গ্রাম" },
        { label: "ফাইবার", value: "৭ গ্রাম" },
      ],
      info_tiles: [{ label: "বাড়তি চিনি", value: "নেই" }],
    },
    faqs: [
      { question: "এতে কি বাড়তি চিনি আছে?", answer: "না, এটি সম্পূর্ণ প্রাকৃতিক, কোনো বাড়তি চিনি নেই।" },
    ],
    reviews: REVIEWS_B,
  },

  // 3) Simple product (no variation) — Mango Fruit Bar
  {
    name: "ম্যাঙ্গো ফ্রুট বার",
    slug: "mango-fruit-bar",
    category_slug: "mango-bars",
    price: 120,
    discount_price: 99,
    quantity: 100,
    unit: "পিস",
    short_description: "আসল আমের পাল্প দিয়ে তৈরি, চিনি ছাড়া হেলদি ফ্রুট বার।",
    description:
      "১০০% আসল আম দিয়ে তৈরি ফ্রুট বার — কোনো কৃত্রিম রং, ফ্লেভার বা প্রিজারভেটিভ নেই। বাচ্চাদের টিফিনের জন্য পারফেক্ট।",
    badge_text: "চিনি ছাড়া",
    short_features: ["আসল আমের পাল্প", "কৃত্রিম রং নেই", "টিফিনের জন্য পারফেক্ট"],
    og_title: "ম্যাঙ্গো ফ্রুট বার — চিনি ছাড়া হেলদি স্ন্যাকস | FruitSnacks",
    og_description:
      "১০০% আসল আম দিয়ে তৈরি ফ্রুট বার — কৃত্রিম রং, ফ্লেভার বা প্রিজারভেটিভ ছাড়া।",
    main_image: {
      slug: "mango-bar-main",
      url: "https://images.unsplash.com/photo-1605027990121-cbae9e0642df?w=900&q=80",
    },
    benefits: ["চিনি ছাড়া", "আসল ফলের পাল্প", "কৃত্রিম রং নেই", "বাচ্চাদের জন্য নিরাপদ"],
    use_cases: [{ text: "টিফিনে" }, { text: "চলার পথে স্ন্যাকস" }],
    nutrition: {
      per_serving: "প্রতি বার (৩০ গ্রাম)",
      rows: [
        { label: "ক্যালরি", value: "৯০ kcal" },
        { label: "চিনি", value: "০ গ্রাম (যোগ করা)" },
      ],
    },
    faqs: [
      { question: "এতে কি প্রিজারভেটিভ আছে?", answer: "না, সম্পূর্ণ প্রাকৃতিক, কোনো প্রিজারভেটিভ নেই।" },
    ],
    reviews: REVIEWS_A,
  },

  // 4) Simple product — Mixed Nuts Trail Mix
  {
    name: "মিক্সড নাটস ট্রেইল মিক্স",
    slug: "mixed-nuts-trail-mix",
    category_slug: "mixed-snacks",
    price: 480,
    quantity: 60,
    unit: "প্যাক (২০০ গ্রাম)",
    short_description: "কাঠবাদাম, কাজু, কিশমিশ ও আখরোটের পারফেক্ট মিশ্রণ।",
    description:
      "প্রিমিয়াম মিক্সড নাটস ও ড্রাই ফ্রুটসের মিশ্রণ — অফিস, ভ্রমণ বা যেকোনো সময়ের জন্য আদর্শ এনার্জি স্ন্যাকস।",
    badge_text: "এনার্জি প্যাক",
    short_features: ["৫ ধরনের নাটস", "ইনস্ট্যান্ট এনার্জি", "রিসিলেবল প্যাক"],
    og_title: "মিক্সড নাটস ট্রেইল মিক্স — এনার্জি স্ন্যাকস | FruitSnacks",
    og_description:
      "কাঠবাদাম, কাজু, কিশমিশ ও আখরোটের প্রিমিয়াম মিশ্রণ — অফিস, ভ্রমণ ও পড়ার সময়ের জন্য আদর্শ।",
    main_image: {
      slug: "trail-mix-main",
      url: "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=900&q=80",
    },
    benefits: ["মাল্টি-নিউট্রিয়েন্ট", "ইনস্ট্যান্ট এনার্জি", "ফাইবার সমৃদ্ধ", "প্রিজারভেটিভ ছাড়া"],
    use_cases: [{ text: "ভ্রমণে" }, { text: "অফিসে" }, { text: "পড়ার সময়" }],
    nutrition: {
      per_serving: "প্রতি ১০০ গ্রাম",
      rows: [
        { label: "ক্যালরি", value: "৫২০ kcal" },
        { label: "প্রোটিন", value: "১৬ গ্রাম" },
        { label: "ফাইবার", value: "৯ গ্রাম" },
      ],
      info_tiles: [{ label: "নাটসের ধরন", value: "৫টি" }],
    },
    faqs: [
      { question: "এতে কোন কোন নাট আছে?", answer: "কাঠবাদাম, কাজু, আখরোট, কিশমিশ ও পেস্তার মিশ্রণ।" },
      { question: "কতদিন ভালো থাকে?", answer: "শুকনো ও ঠান্ডা জায়গায় রাখলে ৪–৬ মাস ভালো থাকে।" },
    ],
    reviews: REVIEWS_B,
  },

  // 5) Simple product — Cashew Nuts
  {
    name: "কাজু বাদাম",
    slug: "cashew-nuts",
    category_slug: "nuts",
    price: 950,
    discount_price: 890,
    quantity: 45,
    unit: "প্যাক (৫০০ গ্রাম)",
    short_description: "ক্রিমি ও মুচমুচে প্রিমিয়াম কাজু বাদাম।",
    description:
      "সেরা মানের গোটা কাজু বাদাম — কোনো ভাঙা টুকরা নেই। রান্না বা সরাসরি স্ন্যাকস, দুটোতেই দারুণ।",
    badge_text: "গোটা কাজু",
    short_features: ["গোটা ও অক্ষত", "ভাঙা টুকরা নেই", "ফ্রি ডেলিভারি"],
    og_title: "কাজু বাদাম — প্রিমিয়াম গোটা কাজু | FruitSnacks",
    og_description:
      "সেরা মানের গোটা কাজু বাদাম, কোনো ভাঙা টুকরা নেই। রান্না ও স্ন্যাকস দুটোতেই দারুণ।",
    main_image: {
      slug: "cashew-main",
      url: "https://images.unsplash.com/photo-1502741126161-b048400d085d?w=900&q=80",
    },
    benefits: ["প্রোটিন সমৃদ্ধ", "ম্যাগনেশিয়ামের উৎস", "গোটা ও অক্ষত", "হার্ট-ফ্রেন্ডলি ফ্যাট"],
    use_cases: [{ text: "রান্নায়" }, { text: "স্ন্যাকস হিসেবে" }, { text: "মিষ্টি তৈরিতে" }],
    nutrition: {
      per_serving: "প্রতি ১০০ গ্রাম",
      rows: [
        { label: "ক্যালরি", value: "৫৫৩ kcal" },
        { label: "প্রোটিন", value: "১৮ গ্রাম" },
        { label: "ফ্যাট", value: "৪৪ গ্রাম" },
      ],
      info_tiles: [{ label: "গ্রেড", value: "W320" }],
    },
    faqs: [
      { question: "এটি কি কাঁচা নাকি ভাজা?", answer: "কাঁচা গোটা কাজু — চাইলে হালকা ভেজে নিতে পারেন।" },
      { question: "সাইজ কেমন?", answer: "W320 গ্রেড — বড় ও সমান আকারের গোটা কাজু।" },
    ],
    reviews: REVIEWS_A,
  },

  // 6) Simple product — Dried Apricots
  {
    name: "শুকনো এপ্রিকট",
    slug: "dried-apricots",
    category_slug: "dry-fruits",
    price: 720,
    quantity: 50,
    unit: "প্যাক (৪০০ গ্রাম)",
    short_description: "নরম ও মিষ্টি শুকনো এপ্রিকট, ফাইবার ও আয়রনে ভরপুর।",
    description:
      "প্রাকৃতিকভাবে শুকানো এপ্রিকট — সালফার ছাড়া, কোনো বাড়তি চিনি নেই। হজমের জন্য উপকারী।",
    badge_text: "সালফার ছাড়া",
    short_features: ["সালফার ছাড়া", "বাড়তি চিনি নেই", "প্রাকৃতিকভাবে শুকানো"],
    og_title: "শুকনো এপ্রিকট — ফাইবার ও আয়রন সমৃদ্ধ | FruitSnacks",
    og_description:
      "প্রাকৃতিকভাবে শুকানো এপ্রিকট, সালফার ও বাড়তি চিনি ছাড়া। হজমের জন্য উপকারী।",
    main_image: {
      slug: "apricot-main",
      url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=900&q=80",
    },
    benefits: ["ফাইবার সমৃদ্ধ", "আয়রনের উৎস", "সালফার ছাড়া", "প্রাকৃতিক মিষ্টতা"],
    use_cases: [{ text: "স্ন্যাকস হিসেবে" }, { text: "বেকিং-এ" }, { text: "ওটমিল/স্মুদিতে" }],
    nutrition: {
      per_serving: "প্রতি ১০০ গ্রাম",
      rows: [
        { label: "ক্যালরি", value: "২৪১ kcal" },
        { label: "ফাইবার", value: "৭ গ্রাম" },
        { label: "আয়রন", value: "২.৭ mg" },
      ],
      info_tiles: [{ label: "সালফার", value: "নেই" }],
    },
    faqs: [
      { question: "এতে কি সালফার ডাই-অক্সাইড আছে?", answer: "না, এটি সালফার ছাড়া প্রাকৃতিকভাবে শুকানো (তাই রঙ একটু গাঢ়)।" },
      { question: "কীভাবে সংরক্ষণ করব?", answer: "এয়ারটাইট কন্টেইনারে ঠান্ডা ও শুকনো জায়গায় রাখুন।" },
    ],
    reviews: REVIEWS_B,
  },
];

// Theme seeded for the demo (food-friendly warm palette) + floating accents.
// Each floating asset is anchored to a PDP section; the storefront renders them
// as soft animated images. position/align/section/animation mirror the theme
// floating_assets schema (theme.model.ts floatingAssetSchema).
export const DEMO_THEME = {
  theme_name: "Demo Fresh Food",
  theme_slug: "demo-fresh-food",
  theme_for: "food",
  primary: "#E8590C", // warm orange
  page_bg: "#FFF9F2",
  accent: "#2F9E44", // fresh green
  floating: [
    {
      slug: "float-1",
      url: "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=300&q=80",
      position: "left",
      align: "top",
      section: "hero",
      animation_type: "float",
      animation_speed: "slow",
      size: "md",
      opacity: 0.85,
    },
    {
      slug: "float-2",
      url: "https://images.unsplash.com/photo-1502741126161-b048400d085d?w=300&q=80",
      position: "right",
      align: "middle",
      section: "benefits",
      animation_type: "sway",
      animation_speed: "normal",
      size: "sm",
      opacity: 0.8,
    },
    {
      slug: "float-3",
      url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&q=80",
      position: "right",
      align: "bottom",
      section: "reviews",
      animation_type: "float",
      animation_speed: "slow",
      size: "sm",
      opacity: 0.75,
    },
  ] as const,
};
