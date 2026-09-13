# 安装指南

## 📦 安装方式

### 方式一：从 npm 安装（推荐）

```bash
npm install -g @ksxz/rust-tutor
```

安装后可以在任何目录使用 `rust-tutor` 命令。

### 方式二：从源码安装

```bash
# 克隆仓库
git clone git@ksogitlab.wps.kingsoft.net:inner-source/individual/rust_tutor.git
cd rust-tutor

# 使用 npm scripts
npm run setup
npm start
```

## 🚀 首次使用

安装后，需要先初始化环境：

```bash
rust-tutor setup
```

这个命令会：

1. 检测并安装 Cursor CLI（如果未安装）
2. 克隆 Rust 官方教程到 `~/.rust-tutor/book`
3. 配置 AI 导师规则

**预计时间**: 2-5 分钟（取决于网络速度）

## 💡 使用

初始化完成后，直接运行：

```bash
rust-tutor
```

或者：

```bash
rust-tutor ask
```

## 🔄 更新教程

定期更新教程内容：

```bash
rust-tutor update
```

## 🗑️ 卸载

### 卸载 npm 包

```bash
npm uninstall -g @ksxz/rust-tutor
```

### 清理数据

如果想完全清理，删除数据目录：

```bash
rm -rf ~/.rust-tutor
```

## 🔧 故障排除

### 命令未找到

如果安装后提示 `rust-tutor: command not found`：

1. 检查 npm 全局目录是否在 PATH 中：

```bash
npm config get prefix
```

2. 将 npm 全局目录添加到 PATH：

```bash
# 在 ~/.bashrc 或 ~/.zshrc 中添加
export PATH="$PATH:$(npm config get prefix)/bin"
```

3. 重新加载配置：

```bash
source ~/.bashrc  # 或 source ~/.zshrc
```

### cursor-agent 未找到

运行初始化命令：

```bash
rust-tutor setup
```

如果仍然失败，手动安装 Cursor CLI：

```bash
curl -fsSL https://download.cursor.sh/cli/install.sh | bash
```

### 网络问题

如果在国内遇到网络问题，可以配置镜像：

```bash
export RUST_BOOK_GIT_URL="https://gitee.com/your-mirror/book.git"
rust-tutor setup
```

### 权限问题

如果遇到权限错误，尝试：

```bash
# 方式一：使用 sudo（不推荐）
sudo npm install -g @ksxz/rust-tutor

# 方式二：配置 npm 使用用户目录（推荐）
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g @ksxz/rust-tutor
```

## 📍 数据位置

### 全局安装

- **Book 目录**: `~/.rust-tutor/book`
- **配置文件**: `~/.rust-tutor/book/.cursorrules`

### 本地开发

- **Book 目录**: `./book`（项目目录下）
- **配置文件**: `./book/.cursorrules`

## ⚙️ 自定义配置

通过环境变量自定义：

```bash
# 自定义 book 目录
export RUST_BOOK_PATH="/path/to/your/book"

# 自定义 Git 仓库
export RUST_BOOK_GIT_URL="https://your-mirror.com/book.git"

# 自定义 Cursor 命令
export CURSOR_COMMAND="cursor-agent"

# 重新初始化
rust-tutor setup
```

## 🆘 获取帮助

```bash
rust-tutor help
```

或访问：

- GitHub Issues: https://github.com/your-username/rust-tutor/issues
- 文档: https://github.com/your-username/rust-tutor
