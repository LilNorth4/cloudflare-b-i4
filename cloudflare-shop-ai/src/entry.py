from workers import WorkerEntrypoint, Response
from urllib.parse import urlparse

MODEL = "@cf/google/gemma-4-26b-a4b-it"


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        url = urlparse(request.url)
        path = url.path

        try:
            # ---------------- API: health ----------------
            if path == "/api/health":
                return Response.json(
                    {
                        "ok": True,
                        "service": "cloudflare-shop-ai",
                        "runtime": "Python Worker",
                    }
                )

            # ---------------- API: products ----------------
            if path == "/api/products" and request.method == "GET":
                result = await self.env.DB.prepare(
                    """
                    SELECT id, name, category, price, old_price, stock,
                           short_description, description, specs, badge, icon
                    FROM products
                    ORDER BY id ASC
                    """
                ).run()
                return Response.json(result.results)

            # ---------------- API: policies ----------------
            if path == "/api/policies" and request.method == "GET":
                result = await self.env.DB.prepare(
                    """
                    SELECT id, slug, title, content
                    FROM policies
                    ORDER BY id ASC
                    """
                ).run()
                return Response.json(result.results)

            # ---------------- API: natural-language chatbot ----------------
            if path == "/api/chat":
                if request.method != "POST":
                    return Response.json(
                        {"error": "Method not allowed. Use POST."},
                        status=405,
                    )

                body = await request.json()
                message = (body.get("message") or "").strip()

                if not message:
                    return Response.json(
                        {"error": "Bạn chưa nhập câu hỏi."},
                        status=400,
                    )

                if len(message) > 1200:
                    return Response.json(
                        {"error": "Câu hỏi quá dài. Tối đa 1200 ký tự."},
                        status=400,
                    )

                # Với shop nhỏ, lấy toàn bộ dữ liệu sản phẩm/chính sách làm context.
                # Khi dữ liệu lớn, có thể nâng cấp bước này sang Vectorize/RAG.
                product_context = await self.env.DB.prepare(
                    """
                    SELECT group_concat(
                        'SẢN PHẨM: ' || name ||
                        ' | Danh mục: ' || category ||
                        ' | Giá: ' || price || ' VND' ||
                        ' | Giá cũ: ' || COALESCE(old_price, '') ||
                        ' | Tồn kho: ' || stock ||
                        ' | Mô tả ngắn: ' || short_description ||
                        ' | Chi tiết: ' || description ||
                        ' | Thông số: ' || specs,
                        char(10)
                    ) AS context
                    FROM products
                    """
                ).first("context")

                policy_context = await self.env.DB.prepare(
                    """
                    SELECT group_concat(
                        'CHÍNH SÁCH: ' || title || ' | ' || content,
                        char(10)
                    ) AS context
                    FROM policies
                    """
                ).first("context")

                system_prompt = f"""
Bạn là trợ lý bán hàng của CloudShop.

NHIỆM VỤ:
- Trả lời bằng tiếng Việt tự nhiên, ngắn gọn, thân thiện.
- Chỉ sử dụng dữ liệu sản phẩm và chính sách được cung cấp bên dưới.
- Có thể so sánh sản phẩm, tư vấn theo nhu cầu, giải thích giá, tồn kho, thông số.
- Có thể trả lời câu hỏi về đổi trả, bảo hành, giao hàng, thanh toán.
- Không tự bịa thông tin. Nếu dữ liệu không có, hãy nói rõ:
  "Shop chưa có thông tin này trong hệ thống."
- Khi nói giá, hãy định dạng tiền Việt dễ đọc.
- Nếu khách hỏi sản phẩm phù hợp, giải thích lý do dựa trên dữ liệu.

=== DỮ LIỆU SẢN PHẨM ===
{product_context or "Chưa có dữ liệu sản phẩm."}

=== CHÍNH SÁCH SHOP ===
{policy_context or "Chưa có dữ liệu chính sách."}
""".strip()

                ai_result = await self.env.AI.run(
                    MODEL,
                    {
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": message},
                        ],
                        "chat_template_kwargs": {
                            "enable_thinking": False
                        },
                    },
                )

                # Trả nguyên response Workers AI.
                # Frontend hỗ trợ cả dạng response và choices[0].message.content.
                return Response.json(ai_result)

            # Nếu không phải /api/* thì phục vụ file HTML/CSS/JS trong public/.
            return await self.env.ASSETS.fetch(request)

        except Exception as exc:
            # Không trả stack trace ra client.
            return Response.json(
                {
                    "error": "Có lỗi khi xử lý yêu cầu.",
                    "detail": str(exc),
                },
                status=500,
            )
