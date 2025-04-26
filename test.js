const fs = require('fs');
const chokidar = require('chokidar');

const targetFile = '/Users/zhuanghengheng/Downloads/yun_shang_primary/dist-theme/index.js';
const targetString = '//# sourceMappingURL=index.js.map';
const replacement = '//# sourceMappingURL=http://127.0.0.1:8080/dist-theme/index.js.map';

// 初始化文件监听
const watcher = chokidar.watch(targetFile, {
  persistent: true,
  ignoreInitial: true,
});

watcher.on('change', (path) => {
  console.log(`🔍 检测到变化: ${path}`);
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) throw err;

    if (data.includes(targetString)) {
      console.log(`修改数据ing`);
      const result = data.replace(targetString, replacement);
      fs.writeFile(path, result, 'utf8', (err) => {
        if (err) throw err;
        console.log(`修改成功`);
      });
    }
  });
});

console.log(`👀 Watching for changes in: ${targetFile}`);