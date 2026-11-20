from pathlib import Path
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha206-fixedframe-20261110")
f=p/"README.md";s=f.read_text(encoding="utf-8-sig").replace("0.1.0-alpha.205","0.1.0-alpha.206")
s=s.replace("## Phantom Pop 安装候选版 · 2026-11-10","## Phantom Pop 固定比例终端候选版 · 2026-11-10")
s=s.replace("本包把当前确认的红黑金纸面视觉接入已有 Director 运行时。","本版使用固定比例放映终端外壳，菜单内保持 390×780 排版，整体等比缩放；构建中移除旧设置皮肤，真实控件由 workbench.js 接入确认稿视觉。")
s=s.replace("- 161 项现有回归测试通过。","- 原业务模块沿用已通过 161 项回归的基线，本次没有修改业务模块。")
s=s.replace("- 浏览器检查手机与桌面布局、历史阅读、大图、弹窗，无实际模型请求。","- 8 种浏览器设备配置、8 个菜单页已检查固定比例、外壳边界和长列表内部滚动。未完成真实 Tavo 手机安装验收。")
f.write_text(s,encoding="utf-8")
