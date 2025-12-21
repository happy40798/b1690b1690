
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Download, Gem, Calendar, Palette, Upload, Image as ImageIcon, X, Layout, Loader2, RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';

// --- Constants & Utilities ---
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTU3_CIpMZcKYy8HNwz7roxLlUM4ndzxn8AJvtD38IA-VsNykmY9wzU-fkEotDNyy1F955_toROJAy-/pub?output=csv';
const DEFAULT_BG_URL = 'https://lh3.googleusercontent.com/u/0/d/1AffsJ-awf6jfdme6nlFp4Y991gIA_rRm=w1600';

const AwardGenerator = () => {
  const [savedBg, setSavedBg] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [longPressImage, setLongPressImage] = useState<string | null>(null);

  const awardRef = useRef<HTMLDivElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  
  // 響應式預覽縮放
  useEffect(() => {
    const handleResize = () => {
      if (previewWrapperRef.current) {
        const containerWidth = previewWrapperRef.current.offsetWidth;
        const targetWidth = 480; 
        if (containerWidth < targetWidth + 40) {
          const scale = (containerWidth - 40) / targetWidth;
          setPreviewScale(scale);
        } else {
          setPreviewScale(1);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 讀取本地底圖
  useEffect(() => {
    try {
      const bg = localStorage.getItem('b1690_custom_bg');
      if (bg) setSavedBg(bg);
    } catch (e) {
      console.error("讀取底圖失敗", e);
    }
  }, []);

  const [data, setData] = useState({
    name: '黃啟倫',
    product: 'PFK', 
    fyp: '100,000',
    fyc: '35,000',
    date: new Date().toISOString().split('T')[0],
    image: null as string | null, 
    bgImage: null as string | null, 
  });

  useEffect(() => {
    if (savedBg) {
      setData(prev => ({ ...prev, bgImage: savedBg }));
    }
  }, [savedBg]);

  // 當資料變動時，清除長按圖，強迫重新產生
  useEffect(() => {
    setLongPressImage(null);
  }, [data]);

  const compressImage = (file: File, callback: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000; 
        const scaleSize = MAX_WIDTH / img.width;
        if (scaleSize >= 1) {
            callback(event.target?.result as string);
            return;
        }
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        callback(dataUrl);
      };
    };
  };

  useEffect(() => {
    if (data.bgImage) {
      try {
        localStorage.setItem('b1690_custom_bg', data.bgImage);
      } catch (e) {
        console.error("底圖太大無法記憶", e);
      }
    }
  }, [data.bgImage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressImage(file, (compressedResult) => {
          setData(prev => ({ ...prev, bgImage: compressedResult }));
      });
    }
  };

  const syncPhotoFromSheet = async () => {
    if (!data.name || data.name.trim() === '') {
      alert('請先輸入姓名');
      return;
    }
    setIsSyncing(true);
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/"/g, '')));
      const targetRow = rows.find(row => row.some(cell => cell === data.name));
      if (targetRow) {
        const driveUrl = targetRow.find(cell => cell.includes('drive.google.com'));
        if (driveUrl) {
          let fileId = '';
          if (driveUrl.includes('/d/')) fileId = driveUrl.split('/d/')[1].split('/')[0];
          else if (driveUrl.includes('id=')) fileId = driveUrl.split('id=')[1].split('&')[0];
          if (fileId) {
            const directUrl = `https://lh3.googleusercontent.com/u/0/d/${fileId}=w1000`;
            setData(prev => ({ ...prev, image: directUrl }));
          }
        }
      }
    } catch (error) {
      console.error('同步失敗', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const removeImage = () => setData(prev => ({ ...prev, image: null }));
  const removeBgImage = () => {
    setData(prev => ({ ...prev, bgImage: null }));
    localStorage.removeItem('b1690_custom_bg');
    setSavedBg(null);
  };

  // 輔助：網路 URL 轉 Base64 避免畫布汙染
  const getBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return url;
    }
  };

  // 產生下載/儲存用的圖片
  const generateFinalImage = async () => {
    if (!awardRef.current || isDownloading) return null;
    setIsDownloading(true);
    try {
      // 預處理所有 <img> 為 Base64
      const imgElements = awardRef.current.querySelectorAll('img');
      for (const img of Array.from(imgElements)) {
        if (img.src.startsWith('http')) {
          const b64 = await getBase64(img.src);
          img.src = b64;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const dataUrl = await toPng(awardRef.current, {
        cacheBust: true,
        pixelRatio: 2, 
        backgroundColor: '#000000',
        width: 480,
        height: 600,
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      });
      setLongPressImage(dataUrl);
      return dataUrl;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadImage = async () => {
    const dataUrl = await generateFinalImage();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `B1690賀報_${data.name}.png`;
      link.href = dataUrl;
      link.click();
    } else {
      alert("生成失敗，建議直接截圖！");
    }
  };

  const getFontSize = (str: string) => {
    if (!str) return 'text-4xl';
    const len = str.toString().length;
    if (len > 10) return 'text-2xl';
    if (len > 7) return 'text-3xl';
    return 'text-4xl';
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans text-slate-200 bg-slate-900">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* 左側面板 */}
        <div className="md:col-span-4 space-y-6 order-2 md:order-1">
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-6">
            <div className="border-b border-slate-700 pb-4 mb-6">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Palette className="w-6 h-6 text-red-500" />
                中恩賀報產生器
              </h1>
              <p className="text-slate-400 text-[10px] mt-1 tracking-widest uppercase">B1690 Premium Edition</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">姓名</label>
                  <input type="text" name="name" value={data.name} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-red-500" />
                </div>
                
                <button onClick={syncPhotoFromSheet} disabled={isSyncing} className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 w-full rounded-lg transition-colors border border-slate-500">
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  從雲端同步人像資料
                </button>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">成交商品</label>
                  <input type="text" name="product" value={data.product} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-red-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">FYP</label>
                    <input type="text" name="fyp" value={data.fyp} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">FYC</label>
                    <input type="text" name="fyc" value={data.fyc} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">報件日期</label>
                  <input type="date" name="date" value={data.date} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" />
                </div>
              </div>

              <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600">
                <label className="block text-[10px] font-bold uppercase text-slate-300 mb-2 tracking-wider flex items-center gap-2"><Layout className="w-3 h-3" /> 底圖設定</label>
                {!data.bgImage ? (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-500 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700 transition-all">
                    <p className="text-xs text-slate-300 font-bold">上傳背景圖檔</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload} />
                  </label>
                ) : (
                  <div className="relative w-full h-20 rounded-lg overflow-hidden border border-white/30">
                    <img src={data.bgImage} alt="Bg" className="w-full h-full object-cover" />
                    <button onClick={removeBgImage} className="absolute top-1 right-1 bg-red-600 p-1 rounded-full shadow-lg"><X className="w-3 h-3 text-white" /></button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-300 mb-2 tracking-wider flex items-center gap-2"><ImageIcon className="w-3 h-3" /> 人像上傳</label>
                {!data.image ? (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-700 transition-all">
                    <p className="text-xs text-slate-400">點此上傳照片</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                ) : (
                  <div className="relative w-full h-24 rounded-lg overflow-hidden border border-white/30 group">
                    <img src={data.image} crossOrigin="anonymous" alt="Avatar" className="w-full h-full object-cover" />
                    <button onClick={removeImage} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><X className="w-5 h-5 text-white" /></button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-700 space-y-3">
               <button onClick={downloadImage} disabled={isDownloading} className={`w-full ${isDownloading ? 'bg-slate-600 cursor-not-allowed' : 'bg-white hover:bg-slate-200'} text-slate-900 font-black py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2`}>
                 {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                 {isDownloading ? '生成圖片中...' : '下載高清賀報'}
               </button>
               {!longPressImage && !isDownloading && (
                 <button onClick={generateFinalImage} className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 rounded-lg border border-slate-500">
                   iPhone 點此產生長按儲存圖
                 </button>
               )}
            </div>
          </div>
        </div>

        {/* 右側：預覽區 */}
        <div ref={previewWrapperRef} className="md:col-span-8 flex flex-col items-center justify-start min-h-[650px] order-1 md:order-2">
          <div 
            style={{ 
              transform: `scale(${previewScale})`,
              transformOrigin: 'top center',
              width: '480px',
              height: '600px',
              marginBottom: `${(600 * previewScale) - 600}px` 
            }}
            className="relative overflow-hidden shadow-2xl rounded-sm bg-black text-white shrink-0"
          >
            {/* 用於 iPhone 長按儲存的真實圖片層 */}
            {longPressImage && (
              <img src={longPressImage} className="absolute inset-0 z-[100] w-full h-full object-contain pointer-events-auto" alt="final" />
            )}

            <div ref={awardRef} className="w-full h-full relative bg-black">
                {/* 背景 */}
                <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1a1a1a] to-black">
                  <img src={data.bgImage || DEFAULT_BG_URL} crossOrigin="anonymous" className="w-full h-full object-cover" alt="bg" />
                  <div className="absolute inset-0 bg-black/20"></div>
                </div>

                {/* 裝飾邊框 */}
                <div className="absolute inset-4 z-10 pointer-events-none border border-white/20">
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-white/60"></div>
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-white/60"></div>
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-white/60"></div>
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-white/60"></div>
                </div>

                {/* 內容區 - 整體向上移並優化間距 */}
                <div className="absolute inset-0 z-20 flex flex-col items-center pt-8 pb-10 px-6 text-center">
                  
                  {/* 頭像 - 縮小一點確保不擁擠 */}
                  <div className="relative w-56 h-56 mb-5 rounded-full shadow-[0_15px_35px_rgba(0,0,0,0.6)] overflow-hidden bg-black/40 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/10">
                    {data.image ? (
                      <img src={data.image} crossOrigin="anonymous" className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      <span className="text-[10rem] font-black font-serif-tc text-white drop-shadow-md">賀</span>
                    )}
                  </div>

                  {/* 姓名 */}
                  <h2 className="text-5xl font-black text-white tracking-widest drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] font-serif-tc mb-5 shrink-0 leading-tight">
                    {data.name}
                  </h2>

                  {/* 數據看板 */}
                  <div className="w-full max-w-[320px] border-2 border-white rounded-2xl overflow-hidden backdrop-blur-md bg-black/30 shadow-2xl shrink-0">
                    <div className="py-2.5 bg-white/10 border-b border-white/20">
                      <p className="text-xl font-bold tracking-widest text-white drop-shadow-md">成交 {data.product}</p>
                    </div>
                    <div className="flex relative">
                      <div className="absolute inset-y-3 left-1/2 w-[1px] bg-white/30"></div>
                      <div className="flex-1 py-4">
                        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">FYP</p>
                        <p className={`${getFontSize(data.fyp)} font-black text-white font-mono leading-tight drop-shadow-lg`}>{data.fyp}</p>
                      </div>
                      <div className="flex-1 py-4">
                        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                          <Gem className="w-2.5 h-2.5" /> FYC
                        </p>
                        <p className={`${getFontSize(data.fyc)} font-black text-white font-mono leading-tight drop-shadow-lg`}>{data.fyc}</p>
                      </div>
                    </div>
                  </div>

                  {/* 頁尾 - 使用 mt-auto 並增加 padding 確保不被裁切 */}
                  <div className="mt-auto flex flex-col items-center gap-1.5 opacity-90 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-black tracking-[0.2em] text-white">B1690</span>
                      <span className="text-white/40">|</span>
                      <span className="text-[11px] font-black tracking-[0.3em] text-white">中恩通訊處</span>
                    </div>
                    <div className="flex items-center gap-2 text-white font-mono text-sm tracking-widest">
                      <Calendar className="w-3.5 h-3.5 opacity-70" />
                      {data.date.replace(/-/g, '.')}
                    </div>
                  </div>
                </div>
            </div>
          </div>
          {longPressImage && (
            <p className="mt-4 text-red-400 text-xs font-bold animate-pulse">長按預覽圖即可儲存圖片</p>
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
