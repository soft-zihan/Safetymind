# 前端桌面应用打包计划

## 项目现状分析

### 技术栈
- **框架**: React 19.2.6
- **构建工具**: Vite 8.0.12
- **UI 组件库**: Ant Design 5.14.0
- **状态管理**: Zustand 4.5.0
- **图表**: ECharts 5.5.0
- **路由**: React Router DOM 6.21.3
- **语言**: TypeScript 6.0.2

### 项目结构
```
frontend/
├── src/              # 源代码
├── public/           # 静态资源
├── dist/             # 构建输出（已存在）
├── package.json      # 依赖配置
├── vite.config.ts    # Vite 配置
└── index.html        # 入口 HTML
```

---

## 方案对比

### 方案一：Electron + electron-builder（推荐 ⭐）

**优点**：
- 生态成熟，社区支持好
- 与 React/Vite 集成简单
- 跨平台（Windows/macOS/Linux）
- 修改幅度小，只需添加配置

**缺点**：
- 打包体积较大（~150-200MB）
- 内存占用相对较高

**修改幅度**：⭐⭐⭐⭐（较小）
- 添加 2-3 个依赖包
- 新增 1 个主进程文件
- 修改 package.json 添加脚本
- 新增构建配置文件

---

### 方案二：Tauri

**优点**：
- 打包体积小（~10-20MB）
- 性能更好，内存占用低
- 安全性高（Rust 后端）

**缺点**：
- 需要安装 Rust 工具链
- 学习成本略高
- 某些原生 API 需要 Rust 编写

**修改幅度**：⭐⭐⭐（中等）
- 需要安装 Rust 环境
- 新增 Rust 后端代码
- 配置文件较复杂

---

### 方案三：PWA（Progressive Web App）

**优点**：
- 修改幅度最小
- 无需打包，直接部署
- 可离线使用

**缺点**：
- 功能受限（无法访问系统级 API）
- 不是真正的桌面应用
- 用户体验不如原生应用

**修改幅度**：⭐⭐⭐⭐⭐（最小）
- 添加 manifest.json
- 添加 Service Worker
- 修改 index.html

---

## 推荐方案：Electron + electron-builder

基于"修改幅度最小"的需求，推荐使用 **Electron** 方案。

### 实施步骤

#### 阶段一：环境准备（5分钟）

1. **安装依赖包**
```bash
npm install --save-dev electron electron-builder vite-plugin-electron vite-plugin-electron-renderer
```

2. **添加类型定义**（如果使用 TypeScript）
```bash
npm install --save-dev @types/node
```

#### 阶段二：配置 Electron 主进程（15分钟）

1. **创建主进程文件** `electron/main.ts`
```typescript
import { app, BrowserWindow } from 'electron'
import path from 'path'

// 禁用 GPU 加速（解决某些 Linux 环境问题）
// app.disableHardwareAcceleration()

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 开发环境加载 Vite 开发服务器
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    // 生产环境加载构建后的文件
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
```

2. **创建预加载脚本** `electron/preload.ts`
```typescript
import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 示例：暴露版本信息
  getVersion: () => ipcRenderer.invoke('get-version')
})
```

#### 阶段三：配置 Vite 插件（10分钟）

修改 `vite.config.ts`：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // 主进程入口
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      },
      {
        // 预加载脚本
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: 'dist'
  }
})
```

#### 阶段四：配置 electron-builder（10分钟）

创建 `electron-builder.json5`：

```json5
{
  appId: "com.aegis.frontend",
  productName: "Aegis Security Platform",
  directories: {
    output: "release/${version}"
  },
  files: [
    "dist/**/*",
    "dist-electron/**/*"
  ],
  mac: {
    target: ["dmg", "zip"],
    artifactName: "${productName}_${version}.${ext}"
  },
  win: {
    target: ["nsis", "zip"],
    artifactName: "${productName}_${version}.${ext}"
  },
  linux: {
    target: ["AppImage", "deb"],
    artifactName: "${productName}_${version}.${ext}"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  }
}
```

#### 阶段五：修改 package.json（5分钟）

添加构建脚本：

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "electron:dev": "vite",
    "electron:build": "vite build && electron-builder",
    "electron:preview": "vite build && electron ."
  },
  "build": {
    "extends": "./electron-builder.json5"
  }
}
```

#### 阶段六：测试与打包（10分钟）

1. **开发模式测试**
```bash
npm run electron:dev
```

2. **构建生产版本**
```bash
npm run electron:build
```

3. **查看输出**
构建产物在 `release/` 目录下

---

## 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 环境准备 | 5 分钟 |
| 2 | 配置 Electron 主进程 | 15 分钟 |
| 3 | 配置 Vite 插件 | 10 分钟 |
| 4 | 配置 electron-builder | 10 分钟 |
| 5 | 修改 package.json | 5 分钟 |
| 6 | 测试与打包 | 10 分钟 |
| **总计** | | **55 分钟** |

---

## 可能遇到的问题

### 1. 白屏问题
- **原因**：路径配置错误
- **解决**：检查 `main.ts` 中的 `loadFile` 路径

### 2. 开发服务器连接失败
- **原因**：端口冲突或 Vite 配置问题
- **解决**：确保 `VITE_DEV_SERVER_URL` 正确传递

### 3. 打包后资源加载失败
- **原因**：相对路径问题
- **解决**：在 `vite.config.ts` 中设置 `base: './'`

### 4. macOS 签名问题
- **原因**：未签名或签名无效
- **解决**：配置签名证书或使用 `--config.mac.identity=null` 跳过签名

---

## 后续优化建议

1. **自动更新**：集成 `electron-updater`
2. **应用图标**：添加多尺寸图标（16x16, 32x32, 256x256, 512x512）
3. **安装包定制**：配置安装界面、许可协议等
4. **代码签名**：为 Windows/macOS 添加代码签名证书
5. **CI/CD 集成**：使用 GitHub Actions 自动构建多平台版本

---

## 快速开始命令

```bash
# 1. 安装依赖
npm install --save-dev electron electron-builder vite-plugin-electron vite-plugin-electron-renderer

# 2. 创建 electron 目录和文件
mkdir electron
# 创建 electron/main.ts 和 electron/preload.ts（参考上文）

# 3. 修改 vite.config.ts（参考上文）

# 4. 创建 electron-builder.json5（参考上文）

# 5. 修改 package.json（参考上文）

# 6. 开发测试
npm run electron:dev

# 7. 打包构建
npm run electron:build
```

---

## 参考资料

- [Electron 官方文档](https://www.electronjs.org/docs)
- [electron-builder 文档](https://www.electron.build/)
- [vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron)
- [Electron + Vite + React 最佳实践](https://electron-vite.org/guide/)
