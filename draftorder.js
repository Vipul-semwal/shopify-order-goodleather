require("@shopify/shopify-api/adapters/node")
require("dotenv").config();
const  {createDraftOrder} = require("./demo.js");
    const { shopifyApi, ApiVersion, Session } = require("@shopify/shopify-api");

    const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_SECRET,
  hostName: process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, ""),
  adminApiAccessToken: process.env.SHOPIFY_TOKEN,
  isCustomStoreApp: true,
  apiVersion: ApiVersion.July24,
});

// async function createDraftOrderRaw() {
//   const shop =  process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "");
//   const token =  process.env.SHOPIFY_TOKEN;

//   const res = await fetch(`https://${shop}.myshopify.com/admin/api/2024-10/draft_orders.json`, {
//     method: "POST",
//     headers: {
//       "X-Shopify-Access-Token": token,
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({
//       draft_order: {
//         line_items: [
//           { variant_id: 43768254202042, quantity: 2 },
//           { title: "Custom Service Fee", quantity: 1, price: "4599.00" }
//         ],
//         email: "vipulsemwal124@gmail.com",
//         shipping_address: {
//           first_name: "John",
//           last_name: "Doe",
//           address1: "123 Main St",
//           city: "Delhi",
//           country: "India",
//           zip: "110001",
//           phone: "+91 99999 99999"
//         },
//         note: "2-hour promo draft order",
//         tags: "promo,api"
//       }
//     })
//   });

//   const data = await res.json();
//   console.log(data);
// }
// async function createDraftOrder(client) {   
//  const res = await client.post({
//   path: "draft_orders.json",
//   data: {
//     draft_order: {
//       line_items: [
//         { variant_id: 43768254202042, quantity: 2 }
//       ],
//       email: "vipul@example.com"
//       // other fields...
//     }
//   },
//   type: "application/json",
// });

//   console.log("Draft order created:", res.body.draft_orders[0]);
//   return res.body.draft_orders[0];
// };



async function sendDraftInvoice(client, draftOrderId, toEmail) {
  const res = await client.post({
    path: `draft_orders/${draftOrderId}/send_invoice`,
    type: "application/json",
    data: {
      draft_order_invoice: {
        to: toEmail, // recipient
        // from, bcc, subject are optional
        custom_message: "Here is your invoice. This link will turn into an order when paid."
      }
    }
  });

  console.log("Invoice send result:", res.body);  
};

  async function completeDraftOrder(client, draftOrderId, { paymentPending = true,sendReceipt = true  } = {}) {
  // console.log("Completing draft order:", draftOrderId, "payment_pending:", paymentPending);
  
  try {
    const res = await client.put({
      path: `draft_orders/${draftOrderId}/complete`,
      type: "application/json",
      data: {
        payment_pending: paymentPending,
         send_receipt: sendReceipt
      }
    });

    console.log("Draft order completed successfully:",res, res.body.draft_order);
    
    // The completed draft order will have an order_id
    const completedDraft = res.body.draft_order;
    console.log("Order ID:", completedDraft.order_id);
    
    return {
      draftOrder: completedDraft,
      orderId: completedDraft.order_id
    };
  } catch (error) {
    console.error("Error completing draft order:", error.message);
    if (error.response) {
      console.error("HTTP Status:", error.response.code);
      console.error("Response Body:", JSON.stringify(error.response.body, null, 2));
    }
    throw error;
  }
}

// ALTERNATIVE: GraphQL version (if you prefer to use GraphQL)
async function completeDraftOrderGraphQL(gqlClient, draftOrderId, { paymentPending = true } = {}) {
  console.log("Completing draft order with GraphQL:", draftOrderId, "payment_pending:", paymentPending);
  
  const mutation = `
    mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
      draftOrderComplete(id: $id, paymentPending: $paymentPending) {
        draftOrder {
          id
          status
          order {
            id
            name
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const response = await gqlClient.request(mutation, {
      variables: {
        id: `gid://shopify/DraftOrder/${draftOrderId}`,
        paymentPending: paymentPending
      }
    });

    // Check for userErrors
    const { draftOrderComplete } = response.data;
    if (draftOrderComplete.userErrors && draftOrderComplete.userErrors.length > 0) {
      console.error("Shopify userErrors:", draftOrderComplete.userErrors);
      throw new Error(`Shopify errors: ${JSON.stringify(draftOrderComplete.userErrors)}`);
    }

    console.log("Draft order completed via GraphQL:", draftOrderComplete.draftOrder);
    return draftOrderComplete.draftOrder;
  } catch (error) {
    console.error("Error completing draft order via GraphQL:", error.message);
    throw error;
  }
}


async function recordManualPayment(client, orderId, amount) {
  const res = await client.post({
    path: `orders/${orderId}/transactions`,
    type: "application/json",
    data: {
      transaction: {
        kind: "sale",
        status: "success",
        amount: String(amount),        // e.g. "123.45"
        gateway: "manual"              // marks as a manual payment
      }
    }
  });

  console.log("Recorded payment:", res.body.transaction?.id, "status:", res.body.transaction?.status);
  return res.body.transaction;
};


// (async function demo() {
//   try {
//     // build client the same way you already do:
//     const shop = process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "");
//     const session = new Session({
//       id: `custom-session-${Date.now()}`,
//       shop,
//       state: "active",
//       isOnline: false,
//       accessToken: process.env.SHOPIFY_TOKEN,
//     });
//     const client = new shopify.clients.Rest({ session });
//     const Gqclient = new shopify.clients.Graphql({session});

//     // 1) create a draft
//     // createDraftOrderRaw();
//     const draft = await createDraftOrder();

//     console.log('drafbhai',draft)

//     // 2) send invoice (optional)
//     // await sendDraftInvoice(client, draft.id, "vipulsemwal124@gmail.com");
    
//    console.log('drafbhai',draft.id)
//     // 3) complete draft as unpaid
//     const order = await  completeDraftOrder(client, draft.id, { paymentPending: true });

//     // 4) (optional) record a manual payment for full amount
//     // await recordManualPayment(client, order.id, draft.total_price);

//     // 5) (alt) create an order directly
//     // const direct = await createOrderDirect(client);

//   } catch (err) {
//     console.error("Flow error:", err.message);
//     if (err.response) {
//       console.error("HTTP:", err.response.statusCode);
//       console.error("Body:", JSON.stringify(err.response.body, null, 2));
//     }
//   }
// })();

module.exports = {completeDraftOrder}
