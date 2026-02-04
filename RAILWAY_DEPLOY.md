# Railway 部署指南

## 📋 前置要求

1. 已将代码推送到GitHub（✅ 已完成）
2. Railway账号
3. PostgreSQL数据库（Railway会自动创建）

## 🚀 部署步骤

### 1. 连接GitHub仓库到Railway

1. 访问 [Railway](https://railway.app/)
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 授权Railway访问你的GitHub账号
5. 选择 `jackylk/company-tracker` 仓库

### 2. 添加PostgreSQL数据库

1. 在Railway项目中，点击 "+ New"
2. 选择 "Database" → "PostgreSQL"
3. Railway会自动创建数据库并生成连接URL
4. 数据库会自动注入 `DATABASE_URL` 环境变量

### 3. 配置环境变量

在Railway项目的Variables标签页中添加以下环境变量：

```bash
# JWT密钥（必须修改为随机字符串）
JWT_SECRET=your-random-secret-key-change-this-to-something-secure

# Deepseek API配置
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# SearXNG搜索引擎
SEARXNG_BASE_URL=https://searx.be

# 管理员用户名（多个用逗号分隔）
ADMIN_USERNAMES=admin

# PostgreSQL数据库URL（Railway自动注入，无需手动设置）
DATABASE_URL=（由Railway自动设置）
```

### 4. 配置构建命令

Railway通常会自动检测Next.js项目，但你可以在 `railway.toml` 或Settings中确认：

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start"
```

### 5. 运行数据库迁移

⚠️ **重要：数据库迁移**

由于我们修改了数据库schema（添加username字段），需要运行迁移：

**方法1：通过Railway CLI**
```bash
# 安装Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 链接到你的项目
railway link

# 运行迁移
railway run npx prisma migrate deploy
```

**方法2：在Railway的部署日志中**

Railway在部署时会自动运行package.json中的`postinstall`脚本。确保你的package.json包含：

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

然后手动触发数据库重置（仅开发环境！）：
```bash
railway run npx prisma migrate reset --force
```

或者推送新的迁移：
```bash
railway run npx prisma migrate deploy
```

### 6. 验证部署

1. 部署完成后，Railway会提供一个公共URL
2. 访问该URL，应该能看到登录页面
3. 尝试注册一个新账户（使用用户名而不是邮箱）
4. 如果用户名是 `admin`，会自动获得管理员权限

## 🔧 常见问题

### Q: 数据库迁移失败？

A: 如果是新数据库，运行：
```bash
railway run npx prisma migrate deploy
```

如果数据库已有旧数据，需要先备份数据，然后重置：
```bash
railway run npx prisma migrate reset --force
```

### Q: 应用无法启动？

A: 检查：
1. 环境变量是否正确设置
2. DATABASE_URL是否正确
3. 构建日志中的错误信息

### Q: 无法连接数据库？

A: 确保：
1. PostgreSQL服务正在运行
2. DATABASE_URL格式正确
3. Railway项目中的数据库服务和应用服务在同一个项目中

## 📱 移动端测试

部署完成后，用手机浏览器访问Railway提供的URL，测试：

✅ 表单输入触摸友好（最小44px高度）
✅ 按钮大小适中（最小44px高度）
✅ 文章列表在移动端显示为卡片视图
✅ 文字大小适合阅读

## 🔐 安全提示

1. **必须修改JWT_SECRET**为随机字符串
2. 不要在公共仓库中暴露敏感环境变量
3. 定期更新依赖包
4. 使用强密码（虽然系统允许简单密码）

## 📊 数据库Schema变更

本次部署包含以下schema变更：

- `users`表添加`username`字段（unique，非空）
- `users`表的`email`字段改为可选
- JWT Payload使用`username`代替`email`
- 管理员验证使用`ADMIN_USERNAMES`环境变量

## 🎉 部署成功后

1. 访问应用URL
2. 注册一个用户名为`admin`的账号，自动获得管理员权限
3. 开始使用公司调研系统！

---

如有问题，请查看Railway部署日志或联系开发者。
