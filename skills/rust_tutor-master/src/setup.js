#!/usr/bin/env node

import { ensureCursorCLI } from './cursor-cli.js';
import { syncRustBook } from './book-manager.js';
import { colors } from './book-manager.js';

console.log(colors.bold(colors.blue('\n🚀 Rust Tutor Agent 初始化\n')));

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 确保 Cursor CLI 已安装
    await ensureCursorCLI();
    
    // 2. 同步 book 仓库（克隆或更新）
    await syncRustBook();
    
    // 3. 完成
    console.log(colors.bold(colors.green('🎉 初始化完成！\n')));
    console.log(colors.blue('现在你可以使用以下命令开始学习：'));
    console.log(colors.yellow('  rust-tutor        - 启动 Rust 专家'));
    console.log(colors.yellow('  rust-tutor update - 更新教程内容\n'));
    
  } catch (error) {
    console.error(colors.red('\n❌ 初始化失败:'), error.message);
    process.exit(1);
  }
}

// 运行主函数
main();

