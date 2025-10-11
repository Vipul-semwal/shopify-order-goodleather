const fetch = require("node-fetch");
require('dotenv').config();


const SHOP = "goodleathergarments2.myshopify.com"; // must be .myshopify.com
const API_VERSION = "2025-07";
const ACCESS_TOKEN = process.env.SHOPIFY_TOKEN;
// async function createDraftOrder() {
//   const url = `https://${SHOP}/admin/api/${API_VERSION}/draft_orders.json`;

//   const payload = {
//     draft_order: {
//       line_items: [
//         {
//           variant_id:44988850766010,
//           quantity: 1,
//         },
//       ],
//          customer: {
//              id:8529339154618,
//             email:"testing124@gmail.com",
//             phone:"+91 99999 99999",
//     },
//     shipping_address: {
//       first_name: "John",
//       last_name: "Doe",
//       address1: "123 Main St",
//       city: "Delhi",
//       country: "India",
//       zip: "110001",
//       phone: "+91 99999 99999",
//     },
//     },
//   };

//   try {
//     const res = await fetch(url, {
//       method: "POST", // ✅ must be POST
//       headers: {
//         "X-Shopify-Access-Token": ACCESS_TOKEN,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(payload),
//     });

//     if (!res.ok) {
//       const text = await res.text();
//       throw new Error(`HTTP ${res.status}: ${text}`);
//     }

//     const data = await res.json();
//     console.log("Draft order created:", data.draft_order);
//     return data.draft_order;

//   } catch (err) {
//     console.error("Error creating draft order:", err);
//   }
// }

async function createDraftOrder(items, customerId,customerInfo,shipping_address,note, tags) {
  const url = `https://${SHOP}/admin/api/${API_VERSION}/draft_orders.json`;

  const payload = {
    draft_order: {
      line_items: items,
         customer: {
             id: customerId,
             ...customerInfo,

    },
    shipping_address,
    note,
    tags,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST", // ✅ must be POST
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    console.log("Draft order created:", data.draft_order);
    return data.draft_order;

  } catch (err) {
    console.error("Error creating draft order:", err);
  }
}


module.exports = { createDraftOrder };
