# Cấu hình CORS cho R2 (nếu upload trực tiếp từ trình duyệt)

Khi dùng **Upload file** trong dashboard, trình duyệt gửi request PUT lên URL của R2. Request đó là **cross-origin** (domain dashboard ≠ domain R2), nên bucket R2 phải khai báo CORS cho phép domain của bạn.

## Cách cấu hình trong Cloudflare

1. Vào **Cloudflare Dashboard** → **R2** → chọn **bucket** cần upload.
2. Kéo xuống mục **CORS Policy** → **Add CORS policy** (hoặc **Edit** nếu đã có).
3. Thêm rule, ví dụ:

**Development (chạy local):**
- **Allowed origins**: `http://localhost:3000` (hoặc port bạn chạy, ví dụ `http://127.0.0.1:3000`)
- **Allowed methods**: `GET`, `PUT`, `POST`, `DELETE`, `HEAD`
- **Allowed headers**: `*` hoặc ít nhất `Content-Type`
- **Expose headers**: (để trống hoặc tùy chọn)

**Production (domain thật):**
- **Allowed origins**: `https://your-domain.com` (thay bằng tên miền dashboard của bạn, không có dấu `/` cuối)
- Có thể thêm nhiều origin nếu bạn có nhiều domain (vd. `https://admin.your-domain.com`).

4. Lưu CORS policy.

## Lưu ý

- Bạn **phải khai báo đúng tên miền (origin)** nơi dashboard chạy. Ví dụ dashboard ở `https://drama.example.com` thì Allowed origins phải có `https://drama.example.com`.
- Nếu không cấu hình CORS, trình duyệt sẽ chặn request PUT lên R2 và upload sẽ lỗi (chỉ thấy .keep trong bucket).

## Cách khác: Upload qua server (đã dùng mặc định — không cần CORS)

**Dashboard hiện dùng upload qua server**: khi bấm "Upload file", trình duyệt gửi file lên API **`/api/dashboard/r2/upload`** (cùng domain với dashboard), server nhận file và dùng SDK upload lên R2. Request từ browser chỉ tới domain của bạn, **không gửi trực tiếp tới R2**, nên **bạn không cần cấu hình CORS** trên bucket. Upload sẽ hoạt động bình thường mà không cần khai báo tên miền trong R2.
