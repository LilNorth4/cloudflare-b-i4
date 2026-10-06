# CloudShop AI — Web bán hàng chạy hoàn toàn trên Cloudflare

Project này gồm:

- **Frontend:** HTML/CSS/JavaScript, deploy bằng **Cloudflare Workers Static Assets**
- **Backend:** **Python Worker**
- **Database:** **Cloudflare D1**
- **Chatbot:** **Cloudflare Workers AI**
- **Một lần deploy:** frontend + Python API + AI cùng một Worker/URL

Chatbot có thể hỏi bằng ngôn ngữ tự nhiên về:
- sản phẩm, giá, tồn kho;
- thông số và so sánh sản phẩm;
- gợi ý sản phẩm theo nhu cầu;
- giao hàng, đổi trả, bảo hành, thanh toán;
- các chính sách có trong D1/web.

---

## 1. Cấu trúc project

```text
cloudflare-shop-ai/
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
├─ src/
│  └─ entry.py
├─ schema.sql
├─ wrangler.toml
├─ pyproject.toml
└─ README.md
```

---

# PHẦN A — CÀI MÔI TRƯỜNG

## Bước 1 — Tạo tài khoản Cloudflare

Truy cập Cloudflare, đăng ký/đăng nhập tài khoản.

Bạn không cần VPS.

## Bước 2 — Cài Node.js

Cài Node.js bản LTS.

Kiểm tra:

```bash
node -v
npm -v
```

## Bước 3 — Cài uv cho Python

Cloudflare Python Workers dùng `uv`/`pywrangler` để quản lý môi trường Python.

### Windows PowerShell

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Sau đó đóng và mở Terminal mới.

Kiểm tra:

```bash
uv --version
```

## Bước 4 — Đăng nhập Cloudflare bằng Wrangler

Đứng trong thư mục project:

```bash
npx wrangler login
```

Trình duyệt mở ra -> đăng nhập Cloudflare -> chọn **Allow**.

Kiểm tra tài khoản:

```bash
npx wrangler whoami
```

---

# PHẦN B — TẠO DATABASE D1

## Bước 5 — Tạo D1

Chạy:

```bash
npx wrangler d1 create cloudflare-shop-db --location=apac
```

Wrangler sẽ trả về `database_id`.

Nếu Wrangler hỏi có tự thêm binding vào config không, project này đã có binding sẵn,
vì vậy có thể chọn **No** rồi copy `database_id`.

Mở file:

```text
wrangler.toml
```

Tìm:

```toml
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

thay bằng ID thật, ví dụ:

```toml
database_id = "12345678-abcd-...."
```

## Bước 6 — Tạo bảng và dữ liệu trên D1 production

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --file=./schema.sql
```

Kiểm tra:

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --command="SELECT id,name,price FROM products;"
```

Bạn phải nhìn thấy danh sách sản phẩm.

## Bước 7 — Tạo dữ liệu D1 local để test

```bash
npx wrangler d1 execute cloudflare-shop-db --local --file=./schema.sql
```

---

# PHẦN C — HIỂU CÁC BINDING CLOUDFLARE

Mở `wrangler.toml`.

## 1. Static Assets

```toml
[assets]
directory = "./public"
binding = "ASSETS"
run_worker_first = ["/api/*"]
```

Ý nghĩa:
- file giao diện nằm trong `public`;
- đường dẫn `/api/*` chạy Python trước;
- file HTML/CSS/JS được Cloudflare phục vụ như static assets.

## 2. Workers AI

```toml
[ai]
binding = "AI"
```

Trong Python gọi bằng:

```python
await self.env.AI.run(...)
```

Không cần nhét API key AI vào JavaScript frontend.

## 3. D1

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudflare-shop-db"
database_id = "..."
```

Trong Python gọi bằng:

```python
self.env.DB
```

---

# PHẦN D — CHẠY LOCAL

## Bước 8 — Cài môi trường Python của project

Chạy:

```bash
uv sync
```

## Bước 9 — Chạy Worker local

```bash
uv run pywrangler dev
```

Nếu terminal báo địa chỉ, thông thường là:

```text
http://localhost:8787
```

Mở trình duyệt và vào địa chỉ đó.

### Test API health

```text
http://localhost:8787/api/health
```

Kết quả mong muốn:

```json
{
  "ok": true,
  "service": "cloudflare-shop-ai",
  "runtime": "Python Worker"
}
```

### Test sản phẩm

```text
http://localhost:8787/api/products
```

Nếu có JSON sản phẩm là D1 binding đã hoạt động.

> Workers AI có thể gọi tài nguyên Cloudflare thật ngay cả khi dev local và có thể tính usage.

---

# PHẦN E — DEPLOY TẤT CẢ LÊN CLOUDFLARE

## Bước 10 — Deploy

Chạy:

```bash
uv run pywrangler deploy
```

Nếu project của bạn không có package Python ngoài runtime, bạn cũng có thể thử:

```bash
npx wrangler deploy
```

Sau khi thành công, terminal trả về URL dạng:

```text
https://cloudflare-shop-ai.<ten-subdomain>.workers.dev
```

Mở URL đó.

Bạn phải thấy:
- trang bán hàng;
- sản phẩm lấy từ D1;
- giỏ hàng;
- chính sách;
- nút **Hỏi AI**;
- chatbot hỏi được giá/sản phẩm/chính sách.

---

# PHẦN F — CÁCH CHATBOT HOẠT ĐỘNG

Luồng dữ liệu:

```text
Người dùng
    ↓
Chat box trong app.js
    ↓ POST /api/chat
Python Worker (src/entry.py)
    ↓
Đọc products + policies từ D1
    ↓
Ghép dữ liệu làm context
    ↓
Workers AI
    ↓
Câu trả lời tiếng Việt
    ↓
Chat box
```

Điểm quan trọng:
- AI không nhận câu trả lời cứng.
- Người dùng có thể hỏi tự nhiên.
- Prompt yêu cầu AI chỉ trả lời dựa vào dữ liệu của shop.
- Nếu dữ liệu không có, AI được yêu cầu nói shop chưa có thông tin.

Ví dụ:

```text
Laptop nào phù hợp sinh viên?
```

```text
Điện thoại nào đang giảm giá?
```

```text
Tôi mua tai nghe mà bị lỗi thì có đổi được không?
```

```text
Shop bảo hành phụ kiện bao lâu?
```

```text
Tôi cần thiết bị dưới 10 triệu để học online, nên mua gì?
```

---

# PHẦN G — THÊM SẢN PHẨM

Có 2 cách.

## Cách 1 — sửa schema.sql và tạo lại database demo

Phù hợp lúc làm bài tập.

## Cách 2 — INSERT trực tiếp

Ví dụ:

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --command="INSERT INTO products (name,category,price,old_price,stock,short_description,description,specs,badge,icon) VALUES ('Sản phẩm mới','Phụ kiện',500000,NULL,10,'Mô tả ngắn','Mô tả chi tiết','Thông số','Mới','📦');"
```

Sau đó reload website.

Chatbot cũng thấy dữ liệu mới vì nó đọc D1 khi có câu hỏi.

---

# PHẦN H — THÊM/SỬA CHÍNH SÁCH

Ví dụ sửa đổi trả:

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --command="UPDATE policies SET content='Nội dung mới...' WHERE slug='returns';"
```

Reload web.

Chatbot sẽ dùng chính sách mới.

---

# PHẦN I — CUSTOM DOMAIN (TÙY CHỌN)

Sau khi deploy:

1. Cloudflare Dashboard
2. Workers & Pages
3. Chọn Worker `cloudflare-shop-ai`
4. Settings / Domains & Routes
5. Add Custom Domain
6. Chọn domain đang quản lý trong Cloudflare

Ví dụ:

```text
shop.tenmiencuaban.com
```

Không cần sửa code frontend vì API dùng đường dẫn tương đối `/api/...`.

---

# PHẦN J — NẾU THẦY HỎI "TẠI SAO KHÔNG CẦN API KEY TRONG CODE?"

Do app dùng **Cloudflare Bindings**.

`AI`, `DB`, `ASSETS` được Cloudflare cấp quyền trực tiếp cho Worker.

Vì vậy:
- frontend không giữ secret;
- không cần đưa token Cloudflare vào JavaScript;
- binding an toàn và đơn giản hơn gọi REST API từ browser.

---

# PHẦN K — NẾU THẦY HỎI "ĐÂY CÓ PHẢI RAG KHÔNG?"

Bản demo hiện tại là dạng **grounded context / retrieval từ D1**:

1. đọc dữ liệu thật từ D1;
2. đưa dữ liệu vào context;
3. LLM sinh câu trả lời chỉ dựa trên context.

Với vài chục/vài trăm sản phẩm, cách này dễ làm và dễ bảo vệ.

Khi dữ liệu rất lớn, nâng cấp thành RAG đầy đủ:

```text
D1/R2 → embeddings → Cloudflare Vectorize → similarity search → Workers AI
```

Lúc đó chỉ lấy top sản phẩm/chính sách liên quan thay vì đưa toàn bộ database vào prompt.

---

# PHẦN L — CÂU TRÌNH BÀY NGẮN VỚI GIẢNG VIÊN

Bạn có thể trình bày:

> Hệ thống của em chạy hoàn toàn trên Cloudflare. Giao diện được deploy bằng Workers Static Assets. Backend dùng Cloudflare Python Workers. Dữ liệu sản phẩm và chính sách lưu trên D1. Khi người dùng hỏi bằng ngôn ngữ tự nhiên, Python Worker lấy dữ liệu từ D1 làm context rồi gửi sang Workers AI. AI được ràng buộc chỉ trả lời theo dữ liệu shop, sau đó kết quả được trả về chat box. Các dịch vụ được kết nối bằng Cloudflare bindings nên không cần để API key trong frontend.

---

# XỬ LÝ LỖI THƯỜNG GẶP

## `database_id` chưa đúng

Mở `wrangler.toml` và thay:

```text
REPLACE_WITH_D1_DATABASE_ID
```

bằng ID thật.

## `/api/products` lỗi "no such table"

Chưa chạy schema.

Remote:

```bash
npx wrangler d1 execute cloudflare-shop-db --remote --file=./schema.sql
```

Local:

```bash
npx wrangler d1 execute cloudflare-shop-db --local --file=./schema.sql
```

## `wrangler login` không mở được

Thử:

```bash
npx wrangler whoami
```

Nếu chưa đăng nhập, chạy lại `npx wrangler login`.

## Chatbot lỗi nhưng sản phẩm vẫn chạy

Kiểm tra binding:

```toml
[ai]
binding = "AI"
```

và log Worker trong Cloudflare Dashboard.

## Deploy Python bị lỗi môi trường

Kiểm tra:

```bash
uv --version
node -v
npx wrangler --version
```

Sau đó:

```bash
uv sync
uv run pywrangler deploy
```

---

## Lưu ý demo

- Giỏ hàng dùng `localStorage`.
- Nút thanh toán chưa kết nối payment gateway.
- Project tập trung vào yêu cầu: web bán hàng + Python + chatbot natural language + product/policy QA + Cloudflare.
