'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');const dir=path.join(root,'docs/equipment-v3');fs.mkdirSync(dir,{recursive:true});
const dot=`digraph WardrobeV3 {
  graph [rankdir=TB, bgcolor="#FFFFFF", pad="0.38", nodesep="0.34", ranksep="0.44", splines=polyline, fontname="Noto Sans CJK SC", label="Aozora Director · 服装系统 V3｜剧情优先，校正而不否决", labelloc=t, fontsize=25, fontcolor="#22232B"];
  node [shape=box, style="rounded,filled", fillcolor="#FAF8F8", color="#C8C6C7", penwidth=1.3, fontname="Noto Sans CJK SC", fontsize=14, fontcolor="#24262B", margin="0.22,0.14"];
  edge [color="#858489", arrowsize=0.7, penwidth=1.35, fontname="Noto Sans CJK SC", fontsize=11];
  input [label="玩家指令 + 上轮穿着快照", fillcolor="#FEF0F3", color="#9F1735"];
  ai [label="同轮文本 AI 生成\n正式剧情正文 / 可选 CG 方案 / 可选装备更新", fillcolor="#FEF0F3", color="#9F1735"];
  boundary [label="事实源：玩家要求与已生成的正文\n只有内部视觉提示词新增的换装不算事实", fillcolor="#F9F2F3", color="#9F1735"];
  initial [shape=diamond, label="人物首次\n建立穿着？", fillcolor="#FFFFFF", color="#AA4156", margin="0.16,0.12"];
  new [label="从首次人物方案建立\n八部位初始穿着\n不要求换装证明", fillcolor="#F7F9FB"];
  existing [label="读取当前八部位\nHEAD / TOP / LOWER / FULL\nLEGWEAR / FOOTWEAR / HAND / ACCESSORIES", fillcolor="#F7F9FB"];
  changed [shape=diamond,label="正文 / 玩家\n已发生变化？", fillcolor="#FFFFFF",color="#AA4156",margin="0.16,0.10"];
  apply [label="局部变化→只更新相关部位\n明确整套换装→更新整套\n脱外套保留内搭 / 未提及继承", fillcolor="#F7F9FB"];
  keep [label="保持已有穿着\n无依据更新提案直接忽略", fillcolor="#F7F9FB"];
  reconcile [label="形成本轮最终穿着\n纠正纯视觉提示词里的多余换装\n不因装备差异拒绝生图", fillcolor="#FEF0F3",color="#9F1735"];
  save [label="保存正文后记录本轮合法装备变化\n消息归属保护 + 历史事件回放\n记录失败只提示，不否决有效画面", fillcolor="#FAF8F8"];
  image [shape=diamond,label="本轮存在\nCG 任务？",fillcolor="#FFFFFF",color="#AA4156"];
  puretext [label="普通聊天完成\n穿着状态供下一轮继承",fillcolor="#F7F9FB"];
  render [label="只编译实际可见衣物\n保持人物外貌 DNA 和原生生图参数\n调用图片 API",fillcolor="#F0F7F1",color="#47815A"];
  preview [label="静态设计 / 已有图片微调\n基于所选原图实际完整 Prompt 修改\n只形成独立候选，不写回剧情穿着",fillcolor="#FFF9EB",color="#AE8844"];
  replay [label="正文被删除 / 编辑 / 重生成\n按消息有效性重放合法装备事件",fillcolor="#F7F9FB"];
  input -> ai -> boundary -> initial;
  initial -> new [label="是"]; initial -> existing [label="否"];
  existing -> changed; changed -> apply [label="有"]; changed -> keep [label="无"];
  new -> reconcile; apply -> reconcile; keep -> reconcile;
  reconcile -> save -> image;
  image -> puretext [label="无"]; image -> render [label="有"];
  save -> replay [style=dashed, color="#A8A4A6", constraint=false];
  preview -> render [style=dashed, color="#BFA56D", label="独立图", constraint=false];
  {rank=same; puretext; render}
  {rank=same; preview; replay}
}`;
const mermaid=`flowchart TD
    A[玩家指令 + 上轮穿着快照] --> B[同轮文本 AI 生成正文与可选视觉数据]
    B --> C[事实依据 = 玩家要求 + 已生成正式正文]
    C --> D{首次人物登场?}
    D -->|是| E[建立初始穿着，不视作换装]
    D -->|否| F{正文或玩家明确发生服装变化?}
    F -->|是| G[只改对应部位；全套换装更新整套]
    F -->|否| H[继承当前穿着]
    E --> I[形成最终八部位穿着快照]
    G --> I
    H --> I
    I --> J[忽略仅视觉提示词新增的变化；纠正视觉快照，不拒图]
    J --> K[消息保存后同步剧情装备事件]
    K --> L{本轮有 CG 任务?}
    L -->|否| M[普通文本完成，穿着供下轮继承]
    L -->|是| N[仅编译实际可见衣物并调用原图片 API]
    K -. 删除／编辑／重生 .-> O[重放合法装备事件，恢复当前状态]
    P[独立人物设计 / 已有图片微调] -. 不回写剧情装备 .-> N
`;
fs.writeFileSync(path.join(dir,'flow.dot'),dot+'\n');fs.writeFileSync(path.join(dir,'flow.mmd'),mermaid);
for(const fmt of ['svg','png'])execFileSync('dot',['-T'+fmt,path.join(dir,'flow.dot'),'-o',path.join(dir,'flow.'+fmt)]);
console.log({dir,files:fs.readdirSync(dir)});
