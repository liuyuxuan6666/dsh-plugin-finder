<p align="center">
  <img src="icon.svg" width="88" height="88" alt="dsh-plugin-finder icon">
</p>

<h1 align="center">dsh-plugin-finder</h1>

<p align="center">
  给 DeepSeek Harness 的「插件」页装上搜索：<b>Ctrl+F</b> 聚焦，边打边筛，回车就走。
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-3F77D8"></a>
  <img alt="DSH" src="https://img.shields.io/badge/DSH-%E2%89%A50.2.1-2A55C8">
  <img alt="Runtime dependencies" src="https://img.shields.io/badge/runtime%20deps-0-2ea043">
  <img alt="Tests" src="https://img.shields.io/badge/tests-21%20passing-2ea043">
  <img alt="Build step" src="https://img.shields.io/badge/build%20step-none-6e7781">
</p>

---

## 为什么

插件装到几十个以后，「插件」页就是一堵墙：

- 已安装 + 官方 + 实验性三组一起滚，**找某个插件要滚好几屏**；
- 页面只有刷新和「添加插件」，**既没有搜索也没有排序**；
- 你往往记得的是「那个做会话星标的」——标题、简介、包名，正好都在卡片上，却没法拿来查。

`dsh-plugin-finder` 只做一件事：**在这个页头加一条搜索框，让整页的插件变成可以查的。**

## 特性

| | |
| --- | --- |
| **就在手边** | 搜索框落在「插件」页顶栏，紧挨在 **刷新 / 添加插件** 左边，跟页头一起滚动收缩 |
| **Ctrl+F / ⌘F** | 在这个页面按一下就聚焦（会吃掉浏览器自带的查找）；不在插件页时完全不管 |
| **三个字段一起查** | 卡片标题、简介、包名/注册 id，大小写不敏感；空格分开的多个词是 **AND** |
| **整组隐藏** | 某个分组一张卡都不剩时，连组标题一起收起来——不给你看「官方 0」这种空壳 |
| **计数与空态** | 搜索条上显示 `命中 / 总数`；一个都没命中时变成「没有匹配」并在配色上用警示色 |
| **回车就走** | `Enter` 打开第一条命中，`Shift+Enter` 只滚过去闪两下、不离开列表 |
| **一键还原** | `Esc` 或右侧 × 清空；搜索词为空时，页面 DOM 与外壳自己渲染的**完全一致** |
| **跟着主题与语言** | 颜色只用 `--dsw-alias-*` 主题 token，明暗自动跟随；文案随界面语言切换中/英 |
| **零依赖零构建** | 不装 React、不打包、不发请求、不落盘；手写 `lib/client.js` 直接跑 |

## 快捷键

| 按键 | 作用 |
| --- | --- |
| `Ctrl+F` / `⌘F` | 聚焦搜索框（仅当「插件」页的列表在屏幕上） |
| 直接输入 | 即时过滤 |
| `Enter` | 打开第一条命中（进入该插件的详情/配置页） |
| `Shift+Enter` | 滚到第一条命中并闪一下高亮 |
| `Esc` | 有内容时清空；已经空着时离开输入框 |
| `↑` `↓` | 不接管——列表本身是可点的卡片 |

## 安装

**方式一：图形界面（推荐）**

1. 左侧栏打开 **插件**；
2. 点右上角 **添加插件**；
3. 在安装框里填入 `github:liuyuxuan6666/dsh-plugin-finder`，确认安装；
4. **刷新页面**（`Ctrl+R`）即可看到搜索框。

**方式二：命令行**

```bash
dsh plugin --profile <你的 profile 名> add github:liuyuxuan6666/dsh-plugin-finder
```

锁定到某个提交更稳妥（推送无法偷偷改掉你实际运行的代码）：

```bash
dsh plugin --profile <你的 profile 名> add github:liuyuxuan6666/dsh-plugin-finder#<commit-sha>
```

**方式三：本地开发**

```bash
git clone https://github.com/liuyuxuan6666/dsh-plugin-finder.git
dsh plugin --profile <你的 profile 名> add ./dsh-plugin-finder
```

后端半（`lib/index.js`）是空的，所以**前端插件的改动刷新页面就生效，不需要重启 DSH**。

卸载：

```bash
dsh plugin --profile <你的 profile 名> remove dsh-plugin-finder
```

## 它做什么 / 不做什么

**做**：只改**显示状态**。搜索期间给不匹配的卡片和空分组打上插件自己的 `data-plugin-finder-*` 属性，由插件注入的一条样式表把它们藏起来；清空搜索时逐个摘掉。

**不做**：

- 不发任何网络请求，不读会话日志，不写文件，不存 localStorage；
- 不开关插件、不改插件配置、不装卸插件——搜到之后「启用 / 卸载」仍是页面自己的按钮；
- 不删 DOM 节点：卡片只是被隐藏，React 的树和焦点都不动；
- 搜索词为空时，不留下任何属性、样式痕迹。

## 实现要点

### 为什么是 DOM 注入，而不是注册一个 slot

「插件」页由 `@deepseek-ai/dsh-client-ui-plugin-manager` 拥有。它对外开放的扩展位是给**卡片**和**详情页**的：

| 槽位 | 用途 |
| --- | --- |
| `plugins.tab` | 在「已安装」后面加一个标签页 |
| `plugins.item` / `plugins.bundle.config` / `plugins.row.config` | 新增一张官方卡片 / 某个 bundle 或某一行的配置 |
| `plugins.detail.{actions,badge,section}` | 插到某个详情页的头部、标题旁、正文下 |

**列表级的工具栏没有槽位。** 而承载页面的 `main` 是 keyed slot，`plugins` 这个 key 已经被它自己占了——走那条路只能整页顶替外壳自带的界面：升级即碎，还得自己重做安装对话框和每个包的配置页。「加个搜索框」不值得付这个代价。

所以这里认准外壳自己写在 JSX 上的 `data-*` 契约（不是构建后会变的哈希类名），把搜索框挂进页头，按关键词切换卡片的显示。

### 依赖的 DOM 契约

| 选择器 | 含义 | 用途 |
| --- | --- | --- |
| `[data-plugin-panel]` | 页面根 | 找到这一页 |
| `[data-plugin-toolbar]` | 页头工具栏（刷新 + 添加插件） | 挂搜索框；`:not([hidden])` 保证详情页/市场页没有它 |
| `[data-plugin-group]` | 一组卡片（基础 / 实验性 / 已安装 / 更多） | 整组无命中时隐藏 |
| `[data-plugin-package="名"]` | 已安装或官方 bundle 卡片 | 过滤单位；包名参与匹配 |
| `[data-plugin-item="id"]` | 官方插件卡片 | 同上，id 参与匹配 |
| 卡片里 `aria-describedby` | 标题按钮指向简介元素 | 拿到「标题 + 简介」，不依赖任何 class |

### 抗重挂

外壳的列表是 React 渲染的：首屏加载、切标签页、刷新、装卸插件都会换掉卡片节点。因此：

- 一个 `MutationObserver`（看 `document.body` 的 childList，外加 `aria-busy`）驱动重新同步，`requestAnimationFrame` 合并同一帧的多次通知；
- 搜索词住在闭包里，卡片被换掉之后过滤自动重算，输入框里的字不会丢；
- 写属性**幂等**（值不变就不碰 DOM），否则自己的改动会通过观察者把同步循环点亮；
- 搜索词从空变成非空时把列表滚回顶部——否则结果可能在当前视口上方，看着像「没搜到」。

### Fail-open

抓不到预期结构就**什么也不做**：没有搜索框，也不抛错、不隐藏任何东西。外壳哪天改了这些 `data-*`，最坏结果是「少一个搜索框」，而不是把插件页弄坏。

## 测试

```bash
npm install      # 只为 jsdom
npm test         # node --test test/*.test.mjs
```

21 个用例，跑的是**真实的 `lib/client.js`**，在 jsdom 里搭出与外壳同构的页面（属性、层级、`aria-describedby` 都照抄），覆盖：注入位置、标题/简介/包名/id 匹配、多词 AND、整组隐藏、计数与空态、Esc 还原 DOM、Ctrl/⌘+F、Enter 与 Shift+Enter、卡片重挂后重新过滤、工具栏重建后焦点复位、卸载清理、语言切换。

## 兼容性

- 已在 **DSH 0.2.2-rc.5** 的 desktop profile 上安装并实测（中文界面；英文文案走同一路径，语言切换有用例覆盖）；
- `engines.dsh` 声明为 `>=0.2.1-rc.3 <0.3.0`；
- 只用页面的 `data-*` 契约与 client locale 服务，不 import 任何 Harness Client 包。

## 已知边界

- **只做子串匹配**，不做模糊/拼音：搜 `chajian` 不会命中「插件」，搜 `星标` 会；
- 「更多」是一个**子视图**：只过滤当前渲染出来的卡片，折叠在「更多」里的卡片要点进去才搜得到；
- 搜索词不跨刷新保留（故意的：刷新后回到干净的页面）；
- 不排序——有了过滤，排序通常是另一件事；
- `Esc` 在输入框里会被就地消费，不会冒泡去关掉外层面板。

## 许可

[MIT](LICENSE)。用、改、发都行，留个版权声明就够。

## 同类项目

社区里还有 [huangxp12/dsh-plugin-search](https://github.com/huangxp12/dsh-plugin-search)，同样是往插件页挂搜索条的做法与思路来源；本项目在它之外补了 **Ctrl/⌘+F 聚焦**、**Enter 打开 / Shift+Enter 定位**、**空列表静默**与**搜索回顶**，并把行为写成可跑的 jsdom 用例。
