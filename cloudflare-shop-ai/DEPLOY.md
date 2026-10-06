# Hướng dẫn triển khai CloudShop AI lên Cloudflare

Tài liệu mô tả từng bước đưa CloudShop AI (web bán hàng + chatbot) từ máy cá nhân lên hạ tầng Cloudflare, kèm kết quả thực tế của lần triển khai ngày 06/10/2026.

| Thông tin | Giá trị |
|---|---|
| URL production | https://cloudflare-shop-ai.baccop4.workers.dev |
| Tên Worker | `cloudflare-shop-ai` |
| Database D1 | `cloudflare-shop-db` (vùng APAC) |
| Mô hình AI | `@cf/google/gemma-4-26b-a4b-it` (Workers AI) |
| Mã nguồn | https://github.com/LilNorth4/cloudflare-b-i4 |

## Mục lục

1. [Kiến trúc triển khai](#1-kiến-trúc-triển-khai)
2. [Yêu cầu tiền đề (Prerequisites)](#2-yêu-cầu-tiền-đề-prerequisites)
3. [Bước 1: Đăng nhập & Xác thực Cloudflare](#3-bước-1-đăng-nhập--xác-thực-cloudflare)
4. [Bước 2: Khởi tạo Database Cloudflare D1 (Remote)](#4-bước-2-khởi-tạo-database-cloudflare-d1-remote)
5. [Bước 3: Cấu hình `wrangler.toml`](#5-bước-3-cấu-hình-wranglertoml)
6. [Bước 4: Nạp Schema & Dữ liệu mẫu vào D1 Production](#6-bước-4-nạp-schema--dữ-liệu-mẫu-vào-d1-production)
7. [Bước 5: Đồng bộ môi trường Python](#7-bước-5-đồng-bộ-môi-trường-python)
8. [Bước 6: Thực hiện Deploy lên Cloudflare](#8-bước-6-thực-hiện-deploy-lên-cloudflare)
9. [Bước 7: Kiểm thử & Nghiệm thu sau khi Deploy](#9-bước-7-kiểm-thử--nghiệm-thu-sau-khi-deploy)
10. [Bước 8: Cấu hình Tên miền riêng (Custom Domain - Tùy chọn)](#10-bước-8-cấu-hình-tên-miền-riêng-custom-domain---tùy-chọn)
11. [Vận hành & Cập nhật dữ liệu từ xa](#11-vận-hành--cập-nhật-dữ-liệu-từ-xa)
12. [Xử lý sự cố thường gặp (Troubleshooting)](#12-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. Kiến trúc triển khai

Toàn bộ ứng dụng chạy trong **một Cloudflare Worker duy nhất**, không cần VPS hay máy chủ riêng:

```text
                 https://cloudflare-shop-ai.baccop4.workers.dev
                                   │
                    ┌──────────────┴──────────────┐
                    │      Cloudflare Worker      │
                    │                             │
   /, /app.js, ...  │  Static Assets (public/)    │  HTML / CSS / JS
                    │                             │
   /api/*           │  Python Worker              │
                    │  (src/entry.py)             │
                    └──────┬───────────────┬──────┘
                           │ env.DB        │ env.AI
                    ┌──────▼─────┐   ┌─────▼──────────┐
                    │ D1 (SQLite)│   │  Workers AI    │
                    │ products   │   │  Gemma 4 26B   │
                    │ policies   │   │                │
                    └────────────┘   └────────────────┘
```

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Frontend | Workers Static Assets | Phục vụ `index.html`, `styles.css`, `app.js` |
| Backend | Python Worker (Pyodide) | Xử lý `/api/health`, `/api/products`, `/api/policies`, `/api/chat` |
| Database | Cloudflare D1 | Lưu bảng `products` và `policies` |
| Chatbot | Workers AI | Sinh câu trả lời dựa trên dữ liệu đọc từ D1 |

Cấu hình `run_worker_first = ["/api/*"]` đảm bảo chỉ các request `/api/*` đi vào mã Python; các file tĩnh được Cloudflare trả trực tiếp từ edge.

## 2. Yêu cầu tiền đề (Prerequisites)

| Công cụ | Phiên bản đã dùng | Cài đặt (Windows) |
|---|---|---|
| Tài khoản Cloudflare | Free plan | https://dash.cloudflare.com/sign-up |
| Node.js (kèm `npx`) | 24.19.0 LTS | `winget install OpenJS.NodeJS.LTS` |
| uv (quản lý Python) | 0.12.23 | `winget install astral-sh.uv` |
| Wrangler | 4.147.0 | `npm install` (khai báo trong `package.json`) |
| Git | bất kỳ | https://git-scm.com |

Mọi lệnh bên dưới chạy trong thư mục `cloudflare-shop-ai/` (thư mục chứa `wrangler.toml`).

Sau khi cài, **mở terminal mới** để nhận PATH, rồi cài Wrangler cho project và kiểm tra:

```bash
npm install
node -v
uv --version
npx wrangler --version
```

`npm install` cài Wrangler vào `node_modules/` theo `package.json`; `npx wrangler` sẽ dùng bản này. `package.json` cũng có sẵn các lệnh tắt:

| Lệnh tắt | Tương đương |
|---|---|
| `npm run dev` | `wrangler dev` |
| `npm run deploy` | `wrangler deploy` |
| `npm run db:local` | nạp `schema.sql` vào D1 local |
| `npm run db:remote` | nạp `schema.sql` vào D1 production |

## 3. Bước 1: Đăng nhập & Xác thực Cloudflare

```bash
npx wrangler login
```

Trình duyệt mở trang Cloudflare → đăng nhập → bấm **Allow**. Trang chỉ chờ khoảng 2 phút, quá thời gian sẽ báo `Timed out waiting for authorization code` và phải chạy lại.

Kiểm tra:

```bash
npx wrangler whoami
```

Kết quả đúng hiển thị email và **Account ID** của tài khoản. Account ID này dùng lại ở mục 11.

## 4. Bước 2: Khởi tạo Database Cloudflare D1 (Remote)

```bash
npx wrangler d1 create cloudflare-shop-db --location=apac
```

Kết quả thực tế:

```text
✅ Successfully created DB 'cloudflare-shop-db' in region APAC
[[d1_databases]]
binding = "cloudflare_shop_db"
database_name = "cloudflare-shop-db"
database_id = "9fbc7a51-f944-487f-a0f6-a8fbfad76b0a"
```

Ghi lại `database_id`. **Không** dùng tên binding `cloudflare_shop_db` mà Wrangler gợi ý, vì mã Python gọi database qua tên `DB` (xem bước 3).

## 5. Bước 3: Cấu hình `wrangler.toml`

```toml
name = "cloudflare-shop-ai"
main = "src/entry.py"
compatibility_date = "2026-10-05"
compatibility_flags = ["python_workers"]

[assets]
directory = "./public"
binding = "ASSETS"
run_worker_first = ["/api/*"]

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "cloudflare-shop-db"
database_id = "9fbc7a51-f944-487f-a0f6-a8fbfad76b0a"

[observability]
enabled = true
```

| Khóa | Ý nghĩa |
|---|---|
| `compatibility_flags = ["python_workers"]` | Bật runtime Python |
| `[assets]` | Phục vụ thư mục `public/`, ưu tiên Worker cho `/api/*` |
| `[ai] binding = "AI"` | Python gọi `self.env.AI.run(...)`, không cần API key trong code |
| `[[d1_databases]] binding = "DB"` | Python gọi `self.env.DB` |
| `database_id` | **Phải** là ID của database trong chính tài khoản đang deploy |
| `[observability]` | Bật log để xem trên dashboard |

## 6. Bước 4: Nạp Schema & Dữ liệu mẫu vào D1 Production

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --file=./schema.sql
```

Kết quả thực tế:

```text
🚣 Executed 6 queries in 2.98ms (5 rows read, 25 rows written)
```

Kiểm tra dữ liệu:

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --command="SELECT id, name, price, stock FROM products;"
```

Phải thấy 6 sản phẩm (CloudPhone X1, ...). Bảng `policies` có 5 chính sách (giao hàng, đổi trả, bảo hành, thanh toán, ...).

> `schema.sql` có lệnh `DROP TABLE` ở đầu, nên chạy lại sẽ **xóa toàn bộ dữ liệu** và nạp lại dữ liệu mẫu.

Muốn chạy thử local trước khi deploy, nạp thêm vào D1 local:

```bash
npx wrangler d1 execute cloudflare-shop-db --local --file=./schema.sql
npx wrangler dev
```

Rồi mở http://localhost:8787.

## 7. Bước 5: Đồng bộ môi trường Python

```bash
uv sync
```

Lệnh tạo `.venv/` và cài công cụ phát triển (`workers-py`, `workers-runtime-sdk`) theo `pyproject.toml`/`uv.lock`. Project **không có thư viện Python ngoài** (`dependencies = []`), mã chỉ dùng thư viện chuẩn và API `workers` có sẵn trong runtime.

Vì vậy có thể deploy bằng `npx wrangler deploy` trực tiếp. `uv run pywrangler deploy` chỉ bắt buộc khi thêm package Python bên ngoài.

> **Windows:** nếu đường dẫn thư mục người dùng có dấu cách (ví dụ `C:\Users\Nitro 5`), `pywrangler` lỗi khi tạo môi trường Pyodide. Xem mục 12.

## 8. Bước 6: Thực hiện Deploy lên Cloudflare

```bash
npx wrangler deploy
```

Kết quả thực tế:

```text
✨ Success! Uploaded 3 files (0.97 sec)
Total Upload: 115.38 KiB / gzip: 31.54 KiB
Worker Startup Time: 776 ms
Your Worker has access to the following bindings:
Binding                              Resource
env.DB (cloudflare-shop-db)          D1 Database
env.AI                               AI
env.ASSETS                           Assets
Uploaded cloudflare-shop-ai (9.38 sec)
Deployed cloudflare-shop-ai triggers (1.05 sec)
  https://cloudflare-shop-ai.baccop4.workers.dev
Current Version ID: b48ac19c-a420-4207-9d01-929c65b7086b
```

Cần kiểm tra trong output: đủ 3 binding `DB`, `AI`, `ASSETS` và có URL `*.workers.dev`.

## 9. Bước 7: Kiểm thử & Nghiệm thu sau khi Deploy

| # | Kiểm thử | Lệnh / Thao tác | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|
| 1 | Trang chủ | Mở URL production | HTTP 200, hiện trang bán hàng | ✅ 200 |
| 2 | Health check | `GET /api/health` | `{"ok": true, ...}` | ✅ `{"ok": true, "service": "cloudflare-shop-ai", "runtime": "Python Worker"}` |
| 3 | Đọc D1 – sản phẩm | `GET /api/products` | Danh sách JSON | ✅ 6 sản phẩm |
| 4 | Đọc D1 – chính sách | `GET /api/policies` | Danh sách JSON | ✅ 5 chính sách |
| 5 | Chatbot – chính sách | Hỏi "Shop có giao hàng miễn phí không?" | Trả lời theo dữ liệu D1 | ✅ "đơn từ 1.000.000 VND được miễn phí giao hàng tiêu chuẩn" |
| 6 | Chatbot – sản phẩm | Hỏi "CloudPhone X1 giá bao nhiêu, còn hàng không?" | Đúng giá, tồn kho | ✅ 12.990.000đ, còn 18 chiếc |

Lệnh kiểm thử nhanh:

```bash
URL=https://cloudflare-shop-ai.baccop4.workers.dev
curl $URL/api/health
curl $URL/api/products
curl -X POST $URL/api/chat -H "Content-Type: application/json" \
     -d '{"message":"Shop có giao hàng miễn phí không?"}'
```

Trên giao diện: kiểm tra danh sách sản phẩm, giỏ hàng, mục chính sách và nút **Hỏi AI**.

## 10. Bước 8: Cấu hình Tên miền riêng (Custom Domain - Tùy chọn)

Yêu cầu: tên miền đã được thêm vào Cloudflare (nameserver trỏ về Cloudflare).

**Cách 1 – Dashboard:** Workers & Pages → `cloudflare-shop-ai` → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → nhập ví dụ `shop.tenmien.vn`.

**Cách 2 – `wrangler.toml`:**

```toml
routes = [
  { pattern = "shop.tenmien.vn", custom_domain = true }
]
```

Rồi chạy lại `npx wrangler deploy`. Cloudflare tự tạo bản ghi DNS và chứng chỉ SSL.

## 11. Vận hành & Cập nhật dữ liệu từ xa

**Cập nhật mã nguồn:** sửa code → `npx wrangler deploy` → đẩy code lên GitHub:

```bash
git add .
git commit -m "Mô tả thay đổi"
git push
```

**Thêm sản phẩm** (không cần deploy lại, chatbot dùng dữ liệu mới ngay):

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --command="INSERT INTO products (name, category, price, old_price, stock, short_description, description, specs, badge) VALUES ('Tên sản phẩm', 'Danh mục', 1000000, 1200000, 10, 'Mô tả ngắn', 'Mô tả chi tiết', 'Thông số', 'Mới');"
```

**Sửa tồn kho / giá:**

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --command="UPDATE products SET stock = 25, price = 12490000 WHERE id = 1;"
```

**Sửa chính sách:**

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --command="UPDATE policies SET content = 'Nội dung mới' WHERE slug = 'shipping';"
```

**Xem log thời gian thực:**

```bash
npx wrangler tail
```

**Xem lịch sử và quay lại phiên bản cũ:**

```bash
npx wrangler deployments list
npx wrangler rollback
```

**Tự động deploy khi push (tùy chọn):** repo có sẵn `.github/workflows/deploy.yml`. Account ID đã ghi sẵn trong file workflow; chỉ cần thêm 1 secret trong GitHub (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN`: tạo tại https://dash.cloudflare.com/profile/api-tokens, quyền *Account → Workers Scripts → Edit* và *Account → D1 → Edit*

Chưa thêm secret thì workflow báo lỗi nhưng không ảnh hưởng tới bản đang chạy.

## 12. Xử lý sự cố thường gặp (Troubleshooting)

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `wrangler dev` dừng với lỗi *"it's necessary to set a CLOUDFLARE_API_TOKEN"* | Chưa đăng nhập; binding Workers AI luôn gọi Cloudflare thật kể cả khi chạy local | Chạy `npx wrangler login` (bước 1) |
| `Timed out waiting for authorization code` | Không bấm **Allow** kịp trên trình duyệt | Chạy lại `npx wrangler login` và bấm Allow ngay |
| `uv run pywrangler dev/deploy` báo `'C:\Users\Nitro' is not recognized...` | Đường dẫn thư mục người dùng có dấu cách, wrapper Pyodide bị cắt đường dẫn | Dùng `npx wrangler dev` / `npx wrangler deploy` (project không có package ngoài nên không cần `pywrangler`) |
| Deploy báo không tìm thấy database / `database_id` sai | `database_id` thuộc tài khoản Cloudflare khác | `npx wrangler d1 list` để lấy ID đúng, sửa `wrangler.toml` |
| `/api/products` lỗi `no such table: products` | Chưa nạp schema vào D1 remote | Chạy lại bước 4 với cờ `--remote` |
| Local có dữ liệu nhưng production trống (hoặc ngược lại) | D1 local (`.wrangler/state`) và D1 remote là hai database tách biệt | Nạp `schema.sql` cho đúng môi trường (`--local` / `--remote`) |
| Sản phẩm hiển thị nhưng chatbot lỗi | Workers AI hết quota miễn phí hoặc tên model không còn hỗ trợ | Xem log bằng `npx wrangler tail`; kiểm tra `MODEL` trong `src/entry.py` |
| `git push` báo `403 Permission denied` | Tài khoản GitHub đang đăng nhập không có quyền ghi vào repo | Đổi remote sang repo của mình: `git remote set-url origin <url>` |
| GitHub Actions báo `Headers.set: "***" is an invalid header value` | Secret `CLOUDFLARE_API_TOKEN` bị dán thừa dòng hoặc khoảng trắng | Sửa secret, dán lại token đúng một dòng (dùng nút **Copy** trên trang Cloudflare) |
| GitHub Actions báo `Unexpected fields found in assets field: "run_worker_first"` | Workflow dùng Wrangler 3 thay vì bản 4 trong `package.json` | Chạy `npm ci` trước `npx wrangler deploy` trong workflow |
| Lệnh `node`/`npx`/`uv` không tìm thấy ngay sau khi cài | Terminal cũ chưa nhận PATH mới | Đóng và mở lại terminal / VS Code |
| Request đầu tiên sau deploy chậm hoặc trả về rỗng | Python Worker khởi động lần đầu (cold start) | Gọi lại sau vài giây |
