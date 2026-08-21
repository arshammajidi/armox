# armox — سرور پرداخت مستقیم مایکت

این پروژه یک سرور Node.js است که جریان [پرداخت مستقیم مایکت](https://myket.ir/kb/pages/myket-direct-purchase/) را پیاده می‌کند. توکن و کلید هرگز از مرورگر صدا زده نمی‌شوند.

## جریان

1. `POST /api/myket/start` — سرور شما به مایکت `iap/start` می‌زند و `url` می‌گیرد.
2. مرورگر کاربر به همان `url` هدایت می‌شود و پرداخت را در سایت مایکت تمام می‌کند.
3. مایکت فرم را به `POST /myket-callback` می‌فرستد (`status`, `invoice`, `signature`).
4. سرور امضا را با کلید عمومی (SHA1 + RSA PKCS#1) چک می‌کند، سپس `verify` می‌زند.
5. فقط اگر `purchaseState === 0` محصول را تحویل بده؛ بعد `consume`.

## اجرا

```bash
cp .env.example .env
# مقادیر پنل مایکت را پر کنید
npm install
npm start
```

صفحه تست خرید: `/pay`

## متغیرهای محیط

| متغیر | توضیح |
| --- | --- |
| `PORT` | پورت سرور (پیش‌فرض ۳۰۰۰) |
| `PUBLIC_BASE_URL` | آدرس عمومی HTTPS برای `callbackUrl` |
| `MYKET_PACKAGE_NAME` | نام پکیج اپ |
| `MYKET_ACCESS_TOKEN` | توکن صحت‌سنجی پنل (هدر `X-Access-Token`) |
| `MYKET_PUBLIC_KEY` | کلید عمومی Base64 برای تایید امضای invoice |
| `MYKET_AUTO_CONSUME` | بعد از Verify موفق Consume شود (`true`/`false`) |

`callbackUrl` باید از اینترنت در دسترس باشد. روی لوکال از تونل (مثل Cloudflare Tunnel) استفاده کنید.

## API

- `POST /api/myket/start` `{ skuId, developerPayload? }` → `{ url }`
- `GET /api/myket/start?skuId=GEM2` — ریدایرکت مستقیم به صفحه مایکت
- `POST /myket-callback` — کال‌بک مرورگر مایکت
- `POST /api/myket/verify` `{ skuId, tokenId }`
- `POST /api/myket/consume` `{ skuId, token }`
- `GET /health`
