/*
 * One-off dev helper: fill a product's themed page-content with realistic demo
 * data so the storefront PDP can be eyeballed end-to-end.
 *
 * Writes DIRECTLY to MongoDB (the product update HTTP route is multipart-only
 * and crashes on a plain JSON body), using the same MONGO_URI the server uses.
 *
 * Run:  node seed-pdp-content.js
 * Safe to re-run (idempotent). Delete this file once manual testing is done.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const PRODUCT_NAME_MATCH = /pineapple/i; // change to target another product

const pageContent = {
  badge_text: "প্রিমিয়াম কোয়ালিটি",
  hero_corner_badge: "নতুন",
  short_description: "১০০% প্রাকৃতিক শুকনো আনারস — চিনি ছাড়া, প্রিজারভেটিভ ছাড়া।",
  video_title: "দেখুন কিভাবে তৈরি হয়",
  // Public sample MP4 just to verify the video section renders. Replace/clear later.
  main_video: "https://www.w3schools.com/html/mov_bbb.mp4",
  short_features: [
    { icon_key: "lu:Wheat", icon_url: "", text: "চিনি নেই" },
    { icon_key: "lu:ShieldCheck", icon_url: "", text: "প্রিজারভেটিভ মুক্ত" },
    { icon_key: "lu:Leaf", icon_url: "", text: "ফাইবারে ভরপুর" },
    { icon_key: "fa:FaChild", icon_url: "", text: "শিশুদের উপযোগী" },
  ],
  process_steps: [
    { icon_key: "fa:FaHandHoldingHeart", icon_url: "", text: "তাজা আনারস বাছাই" },
    { icon_key: "fa:FaSun", icon_url: "", text: "প্রাকৃতিকভাবে শুকানো" },
    { icon_key: "lu:Leaf", icon_url: "", text: "পুষ্টিগুণ অক্ষুন্ন" },
    { icon_key: "fa:FaBoxOpen", icon_url: "", text: "পরীক্ষিত ও প্যাকেটজাত" },
  ],
  benefits: [
    "রোগ প্রতিরোধ ক্ষমতা বাড়ায়",
    "হজমে সাহায্য করে",
    "ভিটামিন C ও আয়রনে ভরপুর",
    "তাৎক্ষণিক এনার্জি দেয়",
  ],
  use_cases: [
    { icon_key: "fa:FaBriefcase", icon_url: "", text: "অফিসের স্ন্যাকস" },
    { icon_key: "lu:GraduationCap", icon_url: "", text: "স্কুল টিফিন" },
    { icon_key: "fa:FaDumbbell", icon_url: "", text: "জিম/ওয়ার্কআউটের পর" },
    { icon_key: "fa:FaPlane", icon_url: "", text: "ভ্রমণসঙ্গী" },
  ],
  nutrition: {
    per_serving: "প্রতি ১০০g",
    rows: [
      { label: "ক্যালরি", value: "৩১০ kcal" },
      { label: "প্রোটিন", value: "৩.৫ g" },
      { label: "কার্বোহাইড্রেট", value: "৮০ g" },
      { label: "ফাইবার", value: "৭ g" },
      { label: "চিনি", value: "৬৫ g" },
      { label: "ফ্যাট", value: "০.৫ g" },
      { label: "ভিটামিন C", value: "১৫ mg" },
      { label: "আয়রন", value: "১.২ mg" },
    ],
    info_tiles: [
      { icon_key: "lu:Leaf", label: "উপাদান", value: "১০০% প্রাকৃতিক আনারস" },
      { icon_key: "lu:Calendar", label: "শেলফ লাইফ", value: "৬ মাস" },
      { icon_key: "lu:PackageOpen", label: "সংরক্ষণ", value: "ঠাণ্ডা ও শুকনো স্থানে" },
      { icon_key: "fa:FaFlag", label: "দেশ", value: "বাংলাদেশ" },
    ],
  },
  faqs: [
    {
      question: "শুকনো আনারসে কি চিনি মেশানো আছে?",
      answer: "না, এটি ১০০% প্রাকৃতিক — কোনো বাড়তি চিনি বা প্রিজারভেটিভ নেই।",
    },
    {
      question: "কতদিন সংরক্ষণ করা যায়?",
      answer: "প্যাকেট খোলার আগে ঠাণ্ডা ও শুকনো স্থানে ৬ মাস পর্যন্ত ভালো থাকে।",
    },
  ],
};

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set in .env");
  await mongoose.connect(uri);
  console.log("✓ DB connected");

  // Work against the raw collection so we don't need the compiled model.
  const Product = mongoose.connection.collection("products");
  const product = await Product.findOne({ product_name: PRODUCT_NAME_MATCH });
  if (!product) throw new Error(`No product matching ${PRODUCT_NAME_MATCH}`);
  console.log(`✓ Found: ${product.product_name} (${product._id})  slug=${product.product_slug}`);

  await Product.updateOne({ _id: product._id }, { $set: pageContent });
  console.log("✓ Page content seeded");
  console.log(`\nOpen:  http://localhost:3000/products/${product.product_slug}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
