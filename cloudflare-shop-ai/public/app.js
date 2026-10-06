const state = {
  products: [],
  policies: [],
  category: "Tất cả",
  cart: JSON.parse(localStorage.getItem("cloudshop_cart") || "[]"),
};

const money = value =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value || 0));

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

async function getJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadData() {
  try {
    const [products, policies] = await Promise.all([
      getJson("/api/products"),
      getJson("/api/policies")
    ]);
    state.products = products;
    state.policies = policies;
    renderFilters();
    renderProducts();
    renderPolicies();
    renderCart();
  } catch (err) {
    $("#productsGrid").innerHTML = `<div class="loading-card">Không tải được dữ liệu. Hãy kiểm tra D1/schema và Worker.<br><small>${escapeHtml(err.message)}</small></div>`;
    $("#policyGrid").innerHTML = `<div class="loading-card">Không tải được chính sách.</div>`;
  }
}

function renderFilters() {
  const categories = ["Tất cả", ...new Set(state.products.map(p => p.category))];
  $("#filters").innerHTML = categories.map(cat => `
    <button class="filter ${cat === state.category ? "active" : ""}" data-category="${escapeHtml(cat)}">
      ${escapeHtml(cat)}
    </button>
  `).join("");

  $$("#filters .filter").forEach(btn => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.category;
      renderFilters();
      renderProducts();
    });
  });
}

function renderProducts() {
  const rows = state.category === "Tất cả"
    ? state.products
    : state.products.filter(p => p.category === state.category);

  $("#productsGrid").innerHTML = rows.map(p => `
    <article class="product-card">
      <div class="product-art">
        ${p.badge ? `<div class="badge">${escapeHtml(p.badge)}</div>` : ""}
        <span>${escapeHtml(p.icon || "📦")}</span>
      </div>
      <div class="product-body">
        <div class="category">${escapeHtml(p.category)}</div>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.short_description)}</p>
        <p class="stock">Còn ${Number(p.stock)} sản phẩm</p>
        <div class="price-row">
          <div class="price">${money(p.price)}</div>
          ${p.old_price ? `<div class="old-price">${money(p.old_price)}</div>` : ""}
        </div>
        <div class="card-actions">
          <button class="button primary add-btn" data-id="${p.id}">Thêm vào giỏ</button>
          <button class="ask-btn" data-ask="${escapeHtml(p.name)}" title="Hỏi AI về sản phẩm">✦</button>
        </div>
      </div>
    </article>
  `).join("");

  $$(".add-btn").forEach(btn => btn.addEventListener("click", () => addToCart(Number(btn.dataset.id))));
  $$(".ask-btn").forEach(btn => btn.addEventListener("click", () => {
    openChat();
    const q = `Cho tôi thông tin chi tiết về ${btn.dataset.ask}. Sản phẩm này phù hợp với ai?`;
    $("#chatInput").value = q;
    $("#chatInput").focus();
  }));
}

function renderPolicies() {
  $("#policyGrid").innerHTML = state.policies.map(p => `
    <article class="policy-card">
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.content)}</p>
    </article>
  `).join("");
}

function saveCart() {
  localStorage.setItem("cloudshop_cart", JSON.stringify(state.cart));
  renderCart();
}

function addToCart(id) {
  const existing = state.cart.find(x => x.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ id, qty: 1 });
  saveCart();
  openCart();
}

function removeFromCart(id) {
  state.cart = state.cart.filter(x => x.id !== id);
  saveCart();
}

function renderCart() {
  const items = state.cart.map(row => {
    const p = state.products.find(x => Number(x.id) === Number(row.id));
    return p ? { ...row, product: p } : null;
  }).filter(Boolean);

  const count = items.reduce((sum, x) => sum + x.qty, 0);
  const total = items.reduce((sum, x) => sum + Number(x.product.price) * x.qty, 0);

  $("#cartCount").textContent = count;
  $("#cartTotal").textContent = money(total);

  $("#cartItems").innerHTML = items.length ? items.map(x => `
    <div class="cart-item">
      <div class="cart-icon">${escapeHtml(x.product.icon || "📦")}</div>
      <div>
        <strong>${escapeHtml(x.product.name)}</strong>
        <small>${x.qty} × ${money(x.product.price)}</small>
      </div>
      <button class="remove" data-remove="${x.product.id}">Xóa</button>
    </div>
  `).join("") : `<div class="empty">Giỏ hàng đang trống.</div>`;

  $$("[data-remove]").forEach(btn =>
    btn.addEventListener("click", () => removeFromCart(Number(btn.dataset.remove)))
  );
}

function openCart() {
  $("#cartDrawer").classList.add("open");
  $("#cartOverlay").classList.add("open");
  $("#cartDrawer").setAttribute("aria-hidden", "false");
}
function closeCart() {
  $("#cartDrawer").classList.remove("open");
  $("#cartOverlay").classList.remove("open");
  $("#cartDrawer").setAttribute("aria-hidden", "true");
}

function openChat() {
  $("#chatPanel").classList.add("open");
  $("#chatPanel").setAttribute("aria-hidden", "false");
  setTimeout(() => $("#chatInput").focus(), 80);
}
function closeChat() {
  $("#chatPanel").classList.remove("open");
  $("#chatPanel").setAttribute("aria-hidden", "true");
}

function addMessage(text, role, extraClass = "") {
  const div = document.createElement("div");
  div.className = `message ${role} ${extraClass}`.trim();
  div.textContent = text;
  $("#messages").appendChild(div);
  $("#messages").scrollTop = $("#messages").scrollHeight;
  return div;
}

function extractAiText(data) {
  if (!data) return "Shop chưa nhận được phản hồi từ AI.";
  if (typeof data.response === "string") return data.response;
  if (typeof data.result?.response === "string") return data.result.response;
  if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (typeof data.text === "string") return data.text;
  return "AI đã phản hồi nhưng giao diện chưa nhận diện được định dạng dữ liệu.";
}

async function askAI(question) {
  addMessage(question, "user");
  const typing = addMessage("Đang tra cứu sản phẩm và chính sách…", "bot", "typing");

  try {
    const data = await getJson("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question })
    });
    typing.remove();
    addMessage(extractAiText(data), "bot");
  } catch (err) {
    typing.remove();
    addMessage(`Không thể trả lời lúc này: ${err.message}`, "bot");
  }
}

$("#chatForm").addEventListener("submit", async e => {
  e.preventDefault();
  const input = $("#chatInput");
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  await askAI(q);
});

$$(".suggestions button").forEach(btn => btn.addEventListener("click", async () => {
  const q = btn.textContent.trim();
  await askAI(q);
}));

$("#cartButton").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#cartOverlay").addEventListener("click", closeCart);

$("#chatFab").addEventListener("click", openChat);
$("#closeChat").addEventListener("click", closeChat);
$("#heroChat").addEventListener("click", openChat);
$("#ctaChat").addEventListener("click", openChat);

loadData();
