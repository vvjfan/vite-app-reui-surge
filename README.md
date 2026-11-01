# Surge Commerce on Vite

将 `reui-templates/surge-commerce` 完整移植为浏览器端 SPA，沿用已完成的 `vite-app-shadcnui` 的技术栈、Mira/Mist 组件和主题。项目位于 `vite-app-reui-surge`。

## 运行

```sh
pnpm install
pnpm dev
```

使用 pnpm 10 和支持 Vite 8 的 Node.js（22.12+）。开发服务器默认使用 5173；端口被占用时以终端输出为准。

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm preview
```

## 技术栈与迁移内容

- React 19.3、TypeScript 6、Vite 8；TanStack Router 文件路由和路由级代码分割。
- 移除 TanStack Start、SSR 文档外壳、服务器入口和开发工具浮层；`index.html` + `src/main.tsx` 启动 SPA。
- Tailwind CSS v4 CSS-first、shadcn `base-mira` / `mist`、Base UI、Phosphor 图标。共享 UI、ReUI 组件及设计 token 复用 `vite-app-shadcnui`；额外的 RadioGroup 和 Table 来自 shadcn 官方 Mira 注册表。
- 使用本地 Inter 可变字体，保留中文字体回退链、统一 placeholder 和输入框边框、亮色透明表单背景、原有暗色背景、14px 侧栏菜单。
- 沿用 ThemeProvider 的 light/dark/system、localStorage 持久化、系统主题跟随，以及非输入区域按 `d` 切换主题。账户偏好、侧栏主题开关和 toast 使用同一主题上下文。
- 使用已验证的路由进度条，保留路由驱动的订单详情抽屉进入/退出过渡。
- TanStack Query 和 Table、Recharts、dnd-kit、电话号码输入组件支撑原有业务交互。
- 适配严格 TypeScript 和 React Hooks 检查；表单在所属记录或打开状态变化时重置草稿，避免 effect 提交后的二次重置。

## 功能范围

- 仪表盘、收入与库存图表、日期范围筛选。
- 商品列表、新建和编辑、媒体与变体；分类树、分类编辑及商品分配。
- 订单列表、新建、详情抽屉、履约和运单演示。
- 库存台账、调整/转移库存、补货队列和采购单。
- 客户、客户组及详情；促销与评论管理；分析报表。
- 店铺、团队、支付、通知、账单、地点、供应商设置。
- 账户资料、偏好、安全设置，以及演示登录/退出。
- 搜索、筛选、排序、分页、选中批量操作和响应式侧栏。

## 数据与部署

与原模板一致，数据来自浏览器内存中的演示仓库。修改在当前页面会话内有效，刷新会重建种子数据；部分界面偏好保存在 localStorage。登录、安全、支付、发货等是演示流程，不接入真实认证、支付或共享后端。外部商品图片和头像需要网络。

生产构建输出到 `dist/`。静态托管需要将应用路由回退到 `index.html`，使详情页的直接访问和刷新可用。原模板的 Vercel API 与 TanStack Start 服务端部署配置未迁入。

## 验证

已运行原模板的 31 个测试文件、439 项测试，覆盖数据一致性、订单生命周期、库存变动及业务表单；类型检查、格式检查和生产构建均通过。ESLint 为 0 错误、34 条提示（表格库兼容性、Hook 依赖及原模板的一处无效禁用注释）；未关闭规则来绕过检查。验证环境为 Node 24.19.0、pnpm 10.19.0。

浏览器检查覆盖所有主导航和设置子页面、账户页、商品编辑器、订单详情抽屉、新建订单、日期选择器、中文分类创建和重开表单、深浅主题和 `d` 快捷键。390px 窄屏检查了仪表盘、商品列表、编辑器和侧栏。拖拽手势、所有批量操作和真实外部服务未逐项手工验证。

模板许可保存在 `SURGE-LICENSE.md`。
