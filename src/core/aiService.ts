import type { TemplateConfig } from './types';
import { effectCatalog, type EffectPreset } from './effectCatalog';

/**
 * AI 生成器使用的“特效能力说明表”。
 *
 * effectCatalog 是程序真实可渲染的特效清单，但它的 label/config 更偏 UI 展示；
 * 这里给大模型补充更语义化的中文说明、适用场景和关键参数提示，让模型能根据
 * 用户描述选择合适的组合，并尽量返回可直接被 PVEngine 加载的 TemplateConfig。
 */
export const EFFECT_SKILLS: Record<string, string> = {
  // 背景 Background
  textureBackground: '纹理背景，为画面背景提供圆点网格底纹',
  gradientOverlay: '渐变底色，适合制造各种色调的光影渐变氛围，参数 { colorTop: hex, colorBottom: hex, alpha: number }',
  triangleGrid: '三角网格背景，未来科技感、线条几何感，参数 { color: hex, cols: number }',
  backgroundBlocks: '背景色块，适合跃动、多变、情绪色彩丰富的背景，参数 { count: number, alpha: number }',
  breathingBlocks: '呼吸方块，方块伴随节奏呼吸放大缩小',
  checkerboard: '棋盘格背景，适合波普风、复古潮流、游戏机风格，参数 { cellSize: number, color1: hex, color2: hex, alpha: number }',

  // 几何装饰 Geometry
  concentricCircles: '同心圆，适合未来科技、声波震动、仪式感装饰，参数 { color: hex, count: number }',
  diamondShapes: '菱形装饰，在画面点缀菱形图形，参数 { color: hex }',
  crossPattern: '十字图案，适合散落点缀，星空或数码风格，参数 { color: hex }',
  scatteredShapes: '散布几何形状，增加画面丰富度',
  halftoneBlocks: '半调色块，美式波普、复古漫画网点色块感',
  shadowShapes: '阴影几何形状，带阴影的重叠几何体',
  centeredSquares: '居中方块，画面中央层层叠起的几何方块',
  balancingCircles: '平衡圆，日式平面构成风格',
  radialRectangles: '放射矩形，放射状排列的矩形，极具视觉张力和空间透视感',
  starTrail: '旋转星轨，适合梦幻、星空、夜晚效果，参数 { count: number }',
  planet: '行星，背景中升起的一颗带有星环的行星，极具科幻和太空感，参数 { color: hex, radius: number }',

  // 线条结构 Lines
  flowingLines: '流动线条，伴随音乐节奏波动的横向流体线条，适合柔和或流动的场景，参数 { color: hex, count: number }',
  diagonalFill: '斜线填充，日式高对比冲击力排版常用，参数 { color: hex }',
  diagonalHatch: '斜线网格，适合工业风、设计感画面，参数 { color: hex, alpha: number }',
  parallelogramStripes: '斜切平行四边形条带，画面分割感强',
  diagonalSplit: '对角能量斩击，旋转的斜切分割光束，极具动感与情绪爆发力，参数 { color: hex, rotSpeed: number }',
  diagonalStructure: '对角线设计结构，常用于蓝图、机甲和机械设计风',
  burstLines: '放射线，爆发放射线条，将视觉焦点聚拢在画面中央，表现冲击、震撼、高潮',
  screenBorder: '屏幕细线边框，画框包围感',
  dashedGuideLines: '虚线参考刻度线，增加设计排版构成感',
  perspectiveGrid: '三维透视网格地板，表现向前滑动的地面空间感，极适合赛博朋克、蒸汽波、怀旧游戏感，参数 { mode: "floor"|"ceil", scrollSpeed: number }',
  compositionGuides: '构成排版线，三分线、黄金螺旋等，冷淡工业风设计常用',
  webLines: '从焦点散开的蜘蛛网状红色细线，表现危险、禁忌、捆绑、疯狂，参数 { count: number, color: hex }',

  // 文字 Text
  heroText: '主标题，默认居中展示核心歌词排版，最基础但也最核心',
  scatteredText: '背景散落文字，在背景随机散落微小字符点缀',
  textStrip: '文字滚动条，带背景横条的高亮滚动歌词条，表现潮流、反叛、机能风',
  textCards: '文字卡片，为每一句歌词添加独立的实色背景卡片',
  bigOutlineText: '大字描边背景，极大描边字符作为排版底纹，极有冲击力',
  cuteOutlineText: '可爱描边文字，可爱粉色双重描边粗体字，适合欢快、可爱、萌系日漫风格，参数 { fillColor: hex, strokeColor: hex }',
  layeredText: '叠层文字，重叠重影文字，适合迷幻、电子、眩晕效果',
  glowTextCards: '发光文字卡片，发光背景卡片文字，适合梦幻、霓虹夜街、深夜情感，参数 { cardColor: hex, textColor: hex }',
  verticalSubText: '竖排副文字，竖排日文/小字副标题排版装饰',
  formulaText: '公式文字，在画面各处浮现物理、数学公式字符，学霸、理性、高科技质感',
  fallingText: '文字代码雨，类似黑客帝国向下滚动的字符雨，适合信息论、电子网络风格',
  staggeredText: '错落排版文字，歌词按节奏不规则错开摆放，极具现代动态感',
  waveText: '起伏波浪文字，字符像波浪一样跃动，欢快、水流、轻盈',
  shatterText: '碎裂文字，极强视觉冲击！文字在音乐重拍时如玻璃般爆碎散落，适合情绪宣泄、摇滚、爆发高潮',
  crayonShatter: '蜡笔涂鸦文字，带有手绘和定格动画的低帧率质感，适合活泼、儿童、童话、怪诞风格',

  // 叠加效果 Overlay
  colorMask: '颜色蒙版，全屏纯色色罩，用于极度渲染画面主色调，表达统一情绪，参数 { color: hex, alpha: number }',
  chromaticAberration: '红蓝偏移色差，增强潮流和故障感',
  glitchBars: '故障条纹，全屏横向撕裂的故障条纹，表现画面不稳定、电磁干扰、歇斯底里',
  vignette: '暗角蒙版，边缘发黑聚焦中央，适合电影质感、压抑或唯美古风，参数 { color: hex, alpha: number }',
  scanlines: '老式 CRT 电视机水平扫描线，科技、监控、怀旧屏幕，参数 { color: hex, alpha: number }',
  filmGrain: '胶片电影颗粒噪点，适合文艺、复古、胶片感、颗粒质感，参数 { alpha: number }',
  dotScreen: '印刷半调网点纹理，波普艺术、复古漫画印刷风必备，参数 { spacing: number, dotRadius: number }',

  // HUD
  hudCorners: 'HUD角框，画面四个角落的机甲/相机参数瞄准角框',
  hudStatusText: 'HUD状态，屏幕边缘闪烁的 ALERT、SYSTEM ERROR 等 HUD 状态英文',
  hudInfoPanel: 'HUD信息面板，透明科幻信息面板，浮现雷达和扫描参数，科幻、装甲监控风格',
  rulerGuide: '标尺刻度线，横向/纵向测量标尺刻度线',
  targetGuide: '圆心瞄准准星刻度',
  motionBrackets: '动态目标追踪括号，会在画面移动物体上闪烁绿框，极客、侦测风格',

  // 有机形态 Organic
  glowRing: '发光星环/光圈，表现黑洞、魔法圈、深空，参数 { colorInner: hex, colorOuter: hex }',
  lightSpot: '舞台探照灯亮光，顶部打下来的舞台亮光/扫射光束，极有氛围感，参数 { color: hex, alpha: number }',
  organicBlob: '有机流体 Blob，包含有机流体、海浪、云团三种形态，适合自然、温和、轻飘氛围，参数 { shape: "blob"|"wave"|"cloud", color: hex, alpha: number }',
  smearBrush: '水墨/油漆涂抹笔触底纹，中国风、泼墨、艺术涂鸦常用',

  // 数字废墟 Digital Grunge
  noiseText: '乱码文字，由十六进制和乱码组成的数字废墟背景，表现科技荒废、末日、硬核黑客',
  dataMonitors: '多窗口数据监控终端屏，适合极客、服务器监控、数字化末日',

  // 特殊形状 Special Shape
  crimeTape: '封条警戒线，画面中斜切滚动的黄色警戒封条，表现危险、警示、犯罪现场、狂热',
  bloodSplatter: '血痕，血迹喷溅，适合病娇、高烈度撕裂、死亡、疯狂情绪，参数 { color: hex, alpha: number, count: number }',
  victimOutline: '受害者粉笔轮廓，探案、悬疑、谋杀、黑暗感',
  paperTear: '撕裂纸张，边缘撕裂的拼贴白纸效果，表现日记、破损、朋克手账',
  jigsawGrid: '拼图网格，拼图网格边缘细线，适合破碎、迷惘、重组'
};

/**
 * 构造发给 LLM 的系统提示词。
 *
 * 提示词里会动态展开当前 effectCatalog，因此新增/删除特效后，AI 面板拿到的
 * 可用类型列表会跟代码保持同步。这里同时强调输出必须是纯 JSON，原因是调用方
 * 会直接 JSON.parse；如果模型返回 Markdown 包裹或解释文本，就需要后续清洗或报错。
 */
function buildSystemPrompt(): string {
  // 把 effectCatalog 中的 effects 与 EFFECT_SKILLS 结合，生成向大模型描述的字典。
  const catalogDesc = effectCatalog.map((item: EffectPreset) => {
    const skillText = EFFECT_SKILLS[item.type] || item.label;
    return `- type: "${item.type}", layer: "${item.layer}", 作用: ${skillText}, 默认配置: ${JSON.stringify(item.config)}`;
  }).join('\n');

  return `你是一个享誉业界的 MV (Promotional Video) 与 Kinetic Typography 动效设计大师。请根据用户输入的画面意境、歌词情绪或视觉风格描述，编排出一套充满独创设计感、排版讲究且动效互补的配置参数。

为了保证生成的配置在视觉上达到极其 PREMIUM、前卫且极富设计感的效果，请务必遵循以下【设计圣经】：

### 一、 色彩美学与流派创意 (Color Aesthetics & Creative Freedom)
我们鼓励你进行大胆、前卫的色彩实验，自由创造极富艺术张力的配色方案。以下 5 大经典风格仅供启发，你完全可以混合它们、或探索全新的小众/先锋艺术色盘：
1. **赛博霓虹 (Cyberpunk)**: 极深底色（如暗蓝、墨黑）搭配高亮荧光的青色、霓虹粉或酸性绿。
2. **德式机能 (Minimalist Techwear)**: 纯黑/水泥灰底，配以刺目亮橘色、高级设计灰，高对比排版。
3. **迷幻蒸汽波 (Vaporwave / Acid)**: 梦幻深紫/暗靛蓝底，配以湖蓝、高亮柠檬黄、粉紫渐变。
4. **日式写意青墨 (Zen Ink Wash)**: 粗糙宣纸色/灰白底，搭配泼墨深灰、朱砂红、石青、藤黄。
5. **马卡龙街机 (Retro Pastel)**: 浅淡奶油色、马卡龙蓝粉底，搭配深紫色文字与粗反差描边。

【色彩设计原则】：
- **创意自由**：不受以上分类限制。你可根据意境自由发挥，设计符合用户直觉与情绪的独创色盘（如莫兰迪粉彩、哥特暗黑血浆、未来超现实主义等）。
- **易读底线**：主歌词颜色（text）必须与背景颜色（background）形成极高对比度，确保文字在动态渲染下具有完美的清晰度。

### 二、 黄金特效协同配方 (Innovative Synergy Recipes)
严禁同类型特效盲目堆砌。优秀的排版需要点、线、面、字、后期的有机协同。请根据风格，尝试以下独创协同配方：
- **机甲终端排版 (Mecha Terminal)**: 'perspectiveGrid' (作为地面拉伸) + 'hudCorners' (四周角框) + 'hudStatusText' (闪烁警告) + 'formulaText' (物理背景公式) + 'textCards' (卡片歌词)。
- **情绪撕裂爆发 (Hysteric Split)**: 'diagonalSplit' (旋转斩击) + 'shatterText' (歌词重拍碎裂) + 'glitchBars' (全屏故障条) + 'chromaticAberration' (三原色偏移)，配合高 'postfx.shake' 和 'postfx.glitch'。
- **波普网点涂鸦 (Pop Halftone)**: 'checkerboard' (棋盘背景) + 'halftoneBlocks' (半调网点) + 'crayonShatter' (定格动画手绘字) + 'dotScreen' (纸张网点印刷后期)。
- **深海冥想/夜晚 (Deep Sea Meditation)**: 'organicBlob' (设为 wave 形态作为海浪) + 'starTrail' (星轨运动) + 'glowRing' (发光星环) + 'glowTextCards' (发光歌词卡片)。

### 三、 精细参数调优 (Parameter Micro-Tuning)
请不要只返回默认的 'config: {}'。请根据情绪激烈程度，对特效内部的 config 参数进行微调：
- **动态特效速度 ('rotSpeed' / 'speed')**：激烈场景将斩击或背景块的速度调高，安静唯美场景应设为极低（如 'rotSpeed: 0.05'）以产生呼吸感。
- **特效透明度与层级 ('alpha' / 'opacity')**：确保背景修饰层（decoration 层）的 'alpha' 保持在 '0.1 ~ 0.3' 左右，不要遮挡主歌词。
- **主歌词特效选择**：
  - 激烈、高潮、摇滚：使用 'shatterText' (重拍碎裂效果)。
  - 活泼、童话、怪诞：使用 'crayonShatter' (手绘涂鸦) 或 'waveText' (波浪跃动)。
  - 科技、终端、电子：使用 'pixelTypewriter' (像素打字机) 或 'textStrip' (滚动字条)。
  - 唯美、安静、治愈：使用 'glowTextCards' (发光文字卡片) 或 'bigOutlineText' (大字描边背景)。

# 视觉参数输出约束
请务必返回一个符合 JSON 格式的对象（不要包含 markdown 代码块外套，直接返回纯 JSON），结构必须严格符合以下 \`TemplateConfig\` 接口的定义：

\`\`\`typescript
export interface ColorPalette {
  background: string; // 16进制颜色，例如 "#0b0c10"
  primary: string;    // 16进制主色，通常与背景有高对比，作为前景线条色
  secondary: string;  // 16进制辅色，常作为装饰图案色
  accent: string;     // 16进制强调色，高亮醒目颜色，如荧光黄、桃红等
  text: string;       // 16进制文字颜色，需保证在 background 背景上具有极高的易读性
}

export interface EffectEntry {
  type: string;       // 特效类型，必须严格从下方【特效技能列表】中选择
  layer: string;      // 特效层，必须与下方列表中所选 type 的 layer 一一对应
  config: Record<string, any>; // 特效参数配置，可根据下方建议填写或微调，例如颜色字段可以直接填 "$primary", "$secondary", "$accent", "$text" 动态绑定主题色，也可以填具体16进制颜色
}

export interface TemplateConfig {
  name: string;       // 你为此视觉风格起的合适名称（中文，不超过 10 字）
  palette: ColorPalette;
  effects: EffectEntry[]; // 特效数组，一般建议选择 3~6 个互补的特效叠加以产生丰富且不杂乱的效果。请必须注意图层覆盖顺序：先放 background 层特效，再放 decoration，然后是 text，最后是 overlay。
  postfx?: {
    shake?: number;     // 0.0 ~ 1.0 的画面重拍抖动值，摇滚、震撼风填 0.3~0.7，安静风填 0
    zoom?: number;      // -1.0 ~ 1.0 的重拍缩放比例
    tilt?: number;      // -1.0 ~ 1.0 的画面倾斜值
    glitch?: number;    // 0.0 ~ 1.0 的画面整体故障条痕值，赛博、黑客风填 0.3~0.8，其余填 0
    hueShift?: number;  // -180 ~ 180 的色相偏移度数
  };
  features?: {
    mediaOutline?: boolean;    // 是否开启媒体轮廓检测
    autoExtractColors?: boolean;// 是否开启背景主色提取
    motionDetection?: boolean;  // 是否开启运动侦测HUD框
  }
}
\`\`\`

# 可用的特效技能字典（你可以从中挑选并配置）
${catalogDesc}

# 特别要求
1. 请确保在 \`effects\` 数组中，背景（background 层）特效排在前面，修饰（decoration 层）、文字（text 层）在中间，滤镜/叠加（overlay 层）排在最后。
2. 每一个特效配置如果需要设置颜色，尽量优先使用 \`$primary\`、\`$secondary\`、\`$accent\`、\`$text\` 等变量符号进行动态绑定，以便色盘主题切换时能实时响应。
3. 请以标准的 JSON 字符串返回。不要附带任何类似 "Here is your config" 等多余解释。
`;
}

/**
 * 调用兼容 OpenAI Chat Completions 格式的 LLM 接口，生成 TemplateConfig。
 *
 * 返回值会做三层兜底：
 * 1. 清理可能出现的 Markdown code fence。
 * 2. 校验 name/palette/effects 等核心字段，避免无效结果进入渲染链路。
 * 3. 补齐 palette 和 effect layer/config，降低模型漏字段导致页面崩溃的概率。
 *
 * 注意：这里不做“视觉正确性”判断，只保证结构尽量安全；真正的特效类型是否能渲染，
 * 仍由 PVEngine/createEffect 在加载模板时处理并打印警告。
 */
export async function generateConfigFromAI(
  userPrompt: string,
  apiKey: string,
  apiUrl: string,
  model: string
): Promise<TemplateConfig> {
  const cleanUrl = (apiUrl.trim() || 'https://api.deepseek.com').replace(/\/+$/, '');
  const targetModel = model.trim() || 'deepseek-v4-flash';

  const systemPrompt = buildSystemPrompt();

  const response = await fetch(`${cleanUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('API returned an empty message content.');
  }

  // 清洗可能存在的 Markdown 代码包裹。
  let cleaned = rawContent.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
  }

  const config = JSON.parse(cleaned) as TemplateConfig;

  // 基础校验以保证程序不会崩溃。
  if (!config.name || !config.palette || !Array.isArray(config.effects)) {
    throw new Error('AI generated config lacks required fields (name, palette, or effects).');
  }

  // 保证 palette 字段都存在，避免颜色解析时遇到 undefined。
  const defaultPalette = {
    background: '#000000',
    primary: '#ffffff',
    secondary: '#888888',
    accent: '#ff0055',
    text: '#ffffff'
  };
  config.palette = { ...defaultPalette, ...config.palette };

  // 校验特效的 layer，并为漏填 config 的 effect 补 catalog 默认值。
  config.effects = config.effects.map((fx) => {
    // 自动寻找 catalog 里的 layer
    const found = effectCatalog.find((item: EffectPreset) => item.type === fx.type);
    return {
      type: fx.type,
      layer: fx.layer || found?.layer || 'decoration',
      config: fx.config || found?.config || {}
    };
  });

  return config;
}
