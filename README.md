# Game Hub Arena - Sòng Bài & Game Bài Trực Tuyến P2P

Cổng game bài đa nền tảng (máy tính, tablet, điện thoại), chơi cùng bạn bè ở các máy khác nhau qua Internet, miễn phí, nhờ **WebRTC (PeerJS)** kết hợp **GitHub Pages**.

---

## 📦 Chuẩn bị (làm một lần)

1. Tài khoản GitHub: https://github.com/signup
2. Cài **Git**: https://git-scm.com/downloads (kiểm tra bằng `git --version`)
3. Cài **Node.js 20 trở lên**: https://nodejs.org (kiểm tra bằng `node -v`)

---

## 🚀 Đưa web lên GitHub Pages

### Bước 1: Tạo repo trống trên GitHub
1. Vào https://github.com/new
2. **Repository name**: ví dụ `game-hub-arena`
3. Chọn **Public** (GitHub Pages miễn phí yêu cầu repo Public; repo Private cần gói trả phí)
4. **Không** tích "Add a README", "Add .gitignore" hay "license" (repo phải trống)
5. Bấm **Create repository**

### Bước 2: Đẩy mã nguồn lên
Giải nén dự án, mở terminal trong thư mục đó và chạy:

```bash
git init
git add .
git commit -m "first commit: game hub arena"
git branch -M main
git remote add origin https://github.com/<tai-khoan>/<ten-repo>.git
git push -u origin main
```

Thay `<tai-khoan>` và `<ten-repo>` bằng thông tin thật của bạn.

> **Khi `git push` hỏi mật khẩu:** GitHub không còn nhận mật khẩu tài khoản. Hãy dùng **Personal Access Token**:
> GitHub → avatar → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token, tích quyền `repo` và `workflow`, rồi dán token vào ô "password".
> Hoặc cài **GitHub Desktop** (https://desktop.github.com) để đẩy code bằng giao diện, không cần gõ lệnh.

### Bước 3: Bật GitHub Pages
1. Vào repo → **Settings** → **Pages** (menu bên trái)
2. Mục **Build and deployment** → **Source**: chọn **GitHub Actions**
3. Vào tab **Actions** của repo, workflow **Deploy Game Hub to GitHub Pages** sẽ tự chạy (khoảng 1-2 phút). Dấu ✅ xanh nghĩa là xong.
4. Link web của bạn:

```
https://<tai-khoan>.github.io/<ten-repo>/
```

Nếu Actions báo lỗi ở bước đầu, vào **Settings → Actions → General → Workflow permissions** và chọn **Read and write permissions**, sau đó bấm **Re-run all jobs**.

### Cập nhật web sau khi sửa code
Mỗi lần sửa xong, chỉ cần:

```bash
git add .
git commit -m "mô tả thay đổi"
git push
```

GitHub sẽ tự build và cập nhật lại web sau 1-2 phút.

---

## 🎮 Chơi cùng bạn bè

1. **Chủ phòng** mở link web, chọn game có phòng (**Tiến Lên Miền Nam**, **Poker Texas Hold'em**, **Lô Tô**) → **Tạo Phòng Mới** → nhận **mã phòng 6 chữ số**.
2. Gửi **link web + mã phòng** cho bạn bè qua Zalo/Messenger.
3. **Bạn bè** mở cùng link → **Tham Gia Phòng** → nhập mã → **Vào**.
4. Khi đèn tín hiệu P2P chuyển xanh lá là đã kết nối. Chủ phòng bấm **Bắt đầu chơi**.

**Lưu ý quan trọng:**
- **Chủ phòng không được đóng tab hoặc thoát trình duyệt**, vì chủ phòng chính là "máy chủ" của ván chơi. Nếu chủ phòng thoát, cả phòng sẽ mất kết nối.
- Tất cả mọi người nên dùng cùng một đường link.
- Nên để màn hình điện thoại luôn sáng khi chơi (điện thoại tắt màn hình có thể làm mất kết nối).

---

## ⚠️ Giới hạn khi chạy trên GitHub Pages

GitHub Pages chỉ host **file tĩnh**, nên file `server.ts` (Express) **không chạy** trên đó. Hệ quả:

| Tính năng | Trên GitHub Pages |
|---|---|
| Tạo phòng / vào phòng bằng mã 6 số (P2P) | ✅ Hoạt động |
| Game 1 người (Quay hũ, Xì dách, Roulette, Cào thẻ...) | ✅ Hoạt động |
| Tài khoản & số chip | ⚠️ Chỉ lưu trong trình duyệt của từng máy (xóa dữ liệu trình duyệt là mất) |
| Danh sách phòng đang mở, danh sách người chơi toàn hệ thống | ❌ Không có (cần `server.ts`) |
| Trang Admin cấp chip / xóa người chơi giữa các máy | ❌ Không đồng bộ giữa các máy |

**Có thể không kết nối được** nếu một trong hai người dùng mạng 4G/5G của một số nhà mạng hoặc Wi-Fi công ty/trường học (do NAT chặt). Dự án hiện chỉ dùng máy chủ STUN miễn phí, chưa có TURN. Cách khắc phục nhanh: đổi sang Wi-Fi, hoặc thử bật/tắt chế độ máy bay để đổi IP.

Nếu cần đủ tính năng (danh sách phòng, admin đồng bộ), hãy host cả `server.ts` trên dịch vụ chạy Node.js như Render, Railway hoặc Fly.io (lệnh build `npm install && npm run build`, lệnh chạy `npm start`).

---

## 🔒 Bảo mật khi để repo Public

- Tài khoản admin được **viết thẳng trong mã nguồn** (`src/logic/auth.ts`), ai xem repo cũng thấy. Hãy **đổi mật khẩu admin** trước khi đẩy lên nếu bạn không muốn người lạ vào trang quản trị.
- **Không commit** file `.env` thật (đã được `.gitignore` chặn). Đừng dán khóa API vào mã nguồn.
- Chip trong game chỉ là điểm ảo để giải trí, không đổi được thành tiền thật.

---

## 🛠️ Chạy thử trên máy của bạn

```bash
npm install
npm run dev      # chạy cả web và server tại http://localhost:3000
npm run build    # build bản tĩnh vào thư mục dist/
```

## 🧰 Xử lý lỗi thường gặp

| Lỗi | Cách xử lý |
|---|---|
| Vào link bị lỗi 404 | Chưa bật Pages: Settings → Pages → Source = **GitHub Actions**; chờ Actions chạy xong |
| Actions fail ở bước `npm ci` | Đảm bảo file `package-lock.json` đã được commit (đã có sẵn trong bản này) |
| Trang trắng sau khi deploy | Mở F12 → Console xem lỗi; bấm Ctrl+F5 để xóa cache |
| `git push` bị từ chối (rejected) | Repo đã có file sẵn: chạy `git pull origin main --rebase` rồi `git push` |
| Bạn vào phòng mãi không được | Kiểm tra mã phòng, chủ phòng còn mở tab không, thử đổi sang Wi-Fi |

## Công nghệ
Vite 8 + React 19 + TypeScript, Tailwind CSS 4, PeerJS (WebRTC), Web Audio API.
