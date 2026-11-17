# GitHub → 腾讯云 EdgeOne Pages

此项目提交完整的 `dist/` 页面、JSON 数据和图片。腾讯云拉取 GitHub 后直接发布这个目录，无需数据库、环境变量、Python、原始游戏表或浏览器测试依赖。

## 上传哪个目录

以包含 `package.json`、`edgeone.json` 和 `dist/` 的目录作为 GitHub 仓库根目录：

```text
仓库根目录/
├── edgeone.json
├── package.json
├── package-lock.json
├── README.md
├── DEPLOYMENT.md
├── requirements-assets.txt
├── scripts/
└── dist/
    ├── index.html
    ├── app.js
    ├── style.css
    ├── operator-roles.js
    ├── catalog-rules.js
    ├── data.json
    └── assets/
```

`dist/` 在这里就是网站源文件和已生成数据，必须提交，不要套用忽略 `dist/` 的前端项目模板。

如需从已有开发目录导出干净副本：

```sh
npm run export:github -- ../garrison-terminal-github
```

输出目录必须尚不存在。导出保留代码、图片、数据和文档，不复制旧 `.git/`、`.openai/` 托管身份、本地 `node_modules/`、`data/raw/`、环境文件或打包产物。以后可以直接在导出目录中继续维护项目。

## 上传 GitHub

使用 GitHub Desktop 或 Git 上传整个项目目录。请在 GitHub 创建一个空仓库，再从干净副本推送；不需要上传外围工作目录。

命令行方式（替换仓库 URL）：

```sh
git init -b main
git add .
git commit -m "Prepare Garrison Nexus for EdgeOne Pages"
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

如果仓库已经初始化，使用现有分支和远程即可。

## EdgeOne Pages 设置

在腾讯云 **EdgeOne Pages → 新建项目 → 导入 Git 仓库** 中连接 GitHub，选择该仓库及生产分支（例如 `main`）。

| 设置 | 值 |
| --- | --- |
| 框架预设 | Other / 其他 |
| 根目录 | `./` |
| 安装命令 | `node --version` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node.js | `22.11.0` |
| 环境变量 | 无需配置 |

项目已提交 `edgeone.json`，其中的安装命令、构建命令、输出目录和 Node 版本覆盖控制台对应设置。这里的安装命令仅输出 Node 版本：部署所需校验全部使用 Node 内置模块，无需下载 npm 开发依赖。

如果你把整个项目额外嵌套进 GitHub 仓库的 `garrison-terminal/` 子目录，根目录应改填 `garrison-terminal`；输出目录仍为 `dist`，不要填 `garrison-terminal/dist`。推荐直接采用上面的仓库根目录结构。

创建并完成首次部署后，后续推送到所选生产分支即可触发构建部署。所有页面、数据及图片均从当前站点读取。自定义域名及区域选择依照腾讯云控制台指引配置。

官方参考：[edgeone.json 配置](https://edgeone.cloud.tencent.com/pages/document/162936771610066944)、[构建与根目录设置](https://edgeone.cloud.tencent.com/pages/document/162936788693114880)。

## 更新与校验

只修改 UI 时，更新 `dist/app.js`、`dist/style.css` 等文件后运行：

```sh
npm run build
```

这会检查提交的静态文件、全部头像／立绘／目录图片、技能与盟约引用、JavaScript 语法，以及用途与 BAN／价格规则。它不访问网络，不重新生成游戏数据。

需要更新游戏快照时，另行运行维护流程：

```sh
npm run data:rebuild
npm run data:check
npm run build
```

数据脚本固定到 README 中声明的快照，不自动升级到未来赛季。更新快照时需同步调整提取与校验配置，并提交生成的 `dist/data.json` 和所需图片。`data/raw/` 继续忽略，不需要上传给腾讯云。

浏览器测试仅在开发时执行，依赖安装方式见 README；腾讯云部署不会安装 Playwright，也不会运行浏览器。

## 域名迁移与本机数据

收藏、当前阵容、阵容预设和 BAN 设置存于浏览器 localStorage。换域名后它们不会自动迁移；现有阵容可以在旧站导出 JSON，再到新站导入。当前 JSON 导出只包含当前阵容，不包含整个预设库。

部署项目不需要密钥。`dist/` 只用于公开页面与资源，勿在其中加入私密文件。游戏内容和图片来源及版权说明见 README 与 `dist/assets/catalog.json`。
