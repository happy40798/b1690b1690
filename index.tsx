
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Download, Gem, Calendar, Palette, Loader2, RefreshCw, X, CheckCircle2, Share } from 'lucide-react';
import { toPng } from 'html-to-image';
import defaultBg from './bg.jpg';

// --- Constants ---
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTU3_CIpMZcKYy8HNwz7roxLlUM4ndzxn8AJvtD38IA-VsNykmY9wzU-fkEotDNyy1F955_toROJAy-/pub?output=csv';
const DEFAULT_BG_URL = defaultBg;

const AwardGenerator = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const awardRef = useRef<HTMLDivElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState({
    name: '黃啟倫',
    product: 'PFK', 
    fyp: '100,000',
    fyc: '35,000',
    date: new Date().toISOString().split('T')[0],
    image: null as string | null, 
    bgImage: null as string | null, 
  });

  // 強大且穩定的圖片轉 Base64 工具 (帶有快取排除與 CORS 強制)
  const safeConvertToBase64 = async (url: string): Promise<string> => {
    if (!url || url.startsWith('data:')) return url;
    try {
      const cacheBustUrl = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
      const response = await fetch(cacheBustUrl, { mode: 'cors' });
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Base64 fetch failed:", e);
      return url;
    }
  };

  useEffect(() => {
    const init = async () => {
      const b64 = await safeConvertToBase64(DEFAULT_BG_URL);
      setData(prev => ({ ...prev, bgImage: b64 }));
    };
    init();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (previewWrapperRef.current) {
        const containerWidth = previewWrapperRef.current.offsetWidth;
        const targetWidth = 480; 
        setPreviewScale(containerWidth < targetWidth + 40 ? (containerWidth - 40) / targetWidth : 1);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFileChange = (file: File, target: 'image' | 'bgImage') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = target === 'bgImage' ? 1000 : 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const quality = target === 'bgImage' ? 0.7 : 0.85;
        setData(prev => ({ ...prev, [target]: canvas.toDataURL('image/jpeg', quality) }));
      };
    };
    reader.readAsDataURL(file);
  };

  const syncPhotoFromSheet = async () => {
    if (!data.name.trim()) return alert('請輸入姓名');
    setIsSyncing(true);
    try {
      const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`);
      const csvData = await res.text();
      const rows = csvData.split('\n').map(r => r.split(',').map(c => c.trim().replace(/"/g, '')));
      const target = rows.find(r => r.some(c => c === data.name));
      if (target) {
        const url = target.find(c => c.includes('drive.google.com'));
        if (url) {
          const id = url.includes('/d/') ? url.split('/d/')[1].split('/')[0] : url.split('id=')[1]?.split('&')[0];
          if (id) {
            const photoUrl = `https://lh3.googleusercontent.com/u/0/d/${id}=w1000`;
            const b64 = await safeConvertToBase64(photoUrl);
            setData(prev => ({ ...prev, image: b64 }));
          }
        }
      }
    } catch (e) {
      alert("同步失敗");
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadImage = async () => {
    if (!awardRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      // 關鍵步驟 1：強制 Safari 重新解碼所有 Base64 圖片
      const imgs = Array.from(awardRef.current.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : img.decode().catch(() => {})));
      
      // 關鍵步驟 2：增加微小延遲等待渲染
      await new Promise(r => setTimeout(r, 100));

      const dataUrl = await toPng(awardRef.current, {
        pixelRatio: 2.5,
        backgroundColor: '#000',
        cacheBust: true,
      });

      // 關鍵步驟 3：針對 iPhone 處理
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS && navigator.share) {
        // 如果是 iPhone 且支援分享 API，直接嘗試叫起分享
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `award_${data.name}.png`, { type: 'image/png' });
          await navigator.share({
            files: [file],
            title: '中恩賀報',
          });
        } catch (shareError) {
          // 如果分享被取消或失敗，回退到彈窗長按模式
          setResultImage(dataUrl);
          setShowResult(true);
        }
      } else {
        // PC 或不支持分享的裝置，顯示彈窗並嘗試觸發下載連結
        setResultImage(dataUrl);
        setShowResult(true);

        const link = document.createElement('a');
        link.download = `賀報_${data.name}.png`;
        link.href = dataUrl;
        link.click();
      }
      
    } catch (e) {
      console.error(e);
      alert("生成失敗，建議手動截圖。");
    } finally {
      setIsDownloading(false);
    }
  };

  const getFontSize = (str: string) => {
    const len = str?.toString().length || 0;
    return len > 10 ? 'text-2xl' : len > 7 ? 'text-3xl' : 'text-4xl';
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans text-slate-200 bg-[#0f172a]">
      
      {/* 核心解決方案：iPhone 高清結果彈窗 */}
      {showResult && resultImage && (
        <div className="fixed inset-0 z-[100] bg-[#020617]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <button 
            onClick={() => setShowResult(false)}
            className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <h3 className="text-xl font-bold text-white">賀報製作完成</h3>
            </div>
            <p className="text-[#94a3b8] text-sm">iPhone 使用者請「長按圖片」選擇儲存影像</p>
          </div>

          <div className="relative max-w-full max-h-[75vh] shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-lg overflow-hidden border border-white/10">
            {/* 針對 iPhone 長按優化的 img 標籤 */}
            <img 
              src={resultImage} 
              className="max-w-full max-h-[75vh] object-contain block select-auto pointer-events-auto"
              style={{ WebkitTouchCallout: 'default' } as any}
              alt="Final Award"
            />
          </div>

          <div className="mt-8 flex gap-4">
            <button 
              onClick={() => setShowResult(false)}
              className="px-8 py-3.5 bg-[#334155] text-white rounded-xl font-bold text-sm"
            >
              返回修改
            </button>
            {navigator.share && (
               <button 
                onClick={async () => {
                  const blob = await (await fetch(resultImage)).blob();
                  const file = new File([blob], `award_${data.name}.png`, { type: 'image/png' });
                  navigator.share({ files: [file], title: '分享賀報' }).catch(() => {});
                }}
                className="px-8 py-3.5 bg-red-600 text-white rounded-xl font-bold text-sm flex items-center gap-2"
              >
                <Share className="w-4 h-4" /> 傳送給好友
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10">
        
        {/* 控制面板 */}
        <div className="md:col-span-4 space-y-6 order-2 md:order-1">
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-7 shadow-2xl">
            <div className="mb-8">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Palette className="w-6 h-6 text-red-500" /> 中恩賀報 Pro
              </h1>
              <p className="text-[#64748b] text-[10px] tracking-[0.2em] font-bold mt-1 uppercase">B1690 Premium Edition</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2 block">姓名</label>
                <input 
                  type="text" 
                  value={data.name} 
                  onChange={e => setData({...data, name: e.target.value})} 
                  className="w-full bg-[#0f172a] border border-[#334155] rounded-xl p-3.5 text-white focus:border-red-500 outline-none transition-all" 
                />
              </div>

              <button 
                onClick={syncPhotoFromSheet} 
                disabled={isSyncing} 
                className="w-full bg-[#334155] hover:bg-[#475569] text-white text-sm font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all border border-[#475569]"
              >
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 
                同步人像 (Sheet)
              </button>

              <div>
                <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2 block">成交商品</label>
                <input 
                  type="text" 
                  value={data.product} 
                  onChange={e => setData({...data, product: e.target.value})} 
                  className="w-full bg-[#0f172a] border border-[#334155] rounded-xl p-3.5 text-white focus:border-red-500 outline-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2 block">FYP</label>
                  <input 
                    type="text" 
                    value={data.fyp} 
                    onChange={e => setData({...data, fyp: e.target.value})} 
                    className="w-full bg-[#0f172a] border border-[#334155] rounded-xl p-3.5 text-white font-mono" 
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2 block">FYC</label>
                  <input 
                    type="text" 
                    value={data.fyc} 
                    onChange={e => setData({...data, fyc: e.target.value})} 
                    className="w-full bg-[#0f172a] border border-[#334155] rounded-xl p-3.5 text-white font-mono" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2 block">報件日期</label>
                <input 
                  type="date" 
                  value={data.date} 
                  onChange={e => setData({...data, date: e.target.value})} 
                  className="w-full bg-[#0f172a] border border-[#334155] rounded-xl p-3.5 text-white" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex flex-col items-center justify-center h-24 border-2 border-[#334155] border-dashed rounded-xl cursor-pointer hover:bg-[#334155] transition-colors group">
                  <span className="text-[10px] font-bold text-[#94a3b8] group-hover:text-white transition-colors">更換底圖</span>
                  <input type="file" className="hidden" accept="image/*" onChange={e => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileChange(file, 'bgImage');
                  }} />
                </label>
                <label className="flex flex-col items-center justify-center h-24 border-2 border-[#334155] border-dashed rounded-xl cursor-pointer hover:bg-[#334155] transition-colors group">
                  <span className="text-[10px] font-bold text-[#94a3b8] group-hover:text-white transition-colors">手動人像</span>
                  <input type="file" className="hidden" accept="image/*" onChange={e => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileChange(file, 'image');
                  }} />
                </label>
              </div>
            </div>
            
            <div className="mt-10">
              <button 
                onClick={downloadImage} 
                disabled={isDownloading} 
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-black py-4.5 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-lg"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isDownloading ? '正在生成...' : '下載高清賀報'}
              </button>
              <p className="text-[10px] text-slate-500 mt-4 text-center font-bold tracking-widest uppercase opacity-50">Optimized for iOS & Safari</p>
            </div>
          </div>
        </div>

        {/* 預覽區 */}
        <div ref={previewWrapperRef} className="md:col-span-8 flex flex-col items-center justify-start min-h-[700px] order-1 md:order-2">
          <div 
            style={{ 
              transform: `scale(${previewScale})`, 
              transformOrigin: 'top center', 
              width: '480px', 
              height: '600px', 
              marginBottom: `${(600 * previewScale) - 600}px` 
            }}
            className="relative overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] bg-black shrink-0"
          >
            <div ref={awardRef} className="w-full h-full relative bg-black">
                {/* 背景圖片 */}
                <div className="absolute inset-0 z-0 bg-slate-900">
                  {data.bgImage && <img src={data.bgImage} className="w-full h-full object-cover" alt="background" />}
                </div>

                {/* 裝飾框線 */}
                <div className="absolute inset-5 z-10 pointer-events-none border border-white/20">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/40"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-white/40"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-white/40"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/40"></div>
                </div>

                {/* 內容疊層 */}
                <div className="absolute inset-0 z-20 flex flex-col items-center pt-8 pb-5 px-8 text-center">
                  
                  {/* 頂部單位資訊 */}
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-xs font-black tracking-[0.2em] text-blue-500">B1690</span>
                    <span className="text-blue-500/50 text-xs">|</span>
                    <span className="text-xs font-black tracking-[0.2em] text-blue-500">中恩通訊處</span>
                  </div>

                  {/* 人像圓框 */}
                  <div className="relative w-56 h-56 mb-5 shrink-0">
                    <div className="relative w-full h-full rounded-full overflow-hidden bg-white/10 backdrop-blur-md flex items-center justify-center border-[6px] border-white/20 shadow-2xl">
                      {data.image ? (
                        <img src={data.image} className="w-full h-full object-cover" alt="avatar" />
                      ) : (
                        <span className="text-[10rem] font-black font-serif-tc text-white/10 select-none">賀</span>
                      )}
                    </div>
                  </div>

                  {/* 姓名大字 */}
                  <h2 className="text-[54px] font-black text-[#F45C59] tracking-[0.15em] drop-shadow-[0_4px_12px_rgba(251,191,36,0.8)] mb-4 shrink-0 leading-tight">
                    {data.name}
                  </h2>

                  {/* 數據看板 */}
                  <div className="w-full max-w-[340px] border border-white/90 rounded-2xl overflow-hidden bg-black/10 backdrop-blur-md shadow-2xl shrink-0">
                    <div className="py-2.5 bg-white/20 border-b border-white/10">
                      <p className="text-3xl font-black tracking-widest text-[#F197A4] drop-shadow-sm">成交 {data.product}</p>
                    </div>
                    <div className="flex relative">
                      <div className="absolute inset-y-4 left-1/2 w-[1px] bg-white/20"></div>
                      <div className="flex-1 py-4">
                        <p className="text-xs font-black text-white uppercase tracking-widest mb-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">FYP</p>
                        <p className={`${getFontSize(data.fyp)} font-black text-[#fbbf24] font-mono leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]`}>{data.fyp}</p>
                      </div>
                      <div className="flex-1 py-4">
                        <p className="text-xs font-black text-white uppercase tracking-widest mb-1 flex items-center justify-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          <Gem className="w-3 h-3" /> FYC
                        </p>
                        <p className={`${getFontSize(data.fyc)} font-black text-[#fbbf24] font-mono leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]`}>{data.fyc}</p>
                      </div>
                    </div>
                  </div>

                  {/* 頁尾資訊 */}
                  <div className="mt-auto flex flex-col items-center gap-2 opacity-95 shrink-0">
                    <div className="flex items-center gap-2 text-white/90 font-mono text-sm tracking-widest bg-black/20 px-4 py-1 rounded-full border border-white/5">
                      <Calendar className="w-3.5 h-3.5 opacity-80" />
                      {data.date.replace(/-/g, '.')}
                    </div>
                  </div>
                </div>
            </div>
          </div>
          <p className="text-slate-500 text-[11px] mt-6 tracking-wide font-medium">預覽畫面僅供參考，下載圖檔為高清原尺寸</p>
        </div>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><AwardGenerator /></React.StrictMode>);
}

export default AwardGenerator;
