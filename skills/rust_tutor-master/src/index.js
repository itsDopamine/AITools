#!/usr/bin/env node

/**
 * Rust Tutor Agent - 主程序
 * 直接调用 cursor-agent，在 book 目录下工作
 */

import { spawn } from 'child_process';
import { config } from './config.js';
import { checkBookDirectory } from './book-manager.js';
import { commandExists } from './cursor-cli.js';
import { colors } from './book-manager.js';

console.log(colors.bold(colors.blue('\n🦀 Rust 专家来了，请直接提问 Rust 相关问题\n')));

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 检查 cursor-agent 是否安装
    if (!commandExists(config.cursorCommand)) {
      console.error(colors.red(`❌ 错误: 未找到 ${config.cursorCommand} 命令\n`));
      console.log(colors.yellow('请先运行初始化命令:'));
      console.log(colors.yellow('  rust-tutor setup\n'));
      process.exit(1);
    }

    // 2. 检查 book 目录是否存在
    if (!checkBookDirectory()) {
      console.error(colors.red(`❌ 错误: 找不到教程目录 ${config.bookPath}\n`));
      console.log(colors.yellow('请先运行初始化命令:'));
      console.log(colors.yellow('  rust-tutor setup\n'));
      process.exit(1);
    }

    // console.log(colors.green('✓ 环境检查通过'));
    // console.log(colors.gray(`  工作目录: ${config.bookPath}`));
    // console.log(colors.gray(`  AI 命令: ${config.cursorCommand}\n`));

    console.log(colors.blue('🎓 启动 Cursor Cli...'));
    console.log(colors.gray('提示: 你可以直接提问 Rust 相关问题，AI 会自动引用教程内容\n'));

    // 3. 在 book 目录下启动 cursor-agent
    const cursorProcess = spawn(config.cursorCommand, [], {
      cwd: config.bookPath,
      stdio: 'inherit',
      shell: true
    });

    // 处理退出
    cursorProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.error(colors.red(`\n❌ Cursor Agent 异常退出，退出码: ${code}\n`));
        process.exit(code);
      }
      console.log(colors.green('\n👋 加油！期待你多多思考，多多提问！\n'));
    });

    // 处理错误
    cursorProcess.on('error', (error) => {
      console.error(colors.red('\n❌ 启动失败:'), error.message);
      console.log(colors.yellow('\n💡 提示:'));
      console.log(colors.yellow(`  1. 确保 ${config.cursorCommand} 已正确安装`));
      console.log(colors.yellow('  2. 尝试重新运行: rust-tutor setup\n'));
      process.exit(1);
    });

    // 处理 Ctrl+C
    process.on('SIGINT', () => {
      console.log(colors.yellow('\n\n正在退出...\n'));
      cursorProcess.kill('SIGINT');
    });

  } catch (error) {
    console.error(colors.red('\n❌ 错误:'), error.message);
    process.exit(1);
  }
}

// 运行主函数
main();

