# 依赖安装问题解决方案

## 问题：util-deprecate 模块错误

这是 Node.js 版本或依赖缓存导致的问题。

## 解决步骤

### 方法一：清理并重新安装（推荐）

```bash
# 1. 删除现有依赖
rm -rf node_modules package-lock.json

# 2. 清理 npm 缓存
npm cache clean --force

# 3. 重新安装
npm install
```

### 方法二：使用 pnpm（备选）

```bash
# 1. 安装 pnpm
npm install -g pnpm

# 2. 使用 pnpm 安装
pnpm install

# 3. 启动
pnpm dev
```

### 方法三：使用 yarn（备选）

```bash
# 1. 安装 yarn
npm install -g yarn

# 2. 使用 yarn 安装
yarn install

# 3. 启动
yarn dev
```

## Windows 用户特别说明

如果在 Windows 上遇到问题，请以**管理员身份**运行命令提示符或 PowerShell：

```powershell
# PowerShell (管理员)
Remove-Item -Recurse -Force node_modules, package-lock.json
npm cache clean --force
npm install
```

## 验证 Node.js 版本

确保您的 Node.js 版本 >= 18.0.0：

```bash
node --version
```

如果版本过低，请从 https://nodejs.org/ 下载最新的 LTS 版本。

## 仍然无法解决？

尝试以下步骤：

1. **更新 npm**
```bash
npm install -g npm@latest
```

2. **检查环境变量**
确保 NODE_PATH 和 PATH 配置正确

3. **使用 Node 版本管理器**
- Windows: nvm-windows
- Mac/Linux: nvm

4. **检查防火墙/代理**
如果在公司网络，可能需要配置 npm 代理

```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

## 联系我

如果问题依然存在，请提供：
1. Node.js 版本 (`node --version`)
2. npm 版本 (`npm --version`)
3. 操作系统版本
4. 完整的错误日志
