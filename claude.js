const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
require("@shopify/shopify-api/adapters/node")
const { shopifyApi, ApiVersion, Session } = require("@shopify/shopify-api");
// const { completeDraftOrder, createDraftOrder } = require('./shopifyOrders');
const {createDraftOrder} = require("./demo.js");  
const {completeDraftOrder} = require("./draftorder.js");
const Razorpay = require('razorpay');
const { loadProcessedWebhooks, saveProcessedWebhooks, loadOrderId, saveOrderId} = require("./utils/webhookStore.js");
require('dotenv').config();

  const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_SECRET,
  hostName: process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, ""),
  adminApiAccessToken: process.env.SHOPIFY_TOKEN,
  isCustomStoreApp: true,
  apiVersion: ApiVersion.July24,
});



const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://goodleathergarments.in', 'https://shopify-internationl.goodleather.workers.dev',],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later'
});

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Body parser for most routes

// Raw body for webhook signature verification
app.use(
  '/complete-order',
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Create Razorpay Order
app.post('/create-razorpay-order', 
  limiter,
  [
    body('amount').isFloat({ min: 1, max: 1000000 }).withMessage('Invalid amount'),
    body('currency').isIn(['INR', 'USD']).withMessage('Invalid currency'),
    body('draftOrderId').notEmpty().withMessage('Draft order ID required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { amount, currency, draftOrderId } = req.body;

      const options = {
        amount: Math.round(amount * 100),
        currency,
        receipt: `draft_order_${draftOrderId}`,
        payment_capture: 1,
        notes: {
          draftOrderId: draftOrderId.toString()
        }
      };

      const order = await razorpay.orders.create(options);
       
      console.log('Razorpay order created:', order);
      res.status(201).json({
        razorpayOrderId: order.id,
        draftOrderId,
        amount: order.amount,
        currency: order.currency,
      });
    } catch (err) {
      console.error('Error creating Razorpay order:', err);
      res.status(500).json({ 
        error: 'Failed to create payment order',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
      });
    }
  }
);

// Create Draft Order
app.post('/create-draft-order',
  limiter,
  [
    body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
    body('customerInfo.email').isEmail().withMessage('Valid email required'),
    body('customerInfo.phone').optional().isMobilePhone().withMessage('Invalid phone'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { items, customerInfo, note,shipping_address, tags,id } = req.body;

      // Validate items structure
      const validItems = items.every(item => 
        item.variant_id && 
        item.quantity > 0 && 
        item.quantity <= 100
      );

      if (!validItems) {
        return res.status(400).json({ 
          error: 'Invalid item structure or quantity' 
        });
      }

      console.log('dkehar verie ', items, customerInfo, note,shipping_address, tags,id )

      const draft = await createDraftOrder(items, id,customerInfo, shipping_address,note, tags);

      console.log("Draft order created:", draft);

      if (!draft || !draft.id) {
        return res.status(500).json({ 
          error: 'Failed to create draft order' 
        });
      }

      res.status(201).json({ 
        draftOrderId: draft.id,
        invoiceUrl: draft.invoice_url 
      });
    } catch (err) {
      console.error('Error creating draft order:', err);
      res.status(500).json({ 
        error: 'Failed to create draft order',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
      });
    }
  }
);

// Store processed webhook IDs for idempotency
let processedWebhooks = loadProcessedWebhooks();
// Complete Order Webhook
app.post('/complete-order', async (req, res) => {
  console.log('Received webhook:', req.body);
  const webhookSecret = process.env.RAZORPAY_KEY_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  
  console.log('Webhook signature:', webhookSecret);
  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not configured');
    return res.status(500).send('Server configuration error');
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature');
    return res.status(400).send('Invalid signature');
  }

  try {
    const payload = req.body;
    const event = payload.event;

    // Only process payment.captured events
    if (event !== 'payment.captured') {
      return res.status(200).send('Event ignored');
    }

    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      return res.status(400).send('Invalid payload structure');
    }

    const paymentId = paymentEntity.id;
    const draftOrderId = paymentEntity.notes?.draftOrderId;

    // Idempotency check
    if (processedWebhooks.has(paymentId)) {
      console.log(`Webhook ${paymentId} already processed`);
      return res.status(200).send('Already processed');
    }

    if (!draftOrderId) {
      console.error('Missing draftOrderId in payment notes');
      return res.status(400).send('Missing draft order ID');
    }

     const shop = process.env.SHOP.replace(/https?:\/\//, "").replace(/\/$/, "");
    const session = new Session({
      id: `custom-session-${Date.now()}`,
      shop,
      state: "active",
      isOnline: false,
      accessToken: process.env.SHOPIFY_TOKEN,
    });
    const client = new shopify.clients.Rest({ session });


    // Complete the draft order
    const data = await completeDraftOrder(client,draftOrderId, { 
      paymentPending: false,
      sendReceipt: true,
      paymentId: paymentId,
      paymentMethod: 'Razorpay'
    });

    // Mark as processed
    processedWebhooks.add(paymentId);

    // Clean up old entries (keep last 1000)
    if (processedWebhooks.size > 1000) {
      const arr = Array.from(processedWebhooks);
      processedWebhooks.clear();
      arr.slice(-1000).forEach(id => processedWebhooks.add(id));
    }

    saveProcessedWebhooks(processedWebhooks); 
    console.log('Saving order ID:', paymentId, data.orderId);
    saveOrderId(paymentId, data.orderId);

    console.log(`Order ${draftOrderId} completed successfully`);
    return res.status(200).send('Order completed successfully');
  } catch (err) {
    console.error('Webhook handling error:', err);
    return res.status(500).send('Internal Server Error');
  }
});


app.post("/order-status/:paymentId", (req, res) => {
  console.log('enterd order status', req.params.paymentId);
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID is required" });
    }

    const orderId = loadOrderId(paymentId);
      console.log('loaded order id', orderId);

    if (!orderId) {
      return res.status(200).json({ found: false, orderId: null });
    }

    return res.status(200).json({ found: true, orderId });
  } catch (err) {
    console.error("❌ Error fetching order ID:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
