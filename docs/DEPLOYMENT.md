# 部署指南

## 📋 部署前准备

### 系统要求
- Node.js >= 18.0.0
- MySQL >= 8.0
- Nginx >= 1.18 (可选)

### 数据库准备
1. 创建数据库
```sql
CREATE DATABASE ynmy_bi_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 导入数据表结构（由数据中台提供）
3. 配置数据库用户权限

## 🚀 前端部署

### 1. 构建生产版本

```bash
# 安装依赖
npm install

# 构建静态文件
npm run build

# 生成的文件在 /out 目录
```

### 2. 部署到 Web 服务器

#### 方案A: Nginx 部署

**Nginx 配置示例** (`/etc/nginx/sites-available/bi-portal`):
```nginx
server {
    listen 80;
    server_name bi-portal.example.com;
    
    root /var/www/bi-portal;
    index index.html;
    
    # Gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json;
    gzip_min_length 1000;
    
    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理到后端
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**部署步骤**:
```bash
# 1. 复制构建文件
sudo cp -r out/* /var/www/bi-portal/

# 2. 设置权限
sudo chown -R www-data:www-data /var/www/bi-portal

# 3. 启用站点
sudo ln -s /etc/nginx/sites-available/bi-portal /etc/nginx/sites-enabled/

# 4. 测试配置
sudo nginx -t

# 5. 重启 Nginx
sudo systemctl restart nginx
```

#### 方案B: 作为 iframe 嵌入帆软平台

1. 将构建文件部署到帆软平台可访问的路径
2. 在帆软平台创建自定义门户页面
3. 使用 iframe 标签嵌入：
```html
<iframe 
  src="http://bi-portal.example.com" 
  width="100%" 
  height="100%" 
  frameborder="0"
></iframe>
```

## 🔧 后端部署

### 1. 准备服务器环境

```bash
# 安装 Node.js (使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 安装 PM2
npm install -g pm2
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，配置生产环境参数
```

**生产环境 .env 示例**:
```env
# 数据库配置
DB_HOST=192.168.1.100
DB_PORT=3306
DB_USER=bi_portal_user
DB_PASSWORD=strong_password_here
DB_NAME=ynmy_bi_portal

# 服务器配置
PORT=3000
HOST=0.0.0.0

# 帆软平台配置
FINE_REPORT_SERVER_PATH=http://finereport.internal.com
FINE_REPORT_ROOT_ID=decision-directory-root
FINE_REPORT_ROOT_NAME=根目录

# 环境
NODE_ENV=production
```

### 3. 使用 PM2 部署

**创建 PM2 配置文件** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'ynmy-bi-portal-backend',
    script: './src/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
  }]
};
```

**部署命令**:
```bash
# 安装依赖
npm install --production

# 启动服务
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup

# 查看状态
pm2 status

# 查看日志
pm2 logs ynmy-bi-portal-backend

# 重启服务
pm2 restart ynmy-bi-portal-backend
```

## 🔐 安全配置

### 1. 防火墙设置
```bash
# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # 如果后端直接暴露
sudo ufw enable
```

### 2. SSL 证书配置（可选）
```bash
# 使用 Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d bi-portal.example.com
```

### 3. 数据库安全
- 使用强密码
- 限制数据库访问IP
- 定期备份数据
- 启用慢查询日志

## 📊 监控和日志

### 1. PM2 监控
```bash
# 安装 PM2 监控模块
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 2. Nginx 日志
```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log
```

### 3. 应用监控
建议使用：
- PM2 Plus (性能监控)
- Sentry (错误追踪)
- ELK Stack (日志分析)

## 🔄 更新和回滚

### 更新流程
```bash
# 1. 备份当前版本
cp -r /var/www/bi-portal /var/www/bi-portal.backup

# 2. 拉取最新代码
git pull origin main

# 3. 前端构建
npm install
npm run build

# 4. 部署新版本
sudo cp -r out/* /var/www/bi-portal/

# 5. 后端更新
cd backend
npm install
pm2 restart ynmy-bi-portal-backend
```

### 回滚流程
```bash
# 1. 恢复备份
sudo rm -rf /var/www/bi-portal
sudo mv /var/www/bi-portal.backup /var/www/bi-portal

# 2. 重启服务
sudo systemctl restart nginx
pm2 restart ynmy-bi-portal-backend
```

## 🧪 部署验证

### 1. 健康检查
```bash
# 后端健康检查
curl http://localhost:3000/health

# 前端访问测试
curl http://bi-portal.example.com
```

### 2. 功能测试清单
- [ ] 首页加载正常
- [ ] 我的工作台数据显示
- [ ] 专题分析可点击下钻
- [ ] 制度公告列表加载
- [ ] 快捷入口链接可访问
- [ ] 报表字典筛选功能正常
- [ ] 搜索功能正常
- [ ] API 接口响应正常

## ⚠️ 常见问题

### Q1: 前端页面空白
- 检查 Nginx 配置是否正确
- 查看浏览器控制台错误
- 确认静态文件路径正确

### Q2: 后端连接失败
- 检查 PM2 状态：`pm2 status`
- 查看错误日志：`pm2 logs`
- 确认数据库连接正常

### Q3: API 跨域问题
- 确认后端 CORS 配置
- 检查 Nginx 代理配置

### Q4: 数据库连接超时
- 检查数据库连接池配置
- 增加连接超时时间
- 优化慢查询

## 📞 技术支持

如遇部署问题，请联系：
- 开发团队：dev@example.com
- 运维团队：ops@example.com
