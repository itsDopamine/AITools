/**
 * Cursor CLI 管理模块
 * 提供检测和安装 Cursor CLI 的功能
 */

import { execSync, spawn } from 'child_process';
import { config } from './config.js';
import { colors } from './book-manager.js';

/**
 * 检查命令是否存在
 */
export function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查 Cursor CLI 是否安装
 */
export function checkCursorCLI() {
  console.log(colors.blue(`📋 检查 Cursor CLI (${config.cursorCommand})...`));
  
  if (commandExists(config.cursorCommand)) {
    console.log(colors.green('✓ Cursor CLI 已安装\n'));
    return true;
  }
  
  console.log(colors.yellow('⚠️  Cursor CLI 未安装\n'));
  return false;
}

/**
 * 安装 Cursor CLI
 */
export async function installCursorCLI() {
  console.log(colors.blue('📥 正在安装 Cursor CLI...\n'));
  
  return new Promise((resolve, reject) => {
    // 使用 curl 下载并执行安装脚本
    const installProcess = spawn('bash', ['-c', 
      'curl -fsSL https://download.cursor.sh/cli/install.sh | bash'
    ], {
      stdio: 'inherit',
      shell: true
    });
    
    installProcess.on('close', (code) => {
      if (code === 0) {
        console.log(colors.green('\n✓ Cursor CLI 安装成功\n'));
        resolve(true);
      } else {
        console.error(colors.red('\n❌ Cursor CLI 安装失败\n'));
        reject(new Error(`安装失败，退出码: ${code}`));
      }
    });
    
    installProcess.on('error', (error) => {
      console.error(colors.red('\n❌ 安装过程出错:\n'), error.message);
      reject(error);
    });
  });
}

/**
 * 确保 Cursor CLI 已安装
 */
export async function ensureCursorCLI() {
  const cursorInstalled = checkCursorCLI();
  
  if (!cursorInstalled) {
    console.log(colors.yellow('需要安装 Cursor CLI 才能继续。'));
    console.log(colors.yellow('将执行安装命令: curl -fsSL https://download.cursor.sh/cli/install.sh | bash\n'));
    
    await installCursorCLI();
    
    // 验证安装
    if (!commandExists(config.cursorCommand)) {
      console.error(colors.red(`❌ Cursor CLI (${config.cursorCommand}) 安装后仍无法使用，请检查 PATH 环境变量`));
      console.log(colors.yellow('💡 提示: 你可能需要重新打开终端窗口\n'));
      throw new Error('Cursor CLI 安装失败');
    }
  }
}

