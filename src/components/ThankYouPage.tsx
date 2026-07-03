import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Check, 
  Video, 
  Calendar, 
  AlertTriangle, 
  Instagram, 
  Smartphone, 
  Clock, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause,
  RotateCcw
} from 'lucide-react';
import { LeadData, BookedMeeting } from '../types';

interface ThankYouPageProps {
  lead: LeadData;
  bookedMeeting: BookedMeeting | null;
  videoUrl?: string;
  presenterName?: string;
  onReset: () => void;
}

export default function ThankYouPage({ 
  lead, 
  bookedMeeting, 
  videoUrl = '', 
  presenterName = 'nosso especialista',
  onReset 
}: ThankYouPageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [localVideoUrl, setLocalVideoUrl] = useState(videoUrl || 'https://vimeo.com/1206543972');
  const [localPresenterName, setLocalPresenterName] = useState(presenterName);

  useEffect(() => {
    const storedConfig = localStorage.getItem('sensesales_integrations_config');
    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        if (config.thankYouVideoUrl) {
          setLocalVideoUrl(config.thankYouVideoUrl);
        } else {
          setLocalVideoUrl('https://vimeo.com/1206543972');
        }
        if (config.presenterName) {
          setLocalPresenterName(config.presenterName);
        }
      } catch (err) {
        console.error('Error reading config for ThankYouPage:', err);
      }
    }
  }, [videoUrl, presenterName]);

  // Helper to detect if a URL is a video embed (YouTube or Vimeo) and force proper query params
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      // YouTube short link
      if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
        return `https://www.youtube.com/embed/${id}?autoplay=1&controls=0&enablejsapi=1&mute=1`;
      }
      // YouTube long link
      if (url.includes('youtube.com/watch')) {
        const urlObj = new URL(url);
        const id = urlObj.searchParams.get('v');
        return `https://www.youtube.com/embed/${id}?autoplay=1&controls=0&enablejsapi=1&mute=1`;
      }
      // YouTube embed link already
      if (url.includes('youtube.com/embed/')) {
        let base = url;
        if (!base.includes('enablejsapi=1')) {
          base = base.includes('?') ? `${base}&enablejsapi=1` : `${base}?enablejsapi=1`;
        }
        if (!base.includes('controls=0')) {
          base = `${base}&controls=0`;
        }
        if (!base.includes('autoplay=1')) {
          base = `${base}&autoplay=1`;
        }
        if (!base.includes('mute=1')) {
          base = `${base}&mute=1`;
        }
        return base;
      }
      // Vimeo player link already
      if (url.includes('player.vimeo.com/video/')) {
        let base = url;
        if (!base.includes('controls=0')) {
          base = base.includes('?') ? `${base}&controls=0` : `${base}?controls=0`;
        }
        if (!base.includes('autoplay=1')) {
          base = `${base}&autoplay=1`;
        }
        if (!base.includes('muted=1')) {
          base = `${base}&muted=1`;
        }
        return base;
      }
      // Vimeo link
      if (url.includes('vimeo.com/')) {
        const parts = url.split('/');
        const id = parts[parts.length - 1]?.split(/[?#]/)[0];
        return `https://player.vimeo.com/video/${id}?autoplay=1&controls=0&muted=1`;
      }
    } catch (e) {
      console.error('Error parsing video URL:', e);
    }
    return ''; // Return empty string if not a YouTube/Vimeo embed
  };

  const embedUrl = getEmbedUrl(localVideoUrl);
  const hasEmbed = !!embedUrl;

  const [videoSrc, setVideoSrc] = useState('/video-obrigado.mp4');

  useEffect(() => {
    const embed = getEmbedUrl(localVideoUrl);
    if (localVideoUrl && !embed) {
      setVideoSrc(localVideoUrl);
    } else {
      setVideoSrc('/video-obrigado.mp4');
    }
  }, [localVideoUrl]);

  // Integrated Player Controls & Stats for seamless Iframe / Native player sync
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setElapsedTime((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const sendPlayerCommand = (command: 'play' | 'pause' | 'mute' | 'unmute' | 'restart') => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    
    const isYouTube = localVideoUrl.includes('youtube.com') || localVideoUrl.includes('youtu.be');
    const isVimeo = localVideoUrl.includes('vimeo.com');

    if (isYouTube) {
      let func = '';
      let args: any[] = [];
      if (command === 'play') {
        func = 'playVideo';
      } else if (command === 'pause') {
        func = 'pauseVideo';
      } else if (command === 'mute') {
        func = 'mute';
      } else if (command === 'unmute') {
        func = 'unMute';
      } else if (command === 'restart') {
        func = 'seekTo';
        args = [0, true];
      }

      if (func) {
        try {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func, args }),
            '*'
          );
          if (command === 'restart') {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
          }
        } catch (err) {
          console.error('Failed to postMessage to YouTube player:', err);
        }
      }
    } else if (isVimeo) {
      let method = '';
      let value: any = null;

      if (command === 'play') {
        method = 'play';
      } else if (command === 'pause') {
        method = 'pause';
      } else if (command === 'mute') {
        method = 'setVolume';
        value = 0;
      } else if (command === 'unmute') {
        method = 'setVolume';
        value = 1;
      } else if (command === 'restart') {
        method = 'setCurrentTime';
        value = 0;
      }

      if (method) {
        try {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify(value !== null ? { method, value } : { method }),
            '*'
          );
          if (command === 'restart') {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ method: 'play' }),
              '*'
            );
          }
        } catch (err) {
          console.error('Failed to postMessage to Vimeo player:', err);
        }
      }
    }
  };

  const handleStartVideo = () => {
    setIsPlaying(true);
    setIsMuted(false);
    setElapsedTime(0);
    
    setTimeout(() => {
      sendPlayerCommand('restart');
      sendPlayerCommand('unmute');
      sendPlayerCommand('play');
    }, 200);
  };

  const handleTogglePlay = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    sendPlayerCommand(nextPlaying ? 'play' : 'pause');
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sendPlayerCommand(nextMuted ? 'mute' : 'unmute');
  };

  const handleRestartVideo = () => {
    setIsPlaying(true);
    setElapsedTime(0);
    sendPlayerCommand('restart');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min((elapsedTime / 90) * 100, 100);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 pb-12" id="thank-you-view">
      
      {/* DOBRA 1 — Confirmação + vídeo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full p-6 sm:p-10 md:p-12 bg-white rounded-3xl border border-gray-200 shadow-xl space-y-8 relative overflow-hidden"
      >
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#008060]/5 rounded-full filter blur-3xl -z-10 pointer-events-none" />

        {/* Selo/tag (topo) */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 bg-[#008060]/10 border border-[#008060]/20 px-3.5 py-1.5 rounded-full text-[10px] sm:text-xs font-mono text-[#008060] uppercase tracking-wider font-bold">
            <Check className="w-3.5 h-3.5 stroke-[3px]" />
            <span>Aplicação recebida</span>
          </div>
        </div>

        {/* Headline & Subheadline */}
        <div className="text-center space-y-4">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900 tracking-tight leading-tight">
            Pronto! Seu horário está reservado.
          </h1>
          <p className="text-sm sm:text-base text-gray-700 max-w-2xl mx-auto leading-relaxed font-normal">
            Assista ao vídeo abaixo — em 90 segundos o{' '}
            <strong className="text-gray-950 font-bold">{localPresenterName}</strong> explica
            exatamente o que acontece a partir de agora.
          </p>
        </div>

        {/* VIDEO COMPONENT */}
        <div className="w-full aspect-video rounded-2xl overflow-hidden border border-gray-200 shadow-2xl relative bg-black group" id="thank-you-video-container">
          
          {/* Main Video Element (Iframe or Native Video) */}
          <div className="absolute inset-0 w-full h-full">
            {hasEmbed ? (
              <iframe
                ref={iframeRef}
                src={embedUrl}
                title="Vídeo de Instruções Será Cacau"
                className="w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video
                className="w-full h-full object-cover opacity-100"
                src={videoSrc}
                loop
                muted={isMuted}
                playsInline
                autoPlay
                onError={() => {
                  if (videoSrc !== 'https://assets.mixkit.co/videos/preview/mixkit-coffee-beans-falling-from-a-sack-42354-large.mp4') {
                    setVideoSrc('https://assets.mixkit.co/videos/preview/mixkit-coffee-beans-falling-from-a-sack-42354-large.mp4');
                  }
                }}
                ref={(el) => {
                  if (el) {
                    if (isPlaying) {
                      el.play().catch(() => {});
                    } else {
                      el.pause();
                    }
                  }
                }}
              />
            )}
          </div>

          {/* Transparent click catcher - catches clicks to pause/play and prevents interaction with the iframe */}
          <div 
            className="absolute inset-0 cursor-pointer z-10"
            onClick={handleTogglePlay}
          />

          {/* Play Overlay Screen */}
          {!isPlaying && (
            <div 
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] transition-all cursor-pointer z-30" 
              onClick={(e) => {
                e.stopPropagation();
                handleStartVideo();
              }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-16 h-16 bg-white hover:bg-[#008060] hover:text-white text-gray-900 rounded-full flex items-center justify-center shadow-2xl transition-colors duration-300 group-hover:scale-105"
              >
                <Play className="w-6 h-6 fill-current translate-x-0.5" />
              </motion.button>
              <span className="text-white text-xs font-semibold tracking-wide mt-3 uppercase drop-shadow-md">
                Clique para Iniciar o Vídeo com Som (90s)
              </span>
            </div>
          )}

          {/* Controls bar at bottom - only visible on hover to keep the video fully clean */}
          <div 
            className="absolute bottom-0 inset-x-0 p-4 flex items-center justify-between bg-black/60 backdrop-blur-md text-white/90 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            onClick={(e) => {
              // Prevent clicking the controls bar from toggling play/pause
              e.stopPropagation();
            }}
          >
            <div className="flex items-center gap-3">
              <button 
                onClick={handleTogglePlay}
                className="hover:text-white p-1 rounded transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button 
                onClick={handleRestartVideo}
                className="hover:text-white p-1 rounded transition-colors"
                title="Reiniciar"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              
              {/* Custom timeline - styled beautifully but NOT seekable */}
              <div className="h-1 w-24 sm:w-48 bg-white/20 rounded-full overflow-hidden relative">
                <div 
                  className="h-full bg-[#008060] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleToggleMute}
                className="hover:text-white p-1 rounded transition-colors flex items-center gap-1.5"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-rose-500" />
                    <span className="text-[10px] text-gray-300 hidden sm:inline">Mutado</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] text-gray-300 hidden sm:inline">Com som</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Microcopy abaixo do vídeo (1 linha) */}
        <p className="text-center text-xs sm:text-sm text-gray-850 font-bold tracking-wide animate-pulse">
          Atenção aos próximos passos logo abaixo 👇 são rápidos e importantes.
        </p>

      </motion.div>

      {/* DOBRA 2 — Próximos passos + aviso */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full p-6 sm:p-10 md:p-12 bg-white rounded-3xl border border-gray-200 shadow-xl space-y-8 text-left"
      >
        {/* Headline da seção */}
        <div className="border-b border-gray-100 pb-4">
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-gray-900 tracking-tight">
            O que acontece agora
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Passo 1 */}
          <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-200/80 space-y-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#008060]" />
            <div className="inline-block bg-[#008060]/10 text-[#008060] text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded">
              Passo 01
            </div>
            <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
              <span>📲</span> Nosso time vai te chamar
            </h3>
            <p className="text-xs sm:text-sm text-gray-850 leading-relaxed font-normal">
              Uma pessoa da equipe <strong className="text-gray-950 font-semibold">Será Cacau</strong> vai entrar em contato pelo WhatsApp e por ligação para confirmar, junto com você, o melhor horário da reunião. Esse mesmo contato fica à disposição para qualquer dúvida até lá.
            </p>
          </div>

          {/* Passo 2 */}
          <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-200/80 space-y-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#008060]" />
            <div className="inline-block bg-[#008060]/10 text-[#008060] text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded">
              Passo 02
            </div>
            <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
              <span>💾</span> Salve o nosso número
            </h3>
            <p className="text-xs sm:text-sm text-gray-850 leading-relaxed font-normal">
              Assim que a mensagem chegar, salve o contato e fique de olho no celular nas próximas horas — é só para a gente não se desencontrar.
            </p>
          </div>

        </div>

        {/* Bloco de destaque (aviso, em caixa/borda) */}
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-amber-500/30 bg-amber-50/50 text-amber-950 space-y-2.5 shadow-sm">
          <h4 className="font-display font-bold text-sm sm:text-base text-amber-900 flex items-center gap-2">
            ⚠️ A reunião é única e não reagendável.
          </h4>
          <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-normal">
            Abrimos poucos horários e reservamos esse tempo de verdade para empresas que realmente buscam essa solução. Por isso, escolha um momento em que consiga estar tranquilo(a) e presente. É o nosso jeito de respeitar o seu tempo — e o nosso.
          </p>
        </div>

      </motion.div>

      {/* DOBRA 3 — Seção do Instagram em destaque */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full p-8 sm:p-10 bg-gradient-to-br from-[#008060]/5 to-emerald-50 border border-emerald-100 rounded-3xl shadow-lg text-center flex flex-col items-center justify-center space-y-5"
        id="instagram-promo-section"
      >
        <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-md">
          <Instagram className="w-6 h-6 stroke-[2.2px]" />
        </div>

        <div className="space-y-2">
          <p className="text-base sm:text-lg text-gray-800 font-bold max-w-xl mx-auto leading-snug">
            Foi um prazer ter você aqui. Enquanto a gente não se fala, conheça a nossa história:
          </p>
          <p className="text-xs sm:text-sm text-gray-600 font-normal">
            Acompanhe nossos bastidores, novidades e como ajudamos marcas a escalarem com cacau de origem.
          </p>
        </div>

        <a
          href="https://www.instagram.com/sera.cacau.brasil"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#008060] hover:bg-[#00664d] text-white font-sans font-bold text-xs tracking-wider rounded-xl transition-all shadow-md hover:scale-[1.03] active:scale-[0.98] cursor-pointer group"
        >
          <span>SEGUIR @SERA.CACAU.BRASIL NO INSTAGRAM</span>
          <Instagram className="w-4.5 h-4.5 text-white group-hover:scale-110 transition-transform" />
        </a>
      </motion.div>

    </div>
  );
}
