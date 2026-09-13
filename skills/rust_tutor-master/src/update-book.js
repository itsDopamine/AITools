#!/usr/bin/env node

import { syncRustBook } from './book-manager.js';
import { colors } from './book-manager.js';

console.log(colors.bold(colors.blue('\n📚 更新 Rust 官方教程\n')));

/**
 * 主函数
 */
async function main() {
  try {
    // 同步 book 仓库（克隆或更新）
    await syncRustBook();
    
    console.log(colors.bold(colors.green('🎉 完成！\n')));
    
  } catch (error) {
    console.error(colors.red('\n❌ 操作失败:'), error.message);
    console.log(colors.yellow('\n💡 提示: 请确保：'));
    console.log(colors.yellow('  1. 已安装 git'));
    console.log(colors.yellow('  2. 网络连接正常'));
    console.log(colors.yellow('  3. 有权限访问 GitHub\n'));
    process.exit(1);
  }
}

// 运行主函数
main();
