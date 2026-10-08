# 伴屿 · 陪伴服务平台 V23

PC、H5 和运营后台共用的单文件交互原型，包含服务发现、咨询、预约履约、语音房、公会招募、可选保证金、会员推广、USDT 演示钱包、周期结算和多语言配置。

- [在线演示](https://npc-sikong.github.io/p001/)
- [使用说明](使用说明.txt)
- [产品、技术及模块文档](docs/README.md)
- [公会与推广演示截图](https://npc-sikong.github.io/p001/artifacts/mcn-screenshots.html)

身份、交易、款项、审核和音视频状态均为浏览器本地模拟；使用公开虚构演示账号，不接真实后端或支付。每个访问者的数据保存在自己的浏览器，部署不会同步不同浏览器的演示业务记录。

## 构建与检查

需要 Python 3.9 或以上及 Node.js 22 或以上，无需安装前端框架或数据库。本地工作目录、临时文件、构建产物和日志遵循 [AGENTS.md](AGENTS.md)，均位于 pro990 硬盘。

```sh
cd /Volumes/pro990/p001
mkdir -p .work/tmp
export TMPDIR=/Volumes/pro990/p001/.work/tmp
export PYTHONDONTWRITEBYTECODE=1
python3 scripts/build-v23.py
node scripts/verify-v22.cjs
node scripts/verify-mcn.cjs
node scripts/verify-service.cjs
node scripts/verify-intl.cjs
```

当前业务检查共 91 组：既有流程 26 组、公会推广与钱包 46 组、周期服务与争议 11 组、多语言与币种 8 组。

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

访问 `http://127.0.0.1:8000/`。默认业务日期仍使用原型既有规则，后台会话按真实时间到期。

## GitHub 同步与部署

`main` 保存源文件、构建脚本、文档及静态产物；`gh-pages` 只发布已提交的 `dist` 内容。项目构建和检查在 pro990 本地执行，GitHub Pages 发布预先生成的静态文件。

```sh
git add .
git commit -m "Update companion-service prototype"
git push origin main
python3 scripts/deploy-pages.py npc-sikong/p001
```

部署脚本使用已登录的 GitHub CLI，发布普通追加提交，不覆盖历史。构建前应运行上面的检查；`dist/build-info.json` 提供线上 HTML 的 SHA-256，便于核对部署版本。Pages 的发布状态仍需等待 GitHub 完成，再检查在线内容。

生成的 ZIP、运行日志和本地临时文件不纳入 Git；工作区现有交付包保留。
