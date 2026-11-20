from pathlib import Path
import json
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha207-phone-20261110")
f=p/"README.md";s=f.read_text(encoding="utf-8-sig").replace("0.1.0-alpha.206","0.1.0-alpha.207")
intro="""
## alpha.207 手机反馈修正

- 菜单使用四像素超薄黑框，390×780 菜单画布整体适配可用区域，显示与点击区域较重型设备外壳扩大。
- 弹窗使用 360px 基准卡片，按自身内容长度整体缩放、居中。
- 导演下一幕中的隐藏姓名／形态字段恢复隐藏，镜头构图使用轻量横线双选。
- 大图使用与主菜单一致的宿主顶部避让，图片完整适应舞台，顶部工具和关闭按钮放在可用区域内。
- 本轮仅针对一档手机尺寸（428×936、顶部避让 96px）做浏览器检查，真实 Tavo 手机效果仍需实机确认。
- 头像裁剪和人物特征中文释义仍未接入。

"""
s=s.replace(chr(10)+chr(10),chr(10)+chr(10)+intro,1)
f.write_text(s,encoding="utf-8")
f=p/"src/assets/provenance.json";d=json.loads(f.read_text(encoding="utf-8-sig"))
d["phoneRevision"]={"version":"0.1.0-alpha.207","menuCanvas":[390,780],"housingCanvas":[398,788],"popupCanvasWidth":360,"phoneViewportChecked":[428,936],"physicalPhoneVerified":False}
f.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding="utf-8")
