import { IPageSeo } from "./pageSeo.interface";
import PageSeoModel from "./pageSeo.model";

// সব page SEO আনো
export const getAllPageSeoService = async () => {
  return await PageSeoModel.find({}).sort({ page_key: 1 });
};

// একটা page SEO আনো (key দিয়ে)
export const getPageSeoByKeyService = async (page_key: string) => {
  return await PageSeoModel.findOne({ page_key });
};

// একটা page SEO update করো
export const updatePageSeoService = async (
  page_key: string,
  data: Partial<IPageSeo>,
) => {
  return await PageSeoModel.findOneAndUpdate(
    { page_key },
    { $set: data },
    { new: true, upsert: true }, // না থাকলে create করবে
  );
};

// ── Seed ─────────────────────────────────────────────────────────────────────
// প্রথমবার সব default data DB তে ঢোকানো
const DEFAULT_PAGES: IPageSeo[] = [
  {
    page_key: "home",
    path: "",
    title: "Premium Genuine Leather Wallets, Ladies Bags & Belts in Bangladesh",
    description:
      "বাংলাদেশে ১০০% খাঁটি চামড়ার মানিব্যাগ, স্টাইলিশ লেডিস ব্যাগ ও মজবুত বেল্টের বিশাল কালেকশন। প্রিমিয়াম কোয়ালিটি ও ফাস্ট ক্যাশ অন ডেলিভারি সুবিধা।",
    noIndex: false,
  },
  // Main product-listing page (the storefront's /shop). buildPageMeta("shop")
  // reads this; previously missing from the seed so it fell back to static.
  {
    page_key: "shop",
    path: "shop",
    title: "Shop All Products | FruitSnacks",
    description:
      "Browse our full product collection. Quality items at the best price with fast cash on delivery across Bangladesh.",
    noIndex: false,
  },
  // ── Legacy listing routes — these now 301-redirect to /shop (see
  // next.config.mjs). Kept here only so they resolve to noIndex:true and the
  // owner can see they're retired; they must NOT be indexed (duplicate of /shop).
  {
    page_key: "allProducts",
    path: "all-products",
    title: "All Products | Shop All Genuine Leather Products",
    description:
      "আমাদের সব এক্সক্লুসিভ লেদার কালেকশন। প্রিমিয়াম মানিব্যাগ, ফ্যাশনেবল লেডিস ব্যাগ ও টেকসই লেদার বেল্ট কিনুন সেরা দামে।",
    noIndex: true,
  },
  {
    page_key: "allTrending",
    path: "all-trending-products",
    title: "Trending Products | Best Selling Wallets & Bags",
    description:
      "বর্তমানে সবচেয়ে জনপ্রিয় ও ট্রেন্ডিং লেদার প্রোডাক্টগুলো দেখে নিন।",
    noIndex: true,
  },
  {
    page_key: "newArrival",
    path: "new-arrival",
    title: "New Arrival Leather Collection | Latest Wallets & Belts",
    description:
      "আমাদের স্টকে আসা একদম নতুন ডিজাইনের লেদার মানিব্যাগ, লেডিস ব্যাগ এবং বেল্ট।",
    noIndex: true,
  },
  {
    page_key: "topProduct",
    path: "top-product",
    title: "Top Rated Leather Products | Premium Quality Selection",
    description: "সবচেয়ে বেশি বিক্রিত এবং টপ রেটেড লেদার আইটেম।",
    noIndex: true,
  },
  {
    page_key: "latestProduct",
    path: "latest-product",
    title: "Latest Leather Goods | Just Launched Collection",
    description: "নতুন এবং এক্সক্লুসিভ সব লেদার এক্সেসরিজ।",
    noIndex: true,
  },
  {
    page_key: "aboutUs",
    path: "about-us",
    title: "About Our Brand | Trusted Leather Goods Shop in BD",
    description: "বাংলাদেশে খাঁটি চামড়ার পণ্য সরবরাহে আমরা একটি বিশ্বস্ত নাম।",
    noIndex: false,
  },
  {
    page_key: "privacyPolicy",
    path: "privacy-policy",
    title: "Privacy Policy | Security & Data Protection",
    description:
      "আপনার ব্যক্তিগত তথ্যের নিরাপত্তা আমাদের কাছে সর্বোচ্চ অগ্রাধিকার।",
    noIndex: false,
  },
  {
    page_key: "returnPolicy",
    path: "return-policy",
    title: "Return & Exchange Policy | Easy & Fast Returns",
    description:
      "পণ্য হাতে পাওয়ার পর কোনো সমস্যা থাকলে সহজে রিটার্ন বা এক্সচেঞ্জ করার সুবিধা।",
    noIndex: false,
  },
  {
    page_key: "refundPolicy",
    path: "refund-policy",
    title: "Refund Policy | Secure Refund Process",
    description:
      "আমাদের রিফান্ড পলিসি এবং টাকা ফেরত পাওয়ার প্রক্রিয়া সম্পর্কে বিস্তারিত তথ্য।",
    noIndex: false,
  },
  {
    page_key: "cancelPolicy",
    path: "cancel-policy",
    title: "Order Cancellation Policy | Shopping Terms",
    description: "অর্ডার ক্যান্সেলেশন বা বাতিল করার নিয়মাবলী এবং শর্তাবলী।",
    noIndex: false,
  },
  {
    page_key: "shippingInfo",
    path: "shipping-information",
    title: "Shipping & Delivery Information | Fast Home Delivery",
    description:
      "সারা বাংলাদেশে দ্রুত ডেলিভারি! শিপিং চার্জ, ডেলিভারি সময় এবং কুরিয়ার সার্ভিস সংক্রান্ত সব তথ্য।",
    noIndex: false,
  },
  {
    page_key: "termsCondition",
    path: "terms-condition",
    title: "Terms & Conditions | Shopping Rules",
    description: "আমাদের ওয়েবসাইট থেকে কেনাকাটার নিয়মাবলী এবং শর্তাবলী।",
    noIndex: false,
  },
  // ── Private pages ──────────────────────────────────────
  {
    page_key: "signIn",
    path: "sign-in",
    title: "Login to Your Account",
    description: "",
    noIndex: true,
  },
  {
    page_key: "signUp",
    path: "sign-up",
    title: "Create a New Account",
    description: "",
    noIndex: true,
  },
  {
    page_key: "cart",
    path: "cart",
    title: "Shopping Cart | Checkout",
    description: "",
    noIndex: true,
  },
  {
    page_key: "wishlist",
    path: "wishlist",
    title: "Your Wishlist",
    description: "",
    noIndex: true,
  },
  {
    page_key: "verify",
    path: "verify",
    title: "Verify Your Account",
    description: "",
    noIndex: true,
  },
  {
    page_key: "changePassword",
    path: "change-password",
    title: "Change Your Password",
    description: "",
    noIndex: true,
  },
  {
    page_key: "forgetPassword",
    path: "forget-password",
    title: "Reset Your Password",
    description: "",
    noIndex: true,
  },
  {
    page_key: "offer",
    path: "offer",
    title: "Special Offers & Discounts",
    description:
      "Grab the latest deals, bundles and discounts. Limited-time offers with cash on delivery.",
    noIndex: false, // public offers page — should be indexed
  },
  {
    page_key: "orders",
    path: "orders",
    title: "Order History",
    description: "",
    noIndex: true,
  },
  {
    page_key: "orderSuccess",
    path: "order-success",
    title: "Order Successful | Thank You!",
    description: "",
    noIndex: true,
  },
];

export const seedPageSeoService = async () => {
  let created = 0;
  let skipped = 0;

  for (const page of DEFAULT_PAGES) {
    const exists = await PageSeoModel.findOne({ page_key: page.page_key });
    if (!exists) {
      await PageSeoModel.create(page);
      created++;
    } else {
      skipped++;
    }
  }

  return { created, skipped, total: DEFAULT_PAGES.length };
};
