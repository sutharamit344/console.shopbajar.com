import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import Razorpay from 'razorpay'
import crypto from 'crypto'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          cleanupOutdatedCaches: true,
        },
        manifest: {
          name: 'ShopBajar Merchant Console',
          short_name: 'SB Console',
          description: 'Real-time kitchen ticket, waiter order approvals and seating floor manager console for ShopBajar merchants.',
          theme_color: '#FF6A00',
          background_color: '#F7F7F5',
          display: 'standalone',
          scope: '/',
          start_url: '/tables',
          icons: [
            {
              src: 'android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png'
            },
            {
              src: 'sb-logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      }),
      {
        name: 'razorpay-dev-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
            if (!url) return next();

            if (url.pathname === '/api/create-order' && req.method === 'POST') {
              try {
                let bodyStr = '';
                for await (const chunk of req) {
                  bodyStr += chunk;
                }
                const body = JSON.parse(bodyStr || '{}');
                const { amount, currency, receipt } = body;

                if (!amount || amount < 100) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Amount must be at least 100 paise' }));
                  return;
                }

                const key_id = env.RAZORPAY_KEY_ID;
                const key_secret = env.RAZORPAY_KEY_SECRET;

                if (!key_id || !key_secret) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Razorpay keys missing in environment' }));
                  return;
                }

                const razorpay = new Razorpay({ key_id, key_secret });
                const order = await razorpay.orders.create({
                  amount: Math.round(amount),
                  currency: currency || 'INR',
                  receipt: receipt || `receipt_${Date.now()}`,
                });

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  order_id: order.id,
                  amount: order.amount,
                  currency: order.currency
                }));
              } catch (error: any) {
                console.error("Error in /api/create-order dev middleware:", error);
                const errMsg = error.error?.description || error.message || (typeof error === 'object' ? JSON.stringify(error) : error.toString()) || 'Internal server error';
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: errMsg }));
              }
              return;
            }

            if (url.pathname === '/api/verify-payment' && req.method === 'POST') {
              try {
                let bodyStr = '';
                for await (const chunk of req) {
                  bodyStr += chunk;
                }
                const body = JSON.parse(bodyStr || '{}');
                const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

                if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Missing required parameters' }));
                  return;
                }

                const key_secret = env.RAZORPAY_KEY_SECRET;
                if (!key_secret) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Razorpay secret key missing' }));
                  return;
                }

                const generated_signature = crypto
                  .createHmac('sha256', key_secret)
                  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                  .digest('hex');

                if (generated_signature === razorpay_signature) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ status: 'success', verified: true }));
                } else {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ status: 'failure', verified: false, error: 'Signature mismatch' }));
                }
              } catch (error: any) {
                console.error("Error in /api/verify-payment dev middleware:", error);
                const errMsg = error.error?.description || error.message || (typeof error === 'object' ? JSON.stringify(error) : error.toString()) || 'Internal server error';
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: errMsg }));
              }
              return;
            }

            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
