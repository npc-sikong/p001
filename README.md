# 伴屿 · 陪伴服务平台 V23

PC、H5 和运营后台共用的单文件交互原型，包含服务发现、咨询、预约履约、语音房、公会招募、可选保证金、会员推广、USDT 演示钱包、周期结算、多语言配置和统一性别资料与筛选。需求支持发布时冻结固定 / 区间总预算、申请者分别报价、双方私聊以及选定后完成需求贴。成交双方可相互进行满分 5 分的评价，提交即展示，无需后台审核；管理员可隐藏、恢复显示或删除单条恶意评价，也可删除某个账号发表的全部评价。

- [在线演示](https://npc-sikong.github.io/p001/)
- [最新修改说明](docs/修改说明.md)（与原型内“修改说明”同步）
- [使用说明](使用说明.txt)
- [产品、技术及模块文档](docs/README.md)
- [公会与推广演示截图](https://npc-sikong.github.io/p001/artifacts/mcn-screenshots.html)

身份、交易、款项、审核和音视频状态均为浏览器本地模拟；使用公开虚构演示账号，不接真实后端或支付。每个访问者的数据保存在自己的浏览器，部署不会同步不同浏览器的演示业务记录。

人物照片使用内置 imagegen 生成的 16 位成年 18 岁虚构人物，采用韩系、日系时尚写真造型。单张 [透明人物大图](assets/portraits/fashion-cast-atlas-20261010.png) 按 4×4 排列，PC、H5 和后台统一裁切显示；[生成提示词](assets/portraits/fashion-cast-prompt.txt) 随源码保留。原图已内嵌在 HTML 中，保留匿名、订阅锁定及本地上传内容的原有规则。

用户可在“我的 → 点击头像 / 编辑资料”或“设置 → 编辑资料”选择头像。默认库共200个头像（男生96、女生104），支持筛选、每页40个、点击预览和保存；原有16个选择保留。新版使用内置 imagegen 参考用户提供的5张图重新生成，为人物分别指定不同发型与脸部结构；按各图实际行边界裁切，并逐人校正圆形框中的头顶留白。新图与透明通道保存在 `assets/portraits/default-library-centered-20261012/` 并内嵌到单文件；原始图仍保存在 `assets/portraits/default-library-20261012/`。头像不显示编号；内部标识保留，已有选择继续有效。也可上传 JPG / PNG / WebP（最大10 MB），自动裁成400×400并压缩；上传沿用现有图片审核开关，默认头像保存后立即使用。PC/H5共用选择，刷新后保留，匿名头像规则继续生效。

2026-10-13：资料页的服务语言改为按访问 IP 地区自动切换，中文地区使用简体中文，其他地区使用英语；识别失败或目标语言未开放时回退分站默认语言。移除资料页的旧演示提示。真实地区识别使用 [Country API](https://country.is/)（只使用国家/地区，不保存原始 IP）；不改变界面语言偏好及服务者申报的可服务语言。顶部工具栏可预览不同 IP 地区及失败状态；三端工具栏与资料弹窗均可打开修改说明。每次修改须同步说明、模块规则和验收文档，已写入 [项目约定](AGENTS.md)。

性别为选填会员资料（男、女、其他、未填写），服务者、公会成员、推广会员读取同一账号资料。PC/H5 支持选人、匹配、关注、公会成员与招募、直推会员筛选；后台支持会员、服务者、入驻、技能、供给、匹配、公会和推广名单筛选、关联详情与性别分布报表。筛选继续受原站点与对象权限限制，不改变 VIP、入驻、保证金、推广资格或账务规则。操作及字段口径见 [使用说明](使用说明.txt)“六之六”。

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
node scripts/verify-gender.cjs
node scripts/verify-demands.cjs
node scripts/verify-reviews.cjs
node scripts/verify-alignment.cjs
node scripts/verify-ux.cjs
node scripts/verify-feed.cjs
node scripts/verify-images.cjs
node scripts/verify-cards.cjs
node scripts/verify-avatars.cjs
node scripts/verify-profile.cjs
```

当前业务检查共 226 组：既有流程26、公会推广与钱包46、周期服务与争议11、多语言与币种8、性别25、需求15、评价22、前后端对齐15、体验7、轮播与图文11、帖子图片8、卡片8、头像16、资料与 IP 语言8。资料修改记录与 PC/H5 验收见 `artifacts/profile-update-20261013/`。新版头像生成提示词、居中效果与PC/H5验收记录见 `artifacts/avatar-centered-20261012/`；此前头像选择与上传记录见 `artifacts/avatar-library-20261012/`；性别流程见 `artifacts/gender/`；需求流程见 `artifacts/requests/`；评价即时发布及隐藏流程见 `artifacts/reviews/immediate/`。

需求演示入口：使用“林小满”账号进入“广场 → 载入多申请演示”，查看三位虚构申请者的报价，逐一私聊并同意一人。区间预算按上限冻结；选定后按报价转服务订单、差额解冻，需求贴显示“已完成”。结算可选每 N 天一次或服务结束后一次，关闭或拒绝未选人的需求即时释放冻结。演示样例的余额补充单独标记为“演示入账”。

评价入口：成交订单详情中的“双方评价”，以及用户中心 / 陪伴工作台的“我的评价”。双方各评一次，可选 1～5 分，提交后对方立即可见并计入收到的评价均分。后台“服务者与商品 → 评价管理”只提供隐藏、恢复显示、单条删除和按发布者批量删除，须核对记录并填写原因。隐藏或删除后移出前台及评分统计；恢复显示重新计分，后台保留原文与处理记录。批量删除只处理该账号发表的评价。旧待审核 / 需修改评价改为已发布，旧未通过评价保留为已隐藏，已删除记录保持原状态。

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
