const express = require('express')
const {createDraftOrder} = require('./demo')
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { completeDraftOrder,completeDraftOrder } = require('./shopifyOrders');
const Razorpay = require('razorpay');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Raw body needed for Razorpay signature verification
app.use(
  '/complete-order',
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.post('/create-razorpay-order', async (req, res) => {
  try {
    const { amount, currency, draftOrderId } = req.body;

    if (!amount || !currency || !draftOrderId) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Razorpay expects amount in smallest currency unit (paise for INR)
    const options = {
      amount: Math.round(amount * 100), 
      currency,
      receipt: `draft_order_${draftOrderId}`,
      payment_capture: 1, // automatic capture
    };

    const order = await razorpay.orders.create(options);

    res.status(201).json({ 
      razorpayOrderId: order.id,
      draftOrderId,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/create-draft-order', async (req, res) => {
  try {
    const { items, customerInfo, note, tags } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    if (!customerInfo || !customerInfo.email) {
      return res.status(400).json({ error: 'Invalid customerInfo' });
    }

    // Call your existing function
    const draft = await createDraftOrder(items, customerInfo, note, tags);

    if (!draft || !draft.id) {
      return res.status(500).json({ error: 'Failed to create draft order' });
    }

    res.status(201).json({ draftOrderId: draft.id });
  } catch (err) {
    console.error('Error creating draft order:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/complete-order', async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(400).send('Invalid signature');
  }

  try {
    const payload = req.body;

    // Example: store draftOrderId in metadata when creating Razorpay order
    const draftOrderId = payload.payload.payment.entity.notes.draftOrderId;

    await completeDraftOrder(draftOrderId, { paymentPending: false });

    return res.status(200).send('Order completed successfully');
  } catch (err) {
    console.error('Webhook handling error:', err);
    return res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
