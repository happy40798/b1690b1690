
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Download, Gem, Calendar, Palette, Image as ImageIcon, X, Layout, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toPng } from 'html-to-image';

// --- Constants ---
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTU3_CIpMZcKYy8HNwz7roxLlUM4ndzxn8AJvtD38IA-VsNykmY9wzU-fkEotDNyy1F955_toROJAy-/pub?output=csv';
const DEFAULT_BG_URL = 'https://lh3.googleusercontent.com/u/0/d/1AffsJ-awf6jfdme6nlFp4Y991gIA_rRm=w1600';

const AwardGenerator = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);

  const awardRef = useRef<HTMLDivElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState({
    name: '黃啟倫',
    product: 'PFK', 
    fyp: '100,000',
    fyc: '35,000',
    date: new Date().toISOString().split('T')[0],
    image: null as string | null, 
    bgImage: null as string | null, // 初始設為 null，由 useEffect 轉 Base64
  });

  // 強制轉換網址圖片為 Base64 以防止 Safari Canvas Tainted 錯誤
  const convertToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Base64 conversion error:", e);
      return url; // 失敗則回傳原網址
    }
  };

  // 初始化載入底圖的 Base64
  useEffect(() => {
    const initBg = async () => {
      const b64 = await convertToBase64(DEFAULT_BG_URL);
      setData(prev => ({ ...prev, bgImage: b64 }));
    };
    initBg();
  }, []);

  // 響應式預覽縮放
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

  const compressImage = (file: File, callback: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        const targetScale = scale >= 1 ? 1 : scale;
        canvas.width = img.width * targetScale;
        canvas.height = img.height * targetScale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.85));
      };
    };
  };

  const syncPhotoFromSheet = async () => {
    if (!data.name.trim()) return alert('請輸入姓名');
    setIsSyncing(true);
    try {
      const res = await fetch(SHEET_CSV_URL);
      const csvData = await res.text();
      const rows = csvData.split('\n').map(r => r.split(',').map(c => c.trim().replace(/"/g, '')));
      const target = rows.find(r => r.some(c => c === data.name));
      
      if (target) {
        const url = target.find(c => c.includes('drive.google.com'));
        if (url) {
          const id = url.includes('/d/') ? url.split('/d/')[1].split('/')[0] : url.split('id=')[1]?.split('&')[0];
          if (id) {
            const photoUrl = `https://lh3.googleusercontent.com/u/0/d/${id}=w1000`;
            const b64 = await convertToBase64(photoUrl);
            setData(prev => ({ ...prev, image: b64 }));
          }
        } else {
          alert('找到姓名但未偵測到照片連結');
        }
      } else {
        alert('找不到此姓名，請確認輸入是否正確');
      }
    } catch (e) { 
      console.error(e); 
      alert("同步失敗，請確認網路或嘗試手動上傳");
    } finally { 
      setIsSyncing(false); 
    }
  };

  const downloadImage = async () => {
    if (!awardRef.current || isDownloading) return;
    setIsDownloading(true);
    
    // 給予 UI 一點反應時間
    await new Promise(r => setTimeout(r, 100));

    try {
      const dataUrl = await toPng(awardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#000',
        width: 480,
        height: 600,
        cacheBust: true,
        // 確保字體加載
        skipFonts: false,
      });
      
      setResultImageUrl(dataUrl);
      setShowResultModal(true);

      // 同時嘗試傳統下載（PC端有效）
      const link = document.createElement('a');
      link.download = `賀報_${data.name}.png`;
      link.href = dataUrl;
      link.click();
      
    } catch (e) {
      console.error(e);
      alert("產生失敗，請確認圖片載入正確或嘗試截圖。");
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
      {/* 下載結果彈窗 - 解決 iPhone 下載問題 */}
      {showResultModal && resultImageUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
          <button 
            onClick={() => setShowResultModal(false)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <h3 className="text-xl font-bold text-white">賀報生成成功！</h3>
            </div>
            <p className="text-slate-400 text-sm">iPhone 用戶請「長按下方圖片」選擇「儲存至照片」</p>
          </div>

          <div className="relative group max-w-full max-h-[70vh] shadow-2xl rounded-lg overflow-hidden border border-white/20">
            <img 
              src={resultImageUrl} 
              className="max-w-full max-h-[70vh] object-contain cursor-pointer"
              alt="Generated Result"
            />
          </div>

          <button 
            onClick={() => setShowResultModal(false)}
            className="mt-8 px-10 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all"
          >
            返回編輯
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* 控制面板 */}
        <div className="md:col-span-4 space-y-5 order-2 md:order-1">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl">
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
              <Palette className="w-6 h-6 text-red-500" /> 中恩賀報 Pro
            </h1>
            <p className="text-slate-500 text-[10px] tracking-widest uppercase mb-6">B1690 Premium Edition</p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">姓名</label>
                <input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-red-500 outline-none transition-all" />
              </div>
              
              <button onClick={syncPhotoFromSheet} disabled={isSyncing} className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-600">
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 同步人像 (Sheet)
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
                <label className="flex flex-col items-center justify-center h-16 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 text-center">更換底圖</span>
                  <input type="file" className="hidden" accept="image/*" onChange={e => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files?.[0]) compressImage(files[0], b => setData({...data, bgImage: b}));
                  }} />
                </label>
                <label className="flex flex-col items-center justify-center h-16 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 text-center">手動人像</span>
                  <input type="file" className="hidden" accept="image/*" onChange={e => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files?.[0]) compressImage(files[0], b => setData({...data, image: b}));
                  }} />
                </label>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-700">
               <button onClick={downloadImage} disabled={isDownloading || !data.bgImage} className={`w-full ${isDownloading ? 'bg-slate-600 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} text-slate-900 font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95`}>
                 {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                 {isDownloading ? '正在生成圖片...' : '下載高清賀報'}
               </button>
               <p className="text-[9px] text-slate-500 mt-3 text-center uppercase tracking-widest">Optimized for iOS & Safari</p>
            </div>
          </div>
        </div>

        {/* 預覽區 */}
        <div ref={previewWrapperRef} className="md:col-span-8 flex flex-col items-center justify-start min-h-[650px] order-1 md:order-2">
          <div 
            style={{ 
              transform: `scale(${previewScale})`, 
              transformOrigin: 'top center', 
              width: '480px', 
              height: '600px', 
              marginBottom: `${(600 * previewScale) - 600}px` 
            }}
            className="relative overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)] bg-black shrink-0"
          >
            <div ref={awardRef} className="w-full h-full relative bg-black">
                {/* 背景底圖 - 必須使用 Base64 否則 Safari 會報 tainted canvas */}
                <div className="absolute inset-0 z-0 bg-neutral-100">
                  {data.bgImage && (
                    <img src={data.bgImage} className="w-full h-full object-cover" alt="bg" />
                  )}
                </div>

                {/* 裝飾框 */}
                <div className="absolute inset-4 z-10 pointer-events-none border border-white/20">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-white/50"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-white/50"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-white/50"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-white/50"></div>
                </div>

                {/* 內容區 */}
                <div className="absolute inset-0 z-20 flex flex-col items-center pt-14 pb-8 px-8 text-center">
                  
                  {/* 人像 */}
                  <div className="relative w-52 h-52 mb-4 shrink-0">
                    <div className="absolute inset-[-15px] rounded-full bg-gradient-to-b from-black/0 to-black/30 blur-2xl opacity-40"></div>
                    <div className="relative w-full h-full rounded-full overflow-hidden bg-neutral-200 flex items-center justify-center border-4 border-white/10 shadow-2xl">
                      {data.image ? (
                        <img src={data.image} className="w-full h-full object-cover" alt="avatar" />
                      ) : (
                        <span className="text-[10rem] font-black font-serif-tc text-black/10">賀</span>
                      )}
                    </div>
                  </div>

                  {/* 姓名 */}
                  <h2 className="text-5xl font-black text-white tracking-[0.15em] drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] font-serif-tc mb-4 shrink-0 leading-tight">
                    {data.name}
                  </h2>

                  {/* 數據看板 */}
                  <div className="w-full max-w-[320px] border-2 border-white rounded-2xl overflow-hidden bg-black/10 backdrop-blur-sm shadow-xl shrink-0">
                    <div className="py-2 bg-white/20 border-b border-white/20">
                      <p className="text-lg font-bold tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">成交 {data.product}</p>
                    </div>
                    <div className="flex relative">
                      <div className="absolute inset-y-3 left-1/2 w-[1px] bg-white/20"></div>
                      <div className="flex-1 py-3.5">
                        <p className="text-[9px] font-black text-white/70 uppercase tracking-widest mb-0.5 drop-shadow-sm">FYP</p>
                        <p className={`${getFontSize(data.fyp)} font-black text-white font-mono leading-tight drop-shadow-md`}>{data.fyp}</p>
                      </div>
                      <div className="flex-1 py-3.5">
                        <p className="text-[9px] font-black text-white/70 uppercase tracking-widest mb-0.5 flex items-center justify-center gap-1 drop-shadow-sm">
                          <Gem className="w-2.5 h-2.5" /> FYC
                        </p>
                        <p className={`${getFontSize(data.fyc)} font-black text-white font-mono leading-tight drop-shadow-md`}>{data.fyc}</p>
                      </div>
                    </div>
                  </div>

                  {/* 頁尾 */}
                  <div className="mt-auto flex flex-col items-center gap-1.5 opacity-95 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black tracking-[0.2em] text-white drop-shadow-sm">B1690</span>
                      <span className="text-white/30">|</span>
                      <span className="text-[10px] font-black tracking-[0.3em] text-white drop-shadow-sm">中恩通訊處</span>
                    </div>
                    <div className="flex items-center gap-2 text-white font-mono text-sm tracking-widest drop-shadow-sm">
                      <Calendar className="w-3.5 h-3.5 opacity-80" />
                      {data.date.replace(/-/g, '.')}
                    </div>
                  </div>
                </div>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-4">預覽畫面僅供參考，下載圖檔為高清原尺寸</p>
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
