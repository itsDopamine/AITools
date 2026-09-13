#!/usr/bin/env node

/**
 * Rust Tutor - 全局 CLI 入口
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析命令行参数
const args = process.argv.slice(2);
const command = args[0];

// 命令映射
const commands = {
  'setup': join(__dirname, '../src/setup.js'),
  'update': join(__dirname, '../src/update-book.js'),
  'start': join(__dirname, '../src/index.js'),
  'ask': join(__dirname, '../src/index.js'),
};

// 显示帮助信息
function showHelp() {
  console.log(`
🦀 Rust Tutor - Rust 学习专家

用法:
  rust-tutor <command> [options]

命令:
  setup          初始化环境（安装 Cursor CLI + 克隆教程）
  update         更新 Rust 官方教程
  start, ask     启动 Rust 专家问答（默认命令）
  help           显示此帮助信息

示例:
  rust-tutor setup       # 首次使用，初始化环境
  rust-tutor             # 开始提问
  rust-tutor ask         # 开始提问（同上）
  rust-tutor update      # 更新教程内容

环境变量:
  RUST_BOOK_GIT_URL      Git 仓库地址
  RUST_BOOK_PATH         Book 目录路径
  CURSOR_COMMAND         Cursor CLI 命令名

更多信息: https://ksogitlab.wps.kingsoft.net/inner-source/individual/rust_tutor
`);
}

// 执行命令
function runCommand(scriptPath) {
  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    shell: false
  });

  child.on('error', (error) => {
    console.error('执行失败:', error.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code || 0);
  });
}

// 主逻辑
if (!command || command === 'ask' || command === 'start') {
  // 默认启动问答
  runCommand(commands['start']);
} else if (command === 'help' || command === '-h' || command === '--help') {
  showHelp();
} else if (commands[command]) {
  runCommand(commands[command]);
} else {
  console.error(`❌ 未知命令: ${command}`);
  console.log('运行 "rust-tutor help" 查看可用命令\n');
  process.exit(1);
}

