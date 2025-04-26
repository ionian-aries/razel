#!/usr/bin/env node
"use strict";

// 核心模块导入
import chokidar from "chokidar";
import fs from "fs"; // 文件系统操作
import url from "url"; // URL 解析
import path from "path"; // 路径处理
import { program } from "commander"; // 命令行参数解析库

// 路径初始化
const __filename = url.fileURLToPath(import.meta.url); // 获取当前文件绝对路径
const __dirname = path.dirname(__filename); // 当前文件所在目录
const ROOT_PATH = path.resolve(__dirname, "../"); // 项目根目录路径

// 任务队列（核心功能模块）
const missions = [
  // 任务1: 版本显示
  (options = {}) => {
    const file = path.resolve(ROOT_PATH, "./package.json");
    const json = fs.readFileSync(file, "utf8"); // 同步读取package.json
    const { version } = JSON.parse(json);
    options?.version && console.log(version); // 带-v参数时输出版本号
  },

  // 任务2: 插件创建（核心功能）
  (options = {}) => {
    const { name, port, dir } = options;
    if (name !== "syncSourceMapUrl") return; // 无项目名称时退出

    // 定义锁文件路径
    const lockFilePath = path.resolve(ROOT_PATH, `.${name}_${port}_${dir}.lock`);

    // 检查锁文件是否存在
    if (fs.existsSync(lockFilePath)) {
      console.log("检测到其他终端正在运行本程序，本次执行退出！");
      return;
    }

    // 创建锁文件
    try {
      fs.writeFileSync(lockFilePath, 'locked');
    } catch (err) {
      console.error(`创建锁文件时出错: ${err}`);
      return;
    }

    const targetFile = path.resolve(ROOT_PATH, dir, "index.js"); // 目标文件路径
    // 判断文件是否存在
    if (!fs.existsSync(targetFile)) {
      console.log(`文件不存在: ${targetFile}`);
      // 删除锁文件
      fs.unlinkSync(lockFilePath);
      return;
    }
    // 定义一个标志位，用于避免自身修改触发事件
    let isSelfModifying = false;
    // 防抖定时器
    let debounceTimer;
    // 防抖时间（毫秒）
    const debounceTime = 200;

    const targetStr = "sourceMappingURL=index.js.map"; // 目标字符串
    const replaceStr = `sourceMappingURL=http://127.0.0.1:${port}/${dir}/index.js.map`;

    // 首次执行时检查并替换
    try {
      let data = fs.readFileSync(targetFile, "utf8");
      if (data.includes(targetStr)) {
        const result = data.replaceAll(targetStr, replaceStr);
        if (result !== data) {
          fs.writeFileSync(targetFile, result, "utf8");
          console.log(`首次执行，sourcemap地址同步成功!`);
        }
      }
    } catch (err) {
      console.error(`首次执行时出错: ${err}`);
      // 删除锁文件
      fs.unlinkSync(lockFilePath);
      return;
    }

    // 初始化文件监听
    const watcher = chokidar.watch(targetFile, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on("change", (path) => {
      if (isSelfModifying) return;
      // 清除之前的定时器
      clearTimeout(debounceTimer);

      // 设置新的定时器
      debounceTimer = setTimeout(() => {
        console.log(`🔍 检测到变化: ${path}`);
        fs.readFile(path, "utf8", (err, data) => {
          if (err) throw err;

          if (data.includes(targetStr)) {
            const result = data.replaceAll(targetStr, replaceStr);
            // 检查文件内容是否真的发生了变化
            if (result !== data) {
              isSelfModifying = true;
              fs.writeFile(path, result, "utf8", (err) => {
                if (err) throw err;
                console.log(`sourcemap地址同步成功!`);
                isSelfModifying = false;
              });
            } else {
              console.log(`文件内容未改变，无需更新~`);
            }
          } else {
            console.log(`未找到sourcemap地址!`);
          }
        });
      }, debounceTime);
    });

    console.log(`👀监听文件: ${targetFile}`);

    // 监听 SIGINT 信号
    process.on("SIGINT", () => {
      try {
        let data = fs.readFileSync(targetFile, "utf8");
        if (data.includes(replaceStr)) {
          const result = data.replaceAll(replaceStr, targetStr);
          fs.writeFileSync(targetFile, result, "utf8");
          console.log(`程序退出，已将 sourcemap 地址恢复为原始值~`);
        }
        // 关闭文件监听
        watcher.close();
        // 删除锁文件
        fs.unlinkSync(lockFilePath);
        process.exit();
      } catch (err) {
        console.error(`程序退出时出错: ${err}`);
        // 删除锁文件
        try {
          fs.unlinkSync(lockFilePath);
        } catch (unlinkErr) {
          console.error(`删除锁文件时出错: ${unlinkErr}`);
        }
        process.exit(1);
      }
    });

    // 监听正常退出事件
    process.on("exit", () => {
      try {
        fs.unlinkSync(lockFilePath);
      } catch (err) {
        console.error(`删除锁文件时出错: ${err}`);
      }
    });
  },
];

// 任务执行器
const run = (name, options = {}) => {
  const merged = { name, ...options }; // 合并参数
  missions.forEach((mission) => mission?.(merged)); // 顺序执行所有任务
};

// 命令行配置（commander）
program
  .name("razel") // 命令名称
  .arguments("[name]") // 命令参数
  .allowUnknownOption() // 允许未知参数
  .option("-v, --version", "显示版本号") // 版本显示
  .option("-p, --port <number>", "设置开发端口", "8080") // 端口配置
  .option("-d, --dir <string>", "设置源码目录", "dist-theme") // 目录配置
  .action(run) // 绑定执行函数
  .parse(process.argv);
