
import React, { useState, useRef } from 'react';
import { GeminiService } from '../geminiService';
import { GeneratedImage, AspectRatio } from '../types';

interface EditorViewProps {
  onImageGenerated: (img: GeneratedImage) => void;
}

type Step = 'IDLE' | 'PROCESSING' | 'COMPLETED';
type TextureType = '水晶绒点塑底' | '天鹅绒点塑底' | '硅藻泥';

const SCENE_OPTIONS = ['客厅', '卧室', '厨房', '儿童房', '浴室', '门垫', '室内过道', '室外'];

const EditorView: React.FC<EditorViewProps> = ({ onImageGenerated }) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('IDLE');
  const [pipelineProgress, setPipelineProgress] = useState(0);
  
  const [reloadingImages, setReloadingImages] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [texture, setTexture] = useState<TextureType>('水晶绒点塑底');
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [style, setStyle] = useState('');
  const [width, setWidth] = useState('750');
  const [height, setHeight] = useState('1000');
  
  // Explicitly type the results state to Record<string, string | null> to avoid 'unknown' errors
  const [results, setResults] = useState<Record<string, string | null>>({
    '地毯原图': null,
    '主图_01': null,
    '主图_02': null,
    '主图_03': null,
    '主图_04': null,
    '主图_05': null,
  });

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          setSourceImage(result);
        }
        setResults({ 
          '地毯原图': null, '主图_01': null, '主图_02': null, 
          '主图_03': null, '主图_04': null, '主图_05': null
        });
        setCurrentStep('IDLE');
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleScene = (sceneName: string) => {
    setSelectedScenes(prev => 
      prev.includes(sceneName) 
        ? prev.filter(s => s !== sceneName) 
        : [...prev, sceneName]
    );
  };

  const getClosestAspectRatio = (w: number, h: number): AspectRatio => {
    const ratio = w / h;
    const options: { val: number; label: AspectRatio }[] = [
      { val: 1, label: '1:1' }, { val: 3 / 4, label: '3:4' }, { val: 4 / 3, label: '4:3' },
      { val: 9 / 16, label: '9:16' }, { val: 16 / 9, label: '16:9' },
    ];
    const closest = options.reduce((prev, curr) => 
      Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev
    , options[0]);
    return closest.label;
  };

  const getPromptForType = (type: string, targetW: number, targetH: number): string => {
    const sceneText = selectedScenes.length > 0 ? selectedScenes.join('、') : "简约现代室内空间";

    switch (type) {
      case '地毯原图':
        const overlockDesc = texture === '硅藻泥' 
          ? "无锁边工艺，边缘平整，展示硅藻泥特有的自然裁切感。" 
          : "增加精细的缝线锁边（overlock stitching），锁边颜色吸取图案中的主色调，增强毯面真实质感。";
        return `任务：根据底图生成高清地毯平铺效果图。要求：完全保留地毯原有的形状、图案和颜色。${overlockDesc} 画面保持纯净，正上方俯视。输出比例应为 ${targetW}:${targetH}。地毯原图输出大小与填写的输出规格 ${targetW}x ${targetH} 一致。`;
      case '主图_01':
        return `这是一张俄罗斯电商平台的地毯商品主图首图，请根据第一张生成的地毯原图.jpg，结合应用场景（${sceneText}）和风格描述（${style || '清新、高质感电商风格'}），生成一张地毯场景图。同时图片顶部有巨大的俄语文字标题“КОВЕР”，下方是与“КОВЕР”两边对齐的“БЕЗВОРСОВЫЙ”，再下方有一个标签，上面写着文字“РАЗЛИЧНЫЕ РАЗМЕРЫ”。文字颜色调整为与整体场景色调和谐，所有文字需要清晰可见，文字可以根据场景和地毯的风格增加一些符合调性的设计感。同时，所有文字元素都不能对图片中的地毯有遮挡，地毯需要完整的被展示出来。也不要在生成的图片上增加边框或其他元素。图片中的俄语文字标题“КОВЕР”，“БЕЗВОРСОВЫЙ”，和“РАЗЛИЧНЫЕ РАЗМЕРЫ”等文字元素，不可以直接 p 到地毯上面，而是作为电商主图首图中的标题元素 appear。地毯原图输出大小与填写的输出规格 ${targetW}x ${targetH} 一致。`;
      case '主图_02':
        return `这是一张俄罗斯电商平台的地毯商品主图第二张图，请根据第一张生成的地毯原图.jpg，结合选择的应用场景（${sceneText}）和风格描述（${style || '和谐'}），生成一张地毯场景图。生成的视角是侧方透视视角，地毯完全自然的融入场景中，视觉上不会觉得假。生成的所有图片中，地毯场景和地毯图案的整体色调需要和谐，不突兀。`;
      case '主图_03':
        return `这是一张俄罗斯电商平台的地毯商品主图第二张图，请根据第一张生成的地毯原图.jpg，结合选择的应用场景（${sceneText}）和风格描述（${style || '和谐'}），生成一张地毯场景图。生成的视角是低角度远景视角，地毯完全自然的融入场景中，视觉上不会觉得假。生成的所有图片中，地毯场景和地毯图案的整体色调需要和谐，不突兀。`;
      case '主图_04':
        return `这是一张俄罗斯电商平台的地毯商品主图第二张图，请根据第一张生成的地毯原图.jpg，结合选择的应用场景（${sceneText}）和风格描述（${style || '和谐'}），生成一张地毯场景图。生成的视角是正面微俯视视角，地毯完全自然的融入场景中，视觉上不会觉得假。生成的所有图片中，地毯场景和地毯图案的整体色调需要和谐，不突兀。`;
      case '主图_05':
        if (texture === '水晶绒点塑底') {
          return `【材质细节图】展示地毯局部特写，一角微微翘起，露出背面的白色波点点塑防滑底，质感细腻。`;
        } else if (texture === '天鹅绒点塑底') {
          return `【材质细节图】展示地毯局部特写，地毯卷起一部分，展示黑底白波点的背面，手感厚实。`;
        } else {
          return `【材质细节图】展示硅藻泥材质地毯的边缘和防滑底特写，无锁边切割感，背面有黑色防滑纹理。`;
        }
      default:
        return "";
    }
  };

  const handleRedo = async (name: string) => {
    if (!sourceImage || !results['地毯原图']) return;
    setReloadingImages(prev => new Set(prev).add(name));
    setError(null);

    const targetW: number = parseInt(width) || 750;
    const targetH: number = parseInt(height) || 1000;
    const apiRatio: AspectRatio = getClosestAspectRatio(targetW, targetH);
    const prompt = getPromptForType(name, targetW, targetH);
    
    const ratioToUse = (name === '主图_05') ? '1:1' : apiRatio;
    
    // All main images now use '地毯原图' as the base.
    let baseImg: string;
    if (name === '地毯原图') {
      baseImg = sourceImage;
    } else if (['主图_01', '主图_02', '主图_03', '主图_04', '主图_05'].includes(name)) {
      baseImg = results['地毯原图'] as string;
    } else {
      baseImg = (results['地毯原图'] || sourceImage) as string;
    }

    try {
      const newUrl = await GeminiService.processImage(baseImg, prompt, ratioToUse);
      setResults((prev: Record<string, string | null>) => ({ ...prev, [name]: newUrl }));
    } catch (err: any) {
      console.error(err);
      setError(`重做 ${name} 失败：${err.message}`);
    } finally {
      setReloadingImages(prev => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  };

  const runFullPipeline = async () => {
    if (!sourceImage) return;
    setError(null);
    setCurrentStep('PROCESSING');
    setPipelineProgress(0);

    const targetW: number = parseInt(width) || 750;
    const targetH: number = parseInt(height) || 1000;
    const apiRatio: AspectRatio = getClosestAspectRatio(targetW, targetH);
    
    try {
      setPipelineProgress(1);
      const originalUrl = (await GeminiService.processImage(sourceImage, getPromptForType('地毯原图', targetW, targetH), apiRatio)) as string;
      setResults((prev: Record<string, string | null>) => ({ ...prev, '地毯原图': originalUrl }));

      setPipelineProgress(2);
      // 主图_01
      const main01Url = await GeminiService.processImage(originalUrl, getPromptForType('主图_01', targetW, targetH), apiRatio);
      setResults((prev: Record<string, string | null>) => ({ ...prev, '主图_01': main01Url }));

      setPipelineProgress(3);
      // 主图_05 (Material details)
      const main05Url = await GeminiService.processImage(originalUrl, getPromptForType('主图_05', targetW, targetH), '1:1');
      setResults((prev: Record<string, string | null>) => ({ ...prev, '主图_05': main05Url }));

      setPipelineProgress(4);
      
      const fetchWithDelay = async (name: string, base: string, delay: number): Promise<string> => {
        await new Promise(r => setTimeout(r, delay));
        return GeminiService.processImage(base, getPromptForType(name, targetW, targetH), apiRatio);
      };

      // These scenes now all use originalUrl as the base
      const [s2, s3, s4] = (await Promise.all([
        fetchWithDelay('主图_02', originalUrl, 0),
        fetchWithDelay('主图_03', originalUrl, 1000),
        fetchWithDelay('主图_04', originalUrl, 2000),
      ])) as [string, string, string];

      setResults((prev: Record<string, string | null>) => ({
        ...prev,
        '主图_02': s2, '主图_03': s3, '主图_04': s4,
      }));

      setCurrentStep('COMPLETED');
    } catch (err: any) {
      console.error(err);
      setError(`渲染中断：${err.message || '未知错误，请重试'}`);
      setCurrentStep('IDLE');
    }
  };

  const downloadAll = () => {
    Object.entries(results).forEach(([name, url]) => {
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}.jpg`;
        link.click();
      }
    });
  };

  return (
    <div className="space-y-8 pb-40 relative animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-2 h-8 bg-indigo-600 rounded-full inline-block shadow-lg shadow-indigo-500/20" />
            OZON地毯主图 <span className="text-indigo-600 dark:text-indigo-400 font-light">渲染</span>
          </h1>
          <p className="text-slate-500 dark:text-zinc-500 text-sm mt-1 font-medium">高效批量渲染全套电商营销素材卡片。</p>
        </div>
        {currentStep === 'COMPLETED' && (
          <button onClick={downloadAll} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-black shadow-xl transition-all active:scale-95">
            打包下载全套素材
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-1 space-y-6">
          <section 
            onClick={() => currentStep !== 'PROCESSING' && fileInputRef.current?.click()}
            className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden cursor-pointer shadow-sm ${
              sourceImage 
                ? 'bg-white dark:bg-black border-indigo-500/30' 
                : 'bg-white/50 dark:bg-zinc-900/20 border-slate-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-zinc-700'
            }`}
          >
            {sourceImage ? <img src={sourceImage} className="w-full h-full object-contain p-2" /> : (
              <div className="text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-300 dark:text-zinc-700">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2.5} /></svg>
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-zinc-600">上传底稿图案</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          </section>

          <div className="bg-white/80 dark:bg-zinc-900/40 p-5 rounded-3xl border border-slate-200 dark:border-zinc-800/50 space-y-5 backdrop-blur-md shadow-sm transition-colors duration-500">
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">地毯材质</label>
              <div className="grid grid-cols-1 gap-1.5">
                {(['水晶绒点塑底', '天鹅绒点塑底', '硅藻泥'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTexture(t)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left border transition-all duration-300 ${
                      texture === t 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                        : 'bg-slate-50 dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-indigo-500/30'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">应用场景 (多选)</label>
              <div className="flex flex-wrap gap-1.5">
                {SCENE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleScene(s)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 border ${
                      selectedScenes.includes(s)
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 hover:border-indigo-500/30'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">补充描述 / 视觉风格</label>
                <input 
                  type="text" 
                  value={style} 
                  onChange={(e) => setStyle(e.target.value)} 
                  placeholder="如：马卡龙色系、复古美式" 
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500/50 transition-all placeholder-slate-300 dark:placeholder-zinc-700 font-medium"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">输出规格</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white font-bold" />
                  <span className="text-slate-300 dark:text-zinc-700 font-black">×</span>
                  <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white font-bold" />
                </div>
              </div>
            </div>

            <button
              onClick={runFullPipeline}
              disabled={currentStep === 'PROCESSING' || !sourceImage}
              className={`w-full py-4 rounded-2xl font-black transition-all duration-300 shadow-xl ${
                currentStep === 'PROCESSING' || !sourceImage 
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-300 dark:text-zinc-600 cursor-not-allowed shadow-none' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 shadow-indigo-500/20'
              }`}
            >
              {currentStep === 'PROCESSING' ? '全链路渲染中...' : '开始批量执行'}
            </button>
            {error && <p className="text-[11px] text-red-500 font-bold text-center animate-pulse px-4">{error}</p>}
          </div>
        </div>

        <div className="xl:col-span-3">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(results).map(([name, url]) => (
              <div key={name} className="space-y-3 group">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">{name}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {url && !reloadingImages.has(name) && (
                      <>
                        <button onClick={() => setPreviewUrl(url)} className="text-[9px] font-black text-slate-400 hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-white transition-colors uppercase">Preview</button>
                        <button onClick={() => handleRedo(name)} className="text-[9px] font-black text-slate-400 hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-white transition-colors uppercase">Redo</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="aspect-[4/5] bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden relative shadow-md dark:shadow-2xl transition-colors duration-500">
                  {url && !reloadingImages.has(name) ? (
                    <img src={url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      {(currentStep === 'PROCESSING' || reloadingImages.has(name)) ? (
                        <>
                          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
                          <span className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest">Rendering</span>
                        </>
                      ) : (
                        <div className="text-slate-100 dark:text-zinc-900">
                           <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 dark:bg-black/95 backdrop-blur-md flex items-center justify-center p-8 transition-all duration-500" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-300">
            <img src={previewUrl} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
            <button className="absolute top-0 right-0 p-6 text-white/50 hover:text-white transition-colors" onClick={() => setPreviewUrl(null)}>
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorView;
