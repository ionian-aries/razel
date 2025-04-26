#!/usr/bin/env node
"use strict"

// 核心模块导入
import fs from "fs" // 文件系统操作
import url from "url" // URL 解析
import path from "path" // 路径处理
import { program } from "commander" // 命令行参数解析库

// 路径初始化
const __filename = url.fileURLToPath(
  import.meta.url
) // 获取当前文件绝对路径
const __dirname = path.dirname(__filename) // 当前文件所在目录
const ROOT_PATH = path.resolve(__dirname, "../") // 项目根目录路径

// 任务队列（核心功能模块）
const missions = [
  // 任务1: 版本显示
  (options = {}) => {
    const file = path.resolve(
      ROOT_PATH,
      "./package.json"
    )
    const json = fs.readFileSync(file, "utf8") // 同步读取package.json
    const { version } = JSON.parse(json)
    options?.version && console.log(version) // 带-v参数时输出版本号
  },

  // 任务2: 插件创建（核心功能）
  (options = {}) => {
    const {
      name,
      port,
      template = "vue-render"
    } = options
    console.log('options', options)
    if (name === 'watch:sourceMa') return // 无项目名称时退出

    // 路径配置
    const templateFolder = `./templates/${template}`
    const source = path.resolve(
      ROOT_PATH,
      templateFolder
    ) // 模板源路径
    const target = path.resolve(name) // 目标路径（当前目录下）

    // 目录存在性检查
    if (fs.existsSync(target)) {
      console.log(
        "\x1b[41m",
        `create-lcap-ide-plugin: ${name} plugin already exists.`
      ) // 红色警告
    }

    // 模板变量上下文
    const context = { name, port }
    const cpOptions = { recursive: true } // 递归复制选项

    // 文件处理逻辑
    const forEach = (file) => {
      const filePath = path.resolve(
        file.parentPath,
        file.name
      )
      const source = fs.readFileSync(filePath, {
        encoding: "utf8"
      })
      const result = source.replace(
        /{{{([^{}]+)}}}/g,
        (_, matched) => context[matched]
      ) // 模板变量替换
      fs.writeFileSync(filePath, result, "utf8") // 覆写文件内容
    }

    fs.cpSync(source, target, cpOptions) // 同步复制模板文件
    const files = fs.readdirSync(target, {
      ...cpOptions,
      withFileTypes: true
    })
    files
      .filter((file) => file.isFile())
      .forEach(forEach) // 处理所有文件
  }
]

// 任务执行器
const run = (name, options = {}) => {
  const merged = { name, ...options } // 合并参数
  missions.forEach((mission) => mission?.(merged)) // 顺序执行所有任务
}

// 命令行配置（commander）
program
  .name("razel") // 命令名称
  .arguments("[name]") // 命令参数
  .allowUnknownOption() // 允许未知参数
  .option("-v, --version", "显示版本号") // 版本显示
  .option(
    "-p, --port <number>",
    "设置开发端口",
    "8080"
  ) // 端口配置
  .option(
    "-d, --dir <string>",
    "设置源码目录",
    "dist-theme"
  ) // 目录配置
  .action(run) // 绑定执行函数
  .parse(process.argv)
