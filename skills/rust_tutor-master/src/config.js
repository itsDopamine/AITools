/**
 * Rust Tutor Agent 配置文件
 * 
 * 你可以根据需要修改这些配置项
 */

import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取默认的 book 目录路径
 * 优先级：环境变量 > 用户主目录 > 项目目录
 */
function getDefaultBookPath() {
  if (process.env.RUST_BOOK_PATH) {
    return process.env.RUST_BOOK_PATH;
  }
  
  // 如果是全局安装，使用用户主目录
  // 检测是否在 node_modules 中（全局安装）
  if (__dirname.includes('node_modules')) {
    return path.join(os.homedir(), '.rust-tutor', 'book');
  }
  
  // 本地开发，使用项目目录
  return path.join(__dirname, '../book');
}

export const config = {
  // Rust Book Git 仓库地址
  bookGitUrl: process.env.RUST_BOOK_GIT_URL || 'https://github.com/rust-lang/book.git',
  
  // Book 目录路径
  bookPath: getDefaultBookPath(),
  
  // Cursor CLI 命令名称
  cursorCommand: process.env.CURSOR_COMMAND || 'cursor-agent',
  
  // Git clone 选项
  gitCloneOptions: {
    // 使用浅克隆，只获取最新的提交历史，大幅减少下载时间和空间占用
    depth: 1,
  },
};

/**
 * 获取完整配置信息（用于调试）
 */
export function getConfigInfo() {
  return {
    'Git 仓库地址': config.bookGitUrl,
    'Book 目录': config.bookPath,
    'Cursor 命令': config.cursorCommand,
    'Git 克隆深度': config.gitCloneOptions.depth,
  };
}

