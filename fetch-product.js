// fetch-products.js
require("@shopify/shopify-api/adapters/node");
require("dotenv").config();
const { shopifyApi, ApiVersion, Session } = require("@shopify/shopify-api");


// Helpful small sleep to avoid hitting rate limits during pagination
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ----- 1) create shopify client -----
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_SECRET,
  hostName: process.env.SHOP ? process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "") : "",
  adminApiAccessToken: process.env.SHOPIFY_TOKEN,
  isCustomStoreApp: true,
  apiVersion: ApiVersion.July24,
});

async function makeClient() {
  const shop = process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "");
  const session = new Session({
    id: `custom-session-${Date.now()}`,
    shop,
    state: "active",
    isOnline: false,
    accessToken: process.env.SHOPIFY_TOKEN,
  });
  return new shopify.clients.Rest({ session });
}

// update product variant price
 async function updateVariantPrice(client, variantId, newPrice) {
  const res = await client.put({
    path: `variants/${variantId}`,
    data: {
      variant: {
        id: variantId,
        price: newPrice
      }
    },
    type: "application/json"
  });
  console.log("Updated variant:", res.body.variant.id, "to price", res.body.variant.price);
};

// ----- 2) fetch all products (paginated) -----
// Uses since_id pagination. limit up to 250 per request.
async function fetchAllProductsInCollection(client, collectionId) {
  const all = [];
  const limit = 250; // max per page
  let lastId = 0;

  while (true) {
    const query = { limit };
    if (collectionId) query.collection_id = collectionId;
    if (lastId) query.since_id = lastId;

    const res = await client.get({ path: "products", query });
    const batch = (res.body && res.body.products) || [];

    all.push(...batch);

    // if fewer than limit returned -> last page
    if (batch.length < limit) break;

    // otherwise set since_id to last product id for next page
    lastId = batch[batch.length - 1].id;

    // tiny delay to be kind to Shopify rate limits
    await sleep(500);
  }

  return all;
}

// ----- 3) helper to print a short summary -----
function printSummary(products) {
  console.log("Fetched products count:", products.length);
  if (products.length > 0) {
    const p = products[0];
    console.log("First product sample:");
    console.log(" id:", p.id);
    console.log(" title:", p.title);
    console.log(" variants:", (p.variants || []).length);
    if (p.variants && p.variants[0]) {
      console.log(" first variant id:", p.variants[0].id, "price:", p.variants[0].price);
    }
  }
}

// ----- 4) main CLI entry -----
// Usage: node fetch-products.js --collection=123456789
(async function main() {
  try {
    const argv = require("minimist")(process.argv.slice(2));
    const collectionId = argv.collection || argv.c || null;

    const client = await makeClient();

    console.log("Starting fetch. collectionId:", collectionId || "none (fetch all)");
    const products = await fetchAllProductsInCollection(client, collectionId);

    printSummary(products); 

    // If you want, return or save products to disk (commented out)
    // const fs = require('fs').promises;
    // await fs.writeFile('products_backup.json', JSON.stringify(products, null, 2));

     const fs = require("fs").promises;
    await fs.writeFile("products_backup.json", JSON.stringify(products, null, 2));

    console.log("Products saved to products_backup.json");
    

    // updat the data here
    if (products.length > 0 && products[0].variants && products[0].variants[0]) {
      const variantId = products[0].variants[0].id;
      const newPrice = "1000.45"; // any demo value
      await updateVariantPrice(client, variantId, newPrice);
      console.log(`Would update variant ${variantId}'s cP ${products[0].variants[0].price} to price ${newPrice}`);
      // await updateVariantPrice(client, variantId, newPrice);
    };
    
  } catch (err) {
    console.error("Error fetching products:", err);
    if (err.response) {
      console.error("HTTP status:", err.response.statusCode);
      console.error("Body:", err.response.body || err.response);
    }
  }
})();
