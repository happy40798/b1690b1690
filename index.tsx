
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Download, Gem, Calendar, Palette, Upload, Image as ImageIcon, X, Layout, Save, Loader2, RefreshCw, Share2, Check, Mic, MicOff } from 'lucide-react';
import { toPng } from 'html-to-image';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

// --- Constants & Utilities ---
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTU3_CIpMZcKYy8HNwz7roxLlUM4ndzxn8AJvtD38IA-VsNykmY9wzU-fkEotDNyy1F955_toROJAy-/pub?output=csv';
const DEFAULT_BG_URL = 'https://lh3.googleusercontent.com/u/0/d/1AffsJ-awf6jfdme6nlFp4Y991gIA_rRm=w1600';

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- App Component ---
const AwardGenerator = () => {
  const [savedBg, setSavedBg] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [isLiveActive, setIsLiveActive] = useState(false);

  const awardRef = useRef<HTMLDivElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  
  // Live API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const liveSessionRef = useRef<any>(null);

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('複製失敗', err);
    }
  };

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
        console.error("圖片檔案太大，無法快取", e);
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

  const handleAISuggest = async () => {
    setIsAIGenerating(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "請隨機生成一組保險業務的成交數據。格式為 JSON: { \"name\": \"姓名\", \"product\": \"險種名稱\", \"fyp\": \"數字加千分位\", \"fyc\": \"數字加千分位\" }。只要 JSON 字串，不要其他文字。",
      });
      const result = JSON.parse(response.text || '{}');
      if (result.name) {
        setData(prev => ({ ...prev, ...result }));
      }
    } catch (e) {
      console.error("AI 生成失敗", e);
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleStartLive = async () => {
    if (isLiveActive) {
      if (liveSessionRef.current) liveSessionRef.current.close();
      setIsLiveActive(false);
      return;
    }

    setIsLiveActive(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          const source = audioContextRef.current!.createMediaStreamSource(stream);
          const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(audioContextRef.current!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            const ctx = outAudioContextRef.current!;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
          }
        },
        onclose: () => setIsLiveActive(false),
        onerror: (e) => console.error(e)
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "你是一個專業的保險導師，正在與學員對話。請簡短、激勵、專業地回答。"
      }
    });

    liveSessionRef.current = await sessionPromise;
  };

  const syncPhotoFromSheet = async () => {
    if (!data.name || data.name.trim() === '') {
      alert('請先輸入姓名再進行同步');
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
          if (driveUrl.includes('/d/')) {
            fileId = driveUrl.split('/d/')[1].split('/')[0];
          } else if (driveUrl.includes('id=')) {
            fileId = driveUrl.split('id=')[1].split('&')[0];
          }

          if (fileId) {
            const directUrl = `https://lh3.googleusercontent.com/u/0/d/${fileId}=w1000`;
            setData(prev => ({ ...prev, image: directUrl }));
          }
        } else {
          alert(`在雲端試算表中找到了「${data.name}」，但沒看到照片連結。`);
        }
      } else {
        alert(`雲端試算表中找不到姓名為「${data.name}」的資料。`);
      }
    } catch (error) {
      console.error('同步失敗', error);
      alert('從雲端同步失敗，請稍後再試。');
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

  const downloadImage = async () => {
    if (!awardRef.current || isDownloading) return;
    setIsDownloading(true);
    
    try {
      const node = awardRef.current;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3, 
        backgroundColor: '#000',
        width: 480,
        height: 600,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `B1690賀報_${data.name}_${new Date().getMonth()+1}${new Date().getDate()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('下載失敗', err);
      alert("下載失敗，建議直接截圖保存預覽畫面！");
    } finally {
      setIsDownloading(false);
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
        
        {/* 左側：控制面板 */}
        <div className="md:col-span-4 space-y-6 order-2 md:order-1">
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-6">
            <div className="border-b border-slate-700 pb-4 mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Palette className="w-6 h-6 text-red-500" />
                  中恩賀報產生器
                </h1>
                <p className="text-slate-400 text-[10px] mt-1 tracking-widest uppercase">B1690 Premium Edition</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleStartLive}
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 ${isLiveActive ? 'bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                  title="啟動保險導師語音對話"
                >
                  {isLiveActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button 
                  onClick={copyLink}
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 ${copied ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">姓名</label>
                    <button onClick={handleAISuggest} disabled={isAIGenerating} className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1">
                      {isAIGenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />} AI 靈感
                    </button>
                  </div>
                  <input type="text" name="name" value={data.name} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-red-500" />
                </div>
                
                <button 
                    onClick={syncPhotoFromSheet}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 w-full rounded-lg transition-colors border border-slate-500"
                  >
                    {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    從雲端同步人像
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
                <label className="block text-[10px] font-bold uppercase text-slate-300 mb-2 tracking-wider flex items-center gap-2">
                  <Layout className="w-3 h-3" /> 自訂底圖
                </label>
                {!data.bgImage ? (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-500 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700 transition-all group">
                    <p className="text-xs text-slate-300 font-bold">上傳背景</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload} />
                  </label>
                ) : (
                  <div className="relative w-full h-20 rounded-lg overflow-hidden border border-white/30">
                    <img src={data.bgImage} alt="Bg" className="w-full h-full object-cover" />
                    <button onClick={removeBgImage} className="absolute top-1 right-1 bg-red-600 p-1 rounded-full shadow-lg">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-300 mb-2 tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-3 h-3" /> 人像上傳
                </label>
                {!data.image ? (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-700 transition-all">
                    <p className="text-xs text-slate-400">點此上傳</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                ) : (
                  <div className="relative w-full h-24 rounded-lg overflow-hidden border border-white/30 group">
                    <img src={data.image} crossOrigin="anonymous" alt="Avatar" className="w-full h-full object-cover" />
                    <button onClick={removeImage} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-700">
               <button 
                  onClick={downloadImage}
                  disabled={isDownloading}
                  className={`w-full ${isDownloading ? 'bg-slate-600 cursor-not-allowed' : 'bg-white hover:bg-slate-200'} text-slate-900 font-black py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2`}
               >
                 {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                 {isDownloading ? '下載中...' : '下載高清圖片'}
               </button>
            </div>
          </div>
        </div>

        {/* 右側：預覽顯示區 */}
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
            <div ref={awardRef} className="w-full h-full relative">
                <div className="absolute inset-0 z-0">
                  <img src={data.bgImage || DEFAULT_BG_URL} className="w-full h-full object-cover" alt="bg" crossOrigin="anonymous" />
                  <div className="absolute inset-0 bg-black/20"></div>
                </div>

                <div className="absolute inset-4 z-10 pointer-events-none border border-white/20">
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-white/60"></div>
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-white/60"></div>
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-white/60"></div>
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-white/60"></div>
                </div>

                {/* 內容層：pt-20 全體下移 */}
                <div className="absolute inset-0 z-20 flex flex-col items-center pt-20 pb-6 px-6 text-center">
                  
                  {/* 頭像區域 */}
                  <div className="relative w-64 h-64 mb-4 rounded-full shadow-2xl overflow-hidden bg-black/40 backdrop-blur-sm flex items-center justify-center shrink-0">
                    {data.image ? (
                      <img src={data.image} crossOrigin="anonymous" className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      <span className="text-[12rem] font-black font-serif-tc text-white drop-shadow-md">賀</span>
                    )}
                  </div>

                  {/* 姓名 */}
                  <h2 className="text-5xl font-black text-white tracking-widest drop-shadow-xl font-serif-tc mb-5 shrink-0">
                    {data.name}
                  </h2>

                  {/* 數據看板 */}
                  <div className="w-full max-w-[340px] border-2 border-white rounded-2xl overflow-hidden backdrop-blur-md bg-black/20 shadow-2xl shrink-0">
                    <div className="py-2.5 bg-white/10 border-b border-white/20 shrink-0">
                      <p className="text-xl font-bold tracking-widest text-white drop-shadow-md">成交 {data.product}</p>
                    </div>
                    <div className="flex relative shrink-0">
                      <div className="absolute inset-y-3 left-1/2 w-[1px] bg-white/30"></div>
                      <div className="flex-1 py-4 shrink-0">
                        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">FYP</p>
                        <p className={`${getFontSize(data.fyp)} font-black text-white font-mono leading-tight drop-shadow-lg shrink-0`}>{data.fyp}</p>
                      </div>
                      <div className="flex-1 py-4 shrink-0">
                        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                          <Gem className="w-2.5 h-2.5" /> FYC
                        </p>
                        <p className={`${getFontSize(data.fyc)} font-black text-white font-mono leading-tight drop-shadow-lg shrink-0`}>{data.fyc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[5px]"></div>
                  
                  <div className="flex flex-col items-center gap-1 opacity-90 shrink-0">
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
        </div>
      </div>
    </div>
  );
};

// --- Initial Mount ---
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AwardGenerator />
    </React.StrictMode>
  );
}

export default AwardGenerator;
