require("@shopify/shopify-api/adapters/node");
require("dotenv").config();
const { shopifyApi, ApiVersion, Session } = require("@shopify/shopify-api");

// Shopify client setup
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_SECRET,
  hostName: process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, ""),
  isCustomStoreApp: true,
  apiVersion: ApiVersion.July24,
});

// -------------------- DRAFT ORDER --------------------
async function createDraftOrder(lineItems = [], customerInfo = {}, note = "") {
  const shop = process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "");
  const session = new Session({
    id: `custom-session-${Date.now()}`,
    shop,
    state: "active",
    isOnline: false,
    accessToken: process.env.SHOPIFY_TOKEN,
  });
  const client = new shopify.clients.Rest({ session });

  try {
    const payload = {
      draft_order: {
        line_items: lineItems,
        email: customerInfo.email,
        shipping_address: customerInfo.shipping_address,
        note,
      },
    };

    const res = await client.post({
      path: "draft_orders.json",
      data: payload,
      type: "application/json",
    });

    console.log("Draft order created:", res.body.draft_order);
    return res.body.draft_order;
  } catch (err) {
    console.error("Error creating draft order:", err);
    throw err;
  }
}

// -------------------- COMPLETE DRAFT ORDER --------------------
async function completeDraftOrder(draftOrderId, { paymentPending = true } = {}) {
  const shop = process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "");
  const session = new Session({
    id: `custom-session-${Date.now()}`,
    shop,
    state: "active",
    isOnline: false,
    accessToken: process.env.SHOPIFY_TOKEN,
  });
  const client = new shopify.clients.Rest({ session });

  try {
    const res = await client.put({
      path: `draft_orders/${draftOrderId}/complete`,
      type: "application/json",
      data: { payment_pending: paymentPending },
    });

    console.log("Draft order completed:", res.body.draft_order);

    return {
      draftOrder: res.body.draft_order,
      orderId: res.body.draft_order.order_id,
    };
  } catch (err) {
    console.error("Error completing draft order:", err);
    throw err;
  }
}

// -------------------- SEND INVOICE (OPTIONAL) --------------------
async function sendDraftInvoice(draftOrderId, toEmail) {
  const shop = process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "");
  const session = new Session({
    id: `custom-session-${Date.now()}`,
    shop,
    state: "active",
    isOnline: false,
    accessToken: process.env.SHOPIFY_TOKEN,
  });
  const client = new shopify.clients.Rest({ session });

  try {
    const res = await client.post({
      path: `draft_orders/${draftOrderId}/send_invoice`,
      type: "application/json",
      data: {
        draft_order_invoice: {
          to: toEmail,
          custom_message: "Here is your invoice. This link will turn into an order when paid.",
        },
      },
    });
    console.log("Invoice send result:", res.body);
    return res.body;
  } catch (err) {
    console.error("Error sending invoice:", err);
    throw err;
  }
}

// -------------------- EXPORT --------------------
module.exports = {
  createDraftOrder,
  completeDraftOrder,
  sendDraftInvoice,
};

