/**
 * Email alerts via SendGrid.
 * Sends price-drop and back-in-stock notifications when configured.
 */

require('dotenv').config();
const logger = require('./logger');

let sgMail = null;
if (process.env.SENDGRID_API_KEY) {
  sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const supabase = require('./db');

/**
 * Check alert conditions and send email if triggered.
 * @param {{ productId: string, storeId: number, data: ScrapedData }} options
 */
async function maybeSendAlerts({ productId, storeId, data }) {
  if (!sgMail) {
    logger.debug('SendGrid not configured — skipping alerts');
    return;
  }

  // Fetch alert settings for this product
  const { data: product, error } = await supabase
    .from('tracked_products')
    .select('name, alert_price, alert_email, alert_back_in_stock')
    .eq('id', productId)
    .single();

  if (error || !product) return;
  if (!product.alert_email) return; // No email configured

  const alerts = [];

  // Price-drop alert
  if (product.alert_price && data.price <= product.alert_price) {
    alerts.push({
      type: 'PRICE_DROP',
      subject: `🎉 Price Drop Alert: ${product.name}`,
      body: `
        <h2>Price Drop Alert!</h2>
        <p>Good news! <strong>${product.name}</strong> has dropped to your target price.</p>
        <table style="border-collapse:collapse;">
          <tr><td style="padding:4px 8px;"><strong>Current Price:</strong></td><td style="padding:4px 8px;">₹${data.price?.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding:4px 8px;"><strong>Your Alert Price:</strong></td><td style="padding:4px 8px;">₹${product.alert_price?.toLocaleString('en-IN')}</td></tr>
          ${data.mrp ? `<tr><td style="padding:4px 8px;"><strong>MRP:</strong></td><td style="padding:4px 8px;">₹${data.mrp?.toLocaleString('en-IN')}</td></tr>` : ''}
          <tr><td style="padding:4px 8px;"><strong>Stock:</strong></td><td style="padding:4px 8px;">${data.stockText}</td></tr>
        </table>
        <p><a href="${process.env.FRONTEND_URL}/product/${productId}">View Price History →</a></p>
      `,
    });
  }

  // Back-in-stock alert
  if (product.alert_back_in_stock && data.inStock) {
    // Check if it was previously out of stock
    const { data: lastHistory } = await supabase
      .from('price_history')
      .select('in_stock')
      .eq('product_id', productId)
      .order('scraped_at', { ascending: false })
      .limit(2);

    const prevInStock = lastHistory?.[1]?.in_stock;
    if (prevInStock === false) {
      alerts.push({
        type: 'BACK_IN_STOCK',
        subject: `✅ Back in Stock: ${product.name}`,
        body: `
          <h2>Back in Stock!</h2>
          <p><strong>${product.name}</strong> is now available again!</p>
          <table style="border-collapse:collapse;">
            <tr><td style="padding:4px 8px;"><strong>Current Price:</strong></td><td style="padding:4px 8px;">₹${data.price?.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding:4px 8px;"><strong>Stock:</strong></td><td style="padding:4px 8px;">${data.stockText}</td></tr>
          </table>
          <p><a href="${process.env.FRONTEND_URL}/product/${productId}">View Product →</a></p>
        `,
      });
    }
  }

  for (const alert of alerts) {
    try {
      await sgMail.send({
        to: product.alert_email,
        from: process.env.SENDGRID_FROM_EMAIL || 'alerts@pricetracker.app',
        subject: alert.subject,
        html: alert.body,
      });
      logger.info(`Alert sent [${alert.type}] for product ${storeId} to ${product.alert_email}`);
    } catch (err) {
      logger.error(`Failed to send ${alert.type} alert: ${err.message}`);
    }
  }
}

module.exports = { maybeSendAlerts };
