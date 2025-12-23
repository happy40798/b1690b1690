
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Download, Gem, Calendar, Palette, Image as ImageIcon, X, Layout, Loader2, RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';

// --- Constants & Utilities ---
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTU3_CIpMZcKYy8HNwz7roxLlUM4ndzxn8AJvtD38IA-VsNykmY9wzU-fkEotDNyy1F955_toROJAy-/pub?output=csv';
const DEFAULT_BG_URL = 'https://lh3.googleusercontent.com/u/0/d/1AffsJ-awf6jfdme6nlFp4Y991gIA_rRm=w1600';

const AwardGenerator = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [longPressImage, setLongPressImage] = useState<string | null>(null);

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

  // 核心修復：更強大的 Base64 轉換器，專門處理 iPhone 下載空白問題
  const convertUrlToBase64 = async (url: string): Promise<string> => {
    if (!url || url.startsWith('data:')) return url;
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Base64 conversion failed:", e);
      return url; // 失敗則回傳原網址 (雖然這可能導致下載空白)
    }
  };

  // 自動轉換背景與照片
  useEffect(() => {
    const processImages = async () => {
      if (data.image && data.image.startsWith('http')) {
        const b64 = await convertUrlToBase64(data.image);
        setData(prev => ({ ...prev, image: b64 }));
      }
      if (!data.bgImage) {
        const b64 = await convertUrlToBase64(DEFAULT_BG_URL);
        setData(prev => ({ ...prev, bgImage: b64 }));
      } else if (data.bgImage.startsWith('http')) {
        const b64 = await convertUrlToBase64(data.bgImage);
        setData(prev => ({ ...prev, bgImage: b64 }));
      }
    };
    processImages();
  }, [data.image, data.bgImage]);

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

  useEffect(() => {
    const bg = localStorage.getItem('b1690_custom_bg');
    if (bg) setData(prev => ({ ...prev, bgImage: bg }));
  }, []);

  useEffect(() => {
    setLongPressImage(null);
  }, [data.name, data.product, data.fyp, data.fyc, data.date, data.image, data.bgImage]);

  const compressImage = (file: File, callback: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000; 
        const scale = MAX_WIDTH / img.width;
        if (scale >= 1) { callback(event.target?.result as string); return; }
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  };

  const syncPhotoFromSheet = async () => {
    if (!data.name.trim()) return alert('請輸入姓名');
    setIsSyncing(true);
    try {
      const res = await fetch(SHEET_CSV_URL);
      const rows = (await res.text()).split('\n').map(r => r.split(',').map(c => c.trim().replace(/"/g, '')));
      const target = rows.find(r => r.some(c => c === data.name));
      if (target) {
        const url = target.find(c => c.includes('drive.google.com'));
        if (url) {
          const id = url.includes('/d/') ? url.split('/d/')[1].split('/')[0] : url.split('id=')[1]?.split('&')[0];
          if (id) {
            const photoUrl = `https://lh3.googleusercontent.com/u/0/d/${id}=w1000`;
            const b64 = await convertUrlToBase64(photoUrl);
            setData(prev => ({ ...prev, image: b64 }));
          }
        }
      }
    } catch (e) { 
      console.error(e); 
      alert("同步失敗，請手動上傳照片");
    } finally { 
      setIsSyncing(false); 
    }
  };

  const downloadImage = async () => {
    if (!awardRef.current || isDownloading) return;
    setIsDownloading(true);

    try {
      // 下載前最後確認：確保照片和底圖都是 Base64 格式
      let finalImg = data.image;
      let finalBg = data.bgImage;

      if (data.image && data.image.startsWith('http')) {
        finalImg = await convertUrlToBase64(data.image);
      }
      if (data.bgImage && data.bgImage.startsWith('http')) {
        finalBg = await convertUrlToBase64(data.bgImage);
      } else if (!data.bgImage) {
        finalBg = await convertUrlToBase64(DEFAULT_BG_URL);
      }

      // 如果有變動則更新狀態並等待渲染
      if (finalImg !== data.image || finalBg !== data.bgImage) {
        setData(prev => ({ ...prev, image: finalImg, bgImage: finalBg }));
        await new Promise(r => setTimeout(r, 800)); // 給予瀏覽器時間渲染新的 Base64
      } else {
        await new Promise(r => setTimeout(r, 300));
      }

      const dataUrl = await toPng(awardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#000',
        width: 480,
        height: 600,
        cacheBust: true, // 強制清除快取
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      });

      setLongPressImage(dataUrl); 
      const link = document.createElement('a');
      link.download = `賀報_${data.name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Download error:", e);
      alert("下載過程發生錯誤，請截圖或重試。");
    } finally {
      setIsDownloading(false);
    }
  };

  const getFontSize = (str: string) => {
    const len = str?.toString().length || 0;
    return len > 10 ? 'text-2xl' : len > 7 ? 'text-3xl' : 'text-4xl';
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans text-slate-200 bg-slate-900">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* 控制面板 */}
        <div className="md:col-span-4 space-y-5 order-2 md:order-1">
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-6 shadow-2xl">
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
              <Palette className="w-6 h-6 text-red-500" /> 中恩賀報 Pro
            </h1>
            <p className="text-slate-500 text-[10px] tracking-widest uppercase mb-6">B1690 Premium Edition</p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">姓名</label>
                <input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-red-500 outline-none" />
              </div>
              <button onClick={syncPhotoFromSheet} disabled={isSyncing} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-600">
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 同步人像
              </button>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">成交商品</label>
                <input type="text" value={data.product} onChange={e => setData({...data, product: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-red-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">FYP</label>
                  <input type="text" value={data.fyp} onChange={e => setData({...data, fyp: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">FYC</label>
                  <input type="text" value={data.fyc} onChange={e => setData({...data, fyc: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">報件日期</label>
                <input type="date" value={data.date} onChange={e => setData({...data, date: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex flex-col items-center justify-center h-16 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer hover:bg-slate-700/50">
                  <span className="text-[10px] font-bold text-slate-400">更換底圖</span>
                  <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && compressImage(e.target.files[0], b => setData({...data, bgImage: b}))} />
                </label>
                <label className="flex flex-col items-center justify-center h-16 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer hover:bg-slate-700/50">
                  <span className="text-[10px] font-bold text-slate-400">手動照片</span>
                  <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && compressImage(e.target.files[0], b => setData({...data, image: b}))} />
                </label>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-700">
               <button onClick={downloadImage} disabled={isDownloading} className={`w-full ${isDownloading ? 'bg-slate-600 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} text-slate-900 font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all`}>
                 {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                 {isDownloading ? '生成中...' : '下載高清賀報'}
               </button>
            </div>
          </div>
        </div>

        {/* 預覽區 */}
        <div ref={previewWrapperRef} className="md:col-span-8 flex flex-col items-center justify-start min-h-[650px] order-1 md:order-2">
          <div 
            style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', width: '480px', height: '600px', marginBottom: `${(600 * previewScale) - 600}px` }}
            className="relative overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)] bg-black text-white shrink-0"
          >
            {/* 隱形長按圖層：僅在生成後覆蓋，不干擾視覺 */}
            {longPressImage && (
              <img src={longPressImage} className="absolute inset-0 z-[100] w-full h-full object-contain pointer-events-auto opacity-0" alt="save-me" />
            )}

            <div ref={awardRef} className="w-full h-full relative bg-black">
                {/* 背景底圖：移除 crossOrigin 以適配 Base64 */}
                <div className="absolute inset-0 z-0 bg-neutral-900">
                  <img src={data.bgImage || DEFAULT_BG_URL} className="w-full h-full object-cover" alt="bg" />
                  <div className="absolute inset-0 bg-black/15"></div>
                </div>

                {/* 裝飾框 */}
                <div className="absolute inset-4 z-10 pointer-events-none border border-white/20">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-white/50"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-white/50"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-white/50"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-white/50"></div>
                </div>

                {/* 內容區：pt-10 確保向下移一點 */}
                <div className="absolute inset-0 z-20 flex flex-col items-center pt-10 pb-12 px-8 text-center">
                  
                  {/* 人像：移除所有邊框，純圓形剪裁 */}
                  <div className="relative w-52 h-52 mb-4 shrink-0 flex items-center justify-center">
                    <div className="absolute inset-[-12px] rounded-full bg-gradient-to-b from-black/0 to-black/60 blur-xl opacity-70"></div>
                    <div className="relative w-full h-full rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center">
                      {data.image ? (
                        <img src={data.image} className="w-full h-full object-cover" alt="avatar" />
                      ) : (
                        <span className="text-[10rem] font-black font-serif-tc text-white/90">賀</span>
                      )}
                    </div>
                  </div>

                  {/* 姓名 */}
                  <h2 className="text-5xl font-black text-white tracking-[0.15em] drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] font-serif-tc mb-4 shrink-0 leading-tight">
                    {data.name}
                  </h2>

                  {/* 數據看板 */}
                  <div className="w-full max-w-[320px] border-2 border-white rounded-2xl overflow-hidden bg-black/40 shadow-2xl shrink-0">
                    <div className="py-2 bg-white/10 border-b border-white/20">
                      <p className="text-lg font-bold tracking-widest text-white drop-shadow-md">成交 {data.product}</p>
                    </div>
                    <div className="flex relative">
                      <div className="absolute inset-y-3 left-1/2 w-[1px] bg-white/20"></div>
                      <div className="flex-1 py-3.5">
                        <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">FYP</p>
                        <p className={`${getFontSize(data.fyp)} font-black text-white font-mono leading-tight`}>{data.fyp}</p>
                      </div>
                      <div className="flex-1 py-3.5">
                        <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5 flex items-center justify-center gap-1">
                          <Gem className="w-2.5 h-2.5" /> FYC
                        </p>
                        <p className={`${getFontSize(data.fyc)} font-black text-white font-mono leading-tight`}>{data.fyc}</p>
                      </div>
                    </div>
                  </div>

                  {/* 頁尾 */}
                  <div className="mt-auto flex flex-col items-center gap-1.5 opacity-95 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black tracking-[0.2em] text-white">B1690</span>
                      <span className="text-white/30">|</span>
                      <span className="text-[10px] font-black tracking-[0.3em] text-white">中恩通訊處</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90 font-mono text-sm tracking-widest">
                      <Calendar className="w-3.5 h-3.5 opacity-60" />
                      {data.date.replace(/-/g, '.')}
                    </div>
                  </div>
                </div>
            </div>
          </div>
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
