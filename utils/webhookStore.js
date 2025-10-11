import fs from "fs";
const FILE_PATH = "./processed_webhooks.json";
const OrderID_Path = "./orderId.json";

// 🧩 Read JSON file safely
export function loadProcessedWebhooks() {
  try {
    if (!fs.existsSync(FILE_PATH)) return new Set();
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    const parsed = JSON.parse(data);
    return new Set(parsed);
  } catch (err) {
    console.error("❌ Failed to read webhook store:", err);
    return new Set();
  }
}

// 💾 Write updated set back to file
export function saveProcessedWebhooks(set) {
  try {
    const arr = Array.from(set);
    fs.writeFileSync(FILE_PATH, JSON.stringify(arr, null, 2), "utf-8");
  } catch (err) {
    console.error("❌ Failed to write webhook store:", err);
  }
};

export function saveOrderId(paymentId, orderId) {
  try {
    let data = {};
    if (fs.existsSync(OrderID_Path)) {
      data = JSON.parse(fs.readFileSync(OrderID_Path, "utf-8"));
    }

    // Add/update the new order
    data[paymentId] = orderId;

    // Keep only the last 100 orders
    const keys = Object.keys(data);
    if (keys.length > 100) {
      const last100Keys = keys.slice(-100); // last 100 keys
      const newData = {};
      last100Keys.forEach(key => {
        newData[key] = data[key];
      });
      data = newData;
    }

    fs.writeFileSync(OrderID_Path, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("❌ Failed to write order ID:", err);
  }
}

export function loadOrderId(paymentId) {
  try {
    if (!fs.existsSync(OrderID_Path)) return null;
    const data = JSON.parse(fs.readFileSync(OrderID_Path, "utf-8"));
    return data[paymentId] || null;
  } catch (err) {
    console.error("❌ Failed to read order ID:", err);
    return null;
  }
}


