import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar as CalendarIcon, Loader2, AlertCircle, PhoneCall, ArrowRight, Check
} from 'lucide-react';
import { LeadData, IntegrationConfig } from '../types';

interface BookingCalendarProps {
  lead: LeadData;
  onBookingComplete: (date: string, hour: string, meetLink: string) => void;
  onBackToSummary: () => void;
}

export default function BookingCalendar({ lead, onBookingComplete, onBackToSummary }: BookingCalendarProps) {
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);
  const [calendlyUrl, setCalendlyUrl] = useState('https://calendly.com/comercial-seracacau/30min');
  const [hasError, setHasError] = useState(false);
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false);
  const [hasInteractedWithCalendly, setHasInteractedWithCalendly] = useState(false);
  const [countdown, setCountdown] = useState(1);
  const [showWarning, setShowWarning] = useState(false);

  // Load custom configured Calendly link if set in configurations
  useEffect(() => {
    const storedConfig = localStorage.getItem('sensesales_integrations_config');
    if (storedConfig) {
      try {
        const config: IntegrationConfig = JSON.parse(storedConfig);
        if (config.calendlyUrl) {
          setCalendlyUrl(config.calendlyUrl);
        }
      } catch (err) {
        console.error('Error reading integrations config for Calendly:', err);
      }
    }
  }, []);

  // Listen for Calendly postMessage events with robust parsing
  useEffect(() => {
    function handleCalendlyMessage(e: MessageEvent) {
      // Log received message for diagnostic purposes
      console.log("Mensagem recebida da janela:", e.data);

      let data = e.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (err) {
          // Ignore non-JSON strings
        }
      }

      if (data && typeof data === 'object') {
        // Calendly puts the event name in "event" property. Also support "action" or "type" as fallback.
        const eventName = data.event || data.action || data.type;
        
        if (eventName && typeof eventName === 'string') {
          console.log(`[Calendly Event] ${eventName}`);
          
          // User fully finished scheduling the event - trigger the completion button and redirect instantly
          const isScheduled = 
            eventName === 'calendly.event_scheduled' || 
            eventName.toLowerCase().includes('scheduled') || 
            eventName.toLowerCase().includes('schedule');

          if (isScheduled) {
            setHasInteractedWithCalendly(true);
            setShowWarning(false);
            setIsAutoRedirecting(true);
            triggerCompletion();
          }
        }
      }
    }

    window.addEventListener('message', handleCalendlyMessage);
    return () => {
      window.removeEventListener('message', handleCalendlyMessage);
    };
  }, []);

  // Bulletproof fallback: reveal the conclusion button after 20 seconds of being on this page
  // in case postMessages are entirely blocked by nested frames, redirect configuration, or browser security.
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setHasInteractedWithCalendly(true);
      console.log("Fallback timer triggered: liberando botão de conclusão como segurança.");
    }, 20000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  // Handle countdown and auto-completion when event is scheduled
  useEffect(() => {
    if (!isAutoRedirecting) return;

    triggerCompletion();
  }, [isAutoRedirecting]);

  const triggerCompletion = () => {
    const todayStr = new Date().toLocaleDateString('pt-BR');
    onBookingComplete(
      todayStr,
      'Agendado no Calendly',
      'Link enviado pelo Calendly (E-mail/WhatsApp)'
    );
  };

  // Construct optimized prefilled embedding URL for Calendly
  const getPrefilledUrl = () => {
    try {
      const urlObj = new URL(calendlyUrl);
      
      if (lead.nome) {
        urlObj.searchParams.append('name', lead.nome);
      }
      if (lead.email) {
        urlObj.searchParams.append('email', lead.email);
      }
      
      const phoneVal = lead.whatsapp || lead.telefone || '';
      if (phoneVal) {
        urlObj.searchParams.append('phone', phoneVal);
        urlObj.searchParams.append('a1', phoneVal);
      }

      urlObj.searchParams.append('hide_event_type_details', '1');
      urlObj.searchParams.append('hide_gdpr_banner', '1');

      return urlObj.toString();
    } catch (e) {
      return `${calendlyUrl}?name=${encodeURIComponent(lead.nome || '')}&email=${encodeURIComponent(lead.email || '')}`;
    }
  };

  const iframeSrc = getPrefilledUrl();

  // If the booking is successfully finished, show a full-card beautiful success/redirect view
  if (isAutoRedirecting) {
    return (
      <div 
        className="w-full max-w-3xl mx-auto p-10 sm:p-16 md:p-20 glass-panel rounded-[32px] shadow-sm text-center flex flex-col items-center justify-center min-h-[550px]" 
        id="booking-success-card"
      >
        <div className="flex flex-col items-center justify-center max-w-lg mx-auto space-y-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-sm"
          >
            <Check className="w-10 h-10" />
          </motion.div>
          
          <motion.h3
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="font-display font-semibold text-2xl sm:text-3xl text-gray-900 tracking-tight"
          >
            Agendamento Confirmado!
          </motion.h3>
          
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-sm sm:text-base text-gray-650 leading-relaxed text-center animate-pulse"
          >
            Sua sessão de diagnóstico foi reservada com sucesso. Redirecionando...
          </motion.p>
          
          <motion.button
            initial={{ y: 15, opacity: 0 }}
            animate={{ 
              y: 0, 
              opacity: 1,
              scale: [1, 1.04, 1],
              boxShadow: [
                "0 4px 6px -1px rgba(0, 128, 96, 0.2), 0 2px 4px -2px rgba(0, 128, 96, 0.2)",
                "0 10px 15px -3px rgba(0, 128, 96, 0.4), 0 4px 6px -4px rgba(0, 128, 96, 0.4)",
                "0 4px 6px -1px rgba(0, 128, 96, 0.2), 0 2px 4px -2px rgba(0, 128, 96, 0.2)"
              ]
            }}
            transition={{ 
              y: { delay: 0.4, duration: 0.3 },
              opacity: { delay: 0.4, duration: 0.3 },
              scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.7 },
              boxShadow: { repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.7 }
            }}
            onClick={triggerCompletion}
            className="px-8 py-4 bg-[#008060] hover:bg-[#00664d] text-white font-sans font-bold text-sm tracking-wider rounded-xl transition-all flex items-center gap-2.5 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Ir para a Página de Obrigado</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </motion.button>
        </div>
      </div>
    );
  }

  const handleCompleteClick = () => {
    if (!hasInteractedWithCalendly) {
      setShowWarning(true);
    } else {
      triggerCompletion();
    }
  };

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 md:p-8 glass-panel rounded-2xl sm:rounded-[32px] shadow-sm relative overflow-hidden text-left" id="calendar-booking-card">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="font-display font-semibold text-xl sm:text-2xl text-gray-900 tracking-tight">
            Reserve o Horário do seu Diagnóstico
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Escolha uma data e horário em nossa agenda e confirme em poucos segundos.
          </p>
        </div>

        {/* Dynamic Indicator */}
        <div className="shrink-0 flex items-center gap-2 bg-[#FAFAF8] border border-gray-200 px-3 py-2 rounded-xl text-xs">
          <div className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
          <span className="text-gray-900 font-medium text-[11px] font-sans">Agendamento Exclusivo e Rápido</span>
        </div>
      </div>

      {/* Embedded Iframe Container */}
      <div className="relative w-full h-[500px] xs:h-[560px] sm:h-[620px] bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">
        
        {isLoadingIframe && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white space-y-4 z-10">
            <Loader2 className="w-8 h-8 text-[#008060] animate-spin" />
            <div className="text-center space-y-1">
              <p className="text-xs font-mono text-gray-900 font-semibold tracking-wider">ESTRUTURANDO DIAGNÓSTICO...</p>
              <p className="text-[10px] text-gray-400">Sincronizando agenda do Calendly em tempo real.</p>
            </div>
          </div>
        )}

        {!hasError ? (
          <iframe 
            src={iframeSrc}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Calendly Scheduling"
            onLoad={() => setIsLoadingIframe(false)}
            onError={() => {
              setHasError(true);
              setIsLoadingIframe(false);
            }}
            className="w-full h-full rounded-2xl"
            id="calendly-frame"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 bg-white">
            <AlertCircle className="w-12 h-12 text-rose-500" />
            <p className="text-sm font-sans font-medium text-gray-900">Não foi possível exibir a agenda do Calendly.</p>
            <p className="text-xs text-gray-500 max-w-md leading-relaxed">
              Verifique se sua conexão de rede está ativa ou tente abrir o link do agendamento diretamente no seu navegador.
            </p>
            <a 
              href={calendlyUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="px-6 py-3 bg-[#008060] text-white hover:bg-[#00664d] font-semibold text-xs rounded-xl shadow-sm"
            >
              Abrir Agenda Externa
            </a>
          </div>
        )}
      </div>

      {/* Bottom control bar for backing out of Scheduling */}
      <div className="pt-6 border-t border-gray-200 flex flex-col items-center justify-center text-center gap-4" id="calendar-bottom-controls">
        <div className="flex flex-col items-center justify-center gap-4 w-full">
          {/* Status Message */}
          {hasInteractedWithCalendly ? (
            <p className="text-[13px] text-emerald-600 font-sans font-bold text-center leading-normal animate-pulse flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              ✓ Horário selecionado ou agendado! Clique abaixo para concluir.
            </p>
          ) : showWarning ? (
            <motion.p 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[13px] text-rose-600 font-sans font-bold text-center leading-normal bg-rose-50 px-5 py-2.5 rounded-xl border border-rose-150 flex items-center gap-2 shadow-sm"
            >
              <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
              Por favor, selecione o dia e horário de sua preferência no calendário acima antes de concluir.
            </motion.p>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-xs text-gray-500 font-medium text-center">
                Aguardando seleção de horário no calendário acima...
              </p>
            </div>
          )}

          {/* Always Visible Concluir Agendamento Button */}
          <motion.button
            animate={hasInteractedWithCalendly ? { 
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 4px 6px -1px rgba(0, 128, 96, 0.2), 0 2px 4px -2px rgba(0, 128, 96, 0.2)",
                "0 10px 20px -3px rgba(0, 128, 96, 0.4), 0 6px 8px -4px rgba(0, 128, 96, 0.4)",
                "0 4px 6px -1px rgba(0, 128, 96, 0.2), 0 2px 4px -2px rgba(0, 128, 96, 0.2)"
              ]
            } : {}}
            transition={{ 
              scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
              boxShadow: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
            }}
            onClick={handleCompleteClick}
            className="w-full sm:w-auto px-8 py-4 bg-[#008060] hover:bg-[#00664d] active:scale-[0.98] text-white font-sans font-bold text-sm tracking-widest rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg"
            id="btn-confirm-calendly-booking"
          >
            <span>CONCLUIR AGENDAMENTO</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </motion.button>
        </div>
      </div>

    </div>
  );
}
