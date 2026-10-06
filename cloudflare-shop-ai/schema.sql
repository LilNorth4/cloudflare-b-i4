DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS policies;

CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    old_price INTEGER,
    stock INTEGER NOT NULL DEFAULT 0,
    short_description TEXT NOT NULL,
    description TEXT NOT NULL,
    specs TEXT NOT NULL,
    badge TEXT,
    icon TEXT
);

CREATE TABLE policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL
);

INSERT INTO products
(name, category, price, old_price, stock, short_description, description, specs, badge, icon)
VALUES
(
    'CloudPhone X1',
    'Điện thoại',
    12990000,
    14990000,
    18,
    'Điện thoại 5G, màn hình OLED 120Hz, pin 5000mAh.',
    'Mẫu điện thoại cân bằng cho học tập, công việc và giải trí. Hỗ trợ 5G, camera chống rung quang học và sạc nhanh.',
    'Màn hình OLED 6.7 inch 120Hz; RAM 8GB; ROM 256GB; Pin 5000mAh; Sạc nhanh 67W; Camera chính 50MP OIS; 5G',
    'Bán chạy',
    '📱'
),
(
    'CloudBook Air 14',
    'Laptop',
    18990000,
    20990000,
    9,
    'Laptop mỏng nhẹ 14 inch dành cho học tập và văn phòng.',
    'Thiết kế nhẹ, pin lâu, phù hợp sinh viên, nhân viên văn phòng và người thường xuyên di chuyển.',
    'Màn hình 14 inch 2.2K; CPU 8 nhân; RAM 16GB; SSD 512GB; Wi-Fi 6E; Khối lượng 1.25kg; Pin tối đa 14 giờ',
    'Mới',
    '💻'
),
(
    'CloudBuds Pro',
    'Âm thanh',
    2490000,
    2990000,
    34,
    'Tai nghe true wireless có chống ồn chủ động ANC.',
    'Tai nghe nhỏ gọn, phù hợp nghe nhạc, gọi điện và làm việc tại nơi đông người.',
    'ANC; Xuyên âm; Bluetooth 5.4; 6 mic; Pin tổng 30 giờ; Chống nước IPX4; Sạc USB-C',
    '-17%',
    '🎧'
),
(
    'CloudWatch S',
    'Đồng hồ',
    3990000,
    4490000,
    21,
    'Đồng hồ thông minh theo dõi sức khỏe và luyện tập.',
    'Theo dõi nhịp tim, SpO2, giấc ngủ, thông báo điện thoại và hơn 100 chế độ luyện tập.',
    'AMOLED 1.43 inch; GPS; Nhịp tim; SpO2; 5ATM; Pin 10 ngày; Bluetooth Calling',
    'Ưu đãi',
    '⌚'
),
(
    'CloudPad 11',
    'Máy tính bảng',
    8990000,
    9990000,
    12,
    'Máy tính bảng 11 inch cho học online, ghi chú và giải trí.',
    'Màn hình lớn, bốn loa, hỗ trợ bút cảm ứng và bàn phím rời. Phù hợp học sinh, sinh viên.',
    'Màn hình 11 inch 2.5K 120Hz; RAM 8GB; ROM 256GB; Pin 8600mAh; 4 loa; Hỗ trợ bút cảm ứng',
    'Học tập',
    '📝'
),
(
    'CloudCharge 65W',
    'Phụ kiện',
    690000,
    790000,
    56,
    'Củ sạc GaN 65W nhỏ gọn, hỗ trợ laptop và điện thoại.',
    'Một củ sạc cho nhiều thiết bị, có hai cổng USB-C và một cổng USB-A.',
    'GaN 65W; USB-C x2; USB-A x1; PD 3.0; PPS; Điện áp 100-240V',
    'Tiện lợi',
    '🔌'
);

INSERT INTO policies (slug, title, content) VALUES
(
    'shipping',
    'Chính sách giao hàng',
    'Shop giao hàng toàn quốc. Nội thành dự kiến 1-2 ngày làm việc, tỉnh thành khác dự kiến 2-5 ngày làm việc. Đơn từ 1.000.000 VND được miễn phí giao hàng tiêu chuẩn.'
),
(
    'returns',
    'Chính sách đổi trả',
    'Khách hàng được yêu cầu đổi trả trong 7 ngày kể từ khi nhận hàng nếu sản phẩm lỗi kỹ thuật, giao sai sản phẩm hoặc sản phẩm chưa qua sử dụng và còn đầy đủ phụ kiện, hộp, tem.'
),
(
    'warranty',
    'Chính sách bảo hành',
    'Sản phẩm điện tử chính được bảo hành 12 tháng. Phụ kiện được bảo hành 6 tháng. Bảo hành không áp dụng với hư hỏng do rơi vỡ, vào nước sai tiêu chuẩn hoặc tự ý sửa chữa.'
),
(
    'payment',
    'Chính sách thanh toán',
    'Shop hỗ trợ thanh toán khi nhận hàng đối với đơn đủ điều kiện, chuyển khoản ngân hàng và thanh toán trực tuyến. Với đơn giá trị cao, shop có thể xác nhận lại thông tin trước khi giao.'
),
(
    'privacy',
    'Chính sách bảo mật',
    'Thông tin khách hàng chỉ được sử dụng để xử lý đơn hàng, hỗ trợ sau bán hàng và cải thiện dịch vụ. Shop không công khai thông tin cá nhân cho bên thứ ba nếu không có căn cứ hợp lệ.'
);
