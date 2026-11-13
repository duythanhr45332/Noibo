# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG ERP-AM (DEPLOYMENT GUIDE)

## 1. Cấu hình Port (Chạy song song không đụng độ)

| Môi trường | Database (PostgreSQL) | Backend API (`/api`) | Frontend Web (`/web`) |
| :--- | :--- | :--- | :--- |
| **Local Dev** | `localhost:5433` (`erp_am_db`) | `http://localhost:8081` | `http://localhost:3001` |
| **Develop (`docker-compose.develop.yml`)** | Host DB | `5094` | `5095` |
| **Production (`docker-compose.deploy.yml`)** | Host DB | `5092` | `5093` |

---

## 2. Khởi chạy Môi trường Local Development

### Bước 1: Khởi động PostgreSQL Container
```bash
docker-compose up -d
```

### Bước 2: Cài đặt, Migrate & Seed dữ liệu chuẩn cho Backend (`/api`)
```bash
cd api
npm install
npm run migrate
npm run seed
npm run gen:swagger
npm run dev
```
- Tài khoản Quản trị viên mặc định sau khi seed:
  - **Username:** `admin_root`
  - **Password:** `Admin123@`

### Bước 3: Cài đặt, Sinh Orval Hooks & Chạy Frontend (`/web`)
```bash
cd web
npm install
npm run gen-api
npm run dev
```
- Truy cập giao diện tại: `http://localhost:3001`
- Truy cập tài liệu Swagger tại: `http://localhost:8081/api-docs`
