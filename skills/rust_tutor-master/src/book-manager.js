/**
 * Book 仓库管理模块
 * 提供克隆和更新 Rust Book 的核心功能
 */

import { spawn } from 'child_process';
import fs from 'fs';
import { config } from './config.js';

// 颜色输出工具
export const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
};

/**
 * 检查 book 目录是否存在
 */
export function checkBookDirectory() {
  return fs.existsSync(config.bookPath);
}

/**
 * 克隆 Rust Book 仓库
 */
export async function cloneRustBook() {
  console.log(colors.blue('📚 正在克隆 Rust 官方教程仓库...\n'));
  
  return new Promise((resolve, reject) => {
    const args = [
      'clone',
      `--depth=${config.gitCloneOptions.depth}`,
      config.bookGitUrl,
      config.bookPath
    ];
    
    const cloneProcess = spawn('git', args, {
      stdio: 'inherit'
    });
    
    cloneProcess.on('close', (code) => {
      if (code === 0) {
        console.log(colors.green('\n✓ Rust 官方教程克隆成功\n'));
        resolve(true);
      } else {
        console.error(colors.red('\n❌ 克隆失败\n'));
        reject(new Error(`克隆失败，退出码: ${code}`));
      }
    });
    
    cloneProcess.on('error', (error) => {
      console.error(colors.red('\n❌ 克隆过程出错:\n'), error.message);
      reject(error);
    });
  });
}

/**
 * 更新 book 目录
 */
export async function updateRustBook() {
  console.log(colors.blue('🔄 正在更新 Rust 官方教程...\n'));
  
  return new Promise((resolve, reject) => {
    const pullProcess = spawn('git', ['pull', 'origin', 'main'], {
      cwd: config.bookPath,
      stdio: 'inherit'
    });
    
    pullProcess.on('close', (code) => {
      if (code === 0) {
        console.log(colors.green('\n✓ Rust 官方教程更新成功\n'));
        resolve(true);
      } else {
        console.error(colors.red('\n❌ 更新失败\n'));
        reject(new Error(`更新失败，退出码: ${code}`));
      }
    });
    
    pullProcess.on('error', (error) => {
      console.error(colors.red('\n❌ 更新过程出错:\n'), error.message);
      reject(error);
    });
  });
}

/**
 * 复制 .cursorrules 到 book 目录
 */
export async function copyCursorRules() {
  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  const sourceRules = path.join(__dirname, '../.cursorrules');
  const targetRules = path.join(config.bookPath, '.cursorrules');
  
  try {
    // 检查源文件是否存在
    await fs.access(sourceRules);
    
    // 复制文件
    await fs.copyFile(sourceRules, targetRules);
    console.log(colors.green('✓ .cursorrules 已复制到 book 目录\n'));
  } catch (error) {
    console.log(colors.yellow('⚠️  未找到 .cursorrules 文件，跳过复制\n'));
  }
}

/**
 * 同步 book 仓库（如果存在则更新，不存在则克隆）
 */
export async function syncRustBook() {
  console.log(colors.blue('📋 检查 Rust 官方教程目录...'));
  const bookExists = checkBookDirectory();
  
  if (bookExists) {
    console.log(colors.green('✓ book 目录已存在\n'));
    await updateRustBook();
  } else {
    console.log(colors.yellow('⚠️  book 目录不存在\n'));
    await cloneRustBook();
  }
  
  // 复制 .cursorrules 文件
  await copyCursorRules();
}

