require("@shopify/shopify-api/adapters/node")
require("dotenv").config();
const { shopifyApi, ApiVersion, Session } = require("@shopify/shopify-api");

// Initialize Shopify
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_SECRET,
  hostName: process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, ""),
  adminApiAccessToken: process.env.SHOPIFY_TOKEN,
  isCustomStoreApp: true,
  apiVersion: ApiVersion.July24,
});

async function testFetch() {
  try {
    const shop = process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "");
    
    // Create session explicitly
    const session = new Session({
      id: `custom-session-${Date.now()}`,
      shop: shop,
      state: "active",
      isOnline: false,
      accessToken: process.env.SHOPIFY_TOKEN,
    });

    // Create REST client with session
    const client = new shopify.clients.Rest({ session });
    
    // Fetch products
    const res = await client.get({
      path: "products",
      query: { limit: 5 },
    });
    
    console.log("✅ Success! Products found:", res.body.products.length);
    console.log("First product:", res.body.products[0]?.title || "N/A");
  } catch (error) {
    console.error("❌ Critical Error:", error.message);
    
    // Detailed diagnostics
    if (error.response) {
      console.log("HTTP Status:", error.response.statusCode);
      console.log("Shopify API Error:", 
        JSON.stringify(error.response.body?.errors, null, 2) || "No details"
      );
    }
    if (error.stack) console.error("Stack Trace:", error.stack);
  }
};

testFetch();  

module.exports = { testFetch, shopify, updateVariantPrice, fetchAllProductsInCollection };