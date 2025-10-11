const fetch = require("node-fetch");

const SHOP = "goodleathergarments.in";
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;
const CART_ID = "gid://shopify/Cart/abc123..."; // Replace with your real cart ID

async function getCart(cartId) {
  const query = `
    query getCart($cartId: ID!) {
      cart(id: $cartId) {
        id
        totalQuantity
        checkoutUrl
        createdAt
        updatedAt
        lines(first: 10) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  product {
                    title
                  }
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
        }
      }
    }
  `;

  const res = await fetch(`https://${SHOP}/api/2024-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables: {
        cartId,
      },
    }),
  });

  const json = await res.json();

  if (json.errors) {
    console.error("❌ Shopify errors:", JSON.stringify(json.errors, null, 2));
  } else {
    console.log("🛒 Cart Data:", JSON.stringify(json.data.cart, null, 2));
  }
}

getCart(CART_ID);
