
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

  // 輔助：網路 URL 轉 Base64（修復黑屏關鍵）
  const getBase64 = async (url: string): Promise<string> => {
    if (!url || url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("CORS conversion failed", e);
      return url;
    }
  };

  // 當圖片 URL 變更時，自動轉為 Base64 避免 Canvas 汙染
  useEffect(() => {
    const convertImages = async () => {
      if (data.image && data.image.startsWith('http')) {
        const b64 = await getBase64(data.image);
        setData(prev => ({ ...prev, image: b64 }));
      }
      if (data.bgImage && data.bgImage.startsWith('http')) {
        const b64 = await getBase64(data.bgImage);
        setData(prev => ({ ...prev, bgImage: b64 }));
      }
    };
    convertImages();
  }, [data.image, data.bgImage]);

  // 響應式縮放
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

  // 讀取本地快取
  useEffect(() => {
    const bg = localStorage.getItem('b1690_custom_bg');
    if (bg) setData(prev => ({ ...prev, bgImage: bg }));
  }, []);

  // 當任何數據變動，清空長按圖層
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
          if (id) setData(prev => ({ ...prev, image: `https://lh3.googleusercontent.com/u/0/d/${id}=w1000` }));
        }
      }
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

  const downloadImage = async () => {
    if (!awardRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      // 確保所有 Base64 圖片已就緒
      await new Promise(r => setTimeout(r, 600));
      const dataUrl = await toPng(awardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#000',
        width: 480,
        height: 600,
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      });
      setLongPressImage(dataUrl); // 生成後存入狀態，供長按使用
      const link = document.createElement('a');
      link.download = `賀報_${data.name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      alert("下載失敗，請嘗試長按圖片儲存！");
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
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">姓名</label>
                  <input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-red-500 outline-none" />
                </div>
                <button onClick={syncPhotoFromSheet} disabled={isSyncing} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-600">
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 同步人像
                </button>
              </div>

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
               <button onClick={downloadImage} disabled={isDownloading} className={`w-full ${isDownloading ? 'bg-slate-600' : 'bg-white hover:bg-slate-100'} text-slate-900 font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all`}>
                 {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                 {isDownloading ? '生成中...' : '下載高清賀報'}
               </button>
               <p className="text-center text-slate-500 text-[10px] mt-4 tracking-tighter leading-relaxed">
                 iPhone 若無法下載：點擊按鈕生成後<br/>「長按」右側預覽圖即可儲存
               </p>
            </div>
          </div>
        </div>

        {/* 預覽區 */}
        <div ref={previewWrapperRef} className="md:col-span-8 flex flex-col items-center justify-start min-h-[650px] order-1 md:order-2">
          <div 
            style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', width: '480px', height: '600px', marginBottom: `${(600 * previewScale) - 600}px` }}
            className="relative overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)] bg-black text-white shrink-0"
          >
            {/* 透明長按層：如果已經生成過 dataUrl，就覆蓋上去讓 iPhone 長按 */}
            {longPressImage && (
              <img src={longPressImage} className="absolute inset-0 z-[100] w-full h-full object-contain pointer-events-auto opacity-0" alt="save-me" />
            )}

            <div ref={awardRef} className="w-full h-full relative bg-black">
                {/* 背景底圖 */}
                <div className="absolute inset-0 z-0 bg-neutral-900">
                  <img src={data.bgImage || DEFAULT_BG_URL} crossOrigin="anonymous" className="w-full h-full object-cover" alt="bg" />
                  <div className="absolute inset-0 bg-black/25"></div>
                </div>

                {/* 裝飾框 */}
                <div className="absolute inset-4 z-10 pointer-events-none border border-white/20">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-white/50"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-white/50"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-white/50"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-white/50"></div>
                </div>

                {/* 內容區：pt-6 將內容往上抬一點 */}
                <div className="absolute inset-0 z-20 flex flex-col items-center pt-6 pb-12 px-8 text-center">
                  
                  {/* 頭像：縮小一點至 w-52 讓佈局更寬裕 */}
                  <div className="relative w-52 h-52 mb-4 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.7)] overflow-hidden bg-black/40 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/10">
                    {data.image ? (
                      <img src={data.image} crossOrigin="anonymous" className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      <span className="text-[10rem] font-black font-serif-tc text-white/90">賀</span>
                    )}
                  </div>

                  {/* 姓名 */}
                  <h2 className="text-5xl font-black text-white tracking-[0.15em] drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] font-serif-tc mb-4 shrink-0 leading-tight">
                    {data.name}
                  </h2>

                  {/* 數據看板 */}
                  <div className="w-full max-w-[320px] border-2 border-white rounded-2xl overflow-hidden backdrop-blur-md bg-black/30 shadow-2xl shrink-0">
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

                  {/* 頁尾：mt-auto 結合 pb-12 確保在底部但有足夠空間 */}
                  <div className="mt-auto flex flex-col items-center gap-1.5 opacity-90 shrink-0">
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
          {longPressImage && (
            <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-full border border-red-400/20">
              <span className="text-xs font-bold animate-pulse">✨ 已生成長按儲存圖，請長按預覽圖儲存</span>
            </div>
          )}
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
