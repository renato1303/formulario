import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, ArrowLeft, Send, Sparkles, Check, ChevronRight, 
  HelpCircle, Eye, ShieldCheck, Settings, Globe, PhoneCall, AlertTriangle, Play,
  Calendar, Video, Lock
} from 'lucide-react';
import { 
  QUESTIONS_LIST, INITIAL_LEAD_DATA, maskPhone, validateEmail, 
  validatePhone, buildWhatsAppMessage, DEFAULT_INTEGRATIONS_CONFIG, calculateLeadScore 
} from './data';
import { LeadData, Question, IntegrationConfig, BookedMeeting } from './types';
import { createClient } from '@supabase/supabase-js';
import LoaderStep from './components/LoaderStep';
import LeadSummary from './components/LeadSummary';
import AdminPanel from './components/AdminPanel';
import BookingCalendar from './components/BookingCalendar';
import ThankYouPage from './components/ThankYouPage';

export default function App() {
  const [lead, setLead] = useState<LeadData>(INITIAL_LEAD_DATA);
  const [currentStep, setCurrentStep] = useState<number>(1); // 1+ = Questions (started directly as requested)
  const [inputValue, setInputValue] = useState<string>('');
  const [checkboxValue, setCheckboxValue] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  
  // Booking/Scheduling States
  const [bookedMeeting, setBookedMeeting] = useState<BookedMeeting | null>(null);
  const [showBookingStep, setShowBookingStep] = useState<boolean>(true);

  // Admin and Password-protection State fields
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('sensesales_admin_logged_in') === 'true';
  });
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  const [deviceInfo, setDeviceInfo] = useState({ os: 'Unknown', browser: 'Unknown' });

  // Input ref to auto focus
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse UTM params and device info on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm_source = params.get('utm_source') || params.get('src') || '';
    const utm_medium = params.get('utm_medium') || '';
    const utm_campaign = params.get('utm_campaign') || '';

    // Simple UserAgent detection for tracking
    const ua = navigator.userAgent;
    let browser = 'Other';
    let os = 'Other';
    if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';

    if (ua.indexOf('Windows') > -1) os = 'Windows';
    else if (ua.indexOf('Mac') > -1) os = 'macOS';
    else if (ua.indexOf('Android') > -1) os = 'Android';
    else if (ua.indexOf('iPhone') > -1) os = 'iOS';

    setDeviceInfo({ os, browser });

    setLead(prev => ({
      ...prev,
      utmSource: utm_source || undefined,
      utmMedium: utm_medium || undefined,
      utmCampaign: utm_campaign || undefined,
      device: os,
      browser: browser
    }));
  }, []);

  // Listen to path changes and hashes to support /admin and #admin routing cleanly
  useEffect(() => {
    const handleLocationRouting = () => {
      const pathSuffix = window.location.pathname;
      const hashVal = window.location.hash;
      if (pathSuffix.endsWith('/admin') || hashVal === '#admin') {
        setIsAdminRoute(true);
      } else {
        setIsAdminRoute(false);
      }
    };

    handleLocationRouting();
    window.addEventListener('hashchange', handleLocationRouting);
    
    // Periodically inspect pathname in case dynamic navigation occurs
    const interval = setInterval(handleLocationRouting, 1000);

    return () => {
      window.removeEventListener('hashchange', handleLocationRouting);
      clearInterval(interval);
    };
  }, []);

  // Filter visible questions dynamically based on dependencies
  const visibleQuestions: Question[] = QUESTIONS_LIST.filter(q => {
    if (!q.dependsOn) return true;
    const parentVal = lead[q.dependsOn.variable];
    return parentVal === q.dependsOn.value;
  });

  const totalQuestionsCount = visibleQuestions.length;
  const currentQuestion: Question | undefined = currentStep > 0 ? visibleQuestions[currentStep - 1] : undefined;

  // Sync draft inputs when question changes
  useEffect(() => {
    if (currentQuestion) {
      const activeVariable = currentQuestion.variable;
      if (currentQuestion.type === 'checkbox') {
        setCheckboxValue(lead[activeVariable] as boolean || false);
      } else if (currentQuestion.type === 'multiselect') {
        if (!Array.isArray(lead[activeVariable])) {
          setLead(prev => ({
            ...prev,
            [activeVariable]: []
          }));
        }
        setInputValue('');
      } else {
        setInputValue((lead[activeVariable] as string) || '');
      }
      setValidationError(null);

      // Auto-focus input for smoother UX
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [currentStep, currentQuestion]);

  // Handle WhatsApp Brazilian Formatter
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (currentQuestion?.type === 'tel') {
      value = maskPhone(value);
    }
    setInputValue(value);
    if (validationError) setValidationError(null);
  };

  // Validate current answer
  const validateCurrentAnswer = (): boolean => {
    if (!currentQuestion) return true;

    if (currentQuestion.type === 'checkbox') {
      if (!checkboxValue && currentQuestion.required) {
        setValidationError('Você precisa aceitar os termos de consentimento para continuar.');
        return false;
      }
      return true;
    }

    if (currentQuestion.type === 'multiselect') {
      const selectedArr = lead[currentQuestion.variable];
      if (currentQuestion.required && (!Array.isArray(selectedArr) || selectedArr.length === 0)) {
        setValidationError('Por favor, selecione pelo menos uma opção para darmos prosseguimento.');
        return false;
      }
      return true;
    }

    const trimmedValue = inputValue.trim();

    if (currentQuestion.required && !trimmedValue) {
      setValidationError('Este campo é obrigatório para darmos prosseguimento.');
      return false;
    }

    if (trimmedValue && currentQuestion.type === 'email') {
      if (!validateEmail(trimmedValue)) {
        setValidationError('Por favor, insira um endereço de e-mail válido.');
        return false;
      }
    }

    if (trimmedValue && currentQuestion.type === 'tel') {
      if (!validatePhone(trimmedValue)) {
        setValidationError('Insira um número de WhatsApp com DDD válido. Ex: (11) 99999-9999.');
        return false;
      }
    }

    return true;
  };

  // Move forward
  const handleNext = () => {
    if (!validateCurrentAnswer()) return;

    // Save answer to state
    if (currentQuestion) {
      const activeVariable = currentQuestion.variable;
      if (currentQuestion.type === 'checkbox') {
        setLead(prev => ({
          ...prev,
          [activeVariable]: checkboxValue
        }));
      } else if (currentQuestion.type === 'multiselect') {
        // MULTISELECT fields are updated incrementally via handleMultiSelectToggle!
      } else {
        const finalValue = inputValue.trim();
        setLead(prev => ({
          ...prev,
          [activeVariable]: finalValue
        }));
      }
    }

    // Determine path forward
    if (currentStep < totalQuestionsCount) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Conclude form - switch to loader
      setIsProcessing(true);
    }
  };

  // Triggered when loader finishes (2 seconds)
  const handleLoaderComplete = () => {
    setIsProcessing(false);
    setIsCompleted(true);
    saveLeadToDatabase();
  };

  // Save lead details and trigger webhooks
  const saveLeadToDatabase = async () => {
    const now = new Date();
    const dataCadastro = now.toLocaleDateString('pt-BR');
    const horaCadastro = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const score = calculateLeadScore(lead);

    const finalLead: LeadData = {
      ...lead,
      id: 'L-' + Math.floor(100000 + Math.random() * 900000),
      createdAt: now.toISOString(),
      status: 'Novo',
      leadScore: score,
      dataCadastro,
      horaCadastro,
    };

    setLead(finalLead);

    // Save locally
    const existingLeadsRaw = localStorage.getItem('sensesales_leads');
    const existingLeads: LeadData[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];
    localStorage.setItem('sensesales_leads', JSON.stringify([finalLead, ...existingLeads]));

    // Log tracking
    const existingLogsRaw = localStorage.getItem('sensesales_integration_logs');
    const existingLogs = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
    
    const timestamp = now.toLocaleTimeString();
    
    let config: IntegrationConfig = DEFAULT_INTEGRATIONS_CONFIG;
    const storedConfig = localStorage.getItem('sensesales_integrations_config');
    if (storedConfig) {
      try {
        config = JSON.parse(storedConfig);
      } catch (err) {}
    }

    const hasSheets = config.googleSheetsUrl && config.googleSheetsUrl.startsWith('http');

    const newLogs: { id: string; time: string; action: string; status: 'success' | 'warn' | 'error'; message: string }[] = [
      { id: Math.random().toString(), time: timestamp, action: 'Lead Local', status: 'success' as const, message: `Lead de ${finalLead.nome} (${finalLead.empresa}) registrado com sucesso.` },
      { id: Math.random().toString(), time: timestamp, action: 'Meta Pixel', status: 'success' as const, message: `Evento "Lead" enviado com ID: ${finalLead.id}.` },
      { 
        id: Math.random().toString(), 
        time: timestamp, 
        action: 'Google Sheets', 
        status: hasSheets ? ('success' as const) : ('warn' as const), 
        message: hasSheets 
          ? `Disparo efetuado para o Google Sheets App Script.` 
          : `Não enviado: Google Sheets App Script URL não configurado em /admin.` 
      },
      { id: Math.random().toString(), time: timestamp, action: 'Webhooks', status: 'warn' as const, message: `Iniciando disparo assíncrono para os servidores cadastrados.` }
    ];

    // Fire off to webhooks
    triggerWebhooks(finalLead);

    // Save to Supabase
    const isSupabaseConfigured = config.supabaseUrl && 
      config.supabaseUrl !== 'https://xyz.supabase.co' && 
      config.supabaseAnonKey && 
      config.supabaseAnonKey !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9...';

    if (isSupabaseConfigured) {
      try {
        const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
        
        const { error } = await supabase
          .from('leads')
          .insert([
            {
              id: finalLead.id,
              nome: finalLead.nome,
              whatsapp: finalLead.whatsapp,
              email: finalLead.email,
              empresa: finalLead.empresa,
              segmento: finalLead.segmento,
              faturamento: finalLead.faturamento,
              operacaoComercial: finalLead.operacaoComercial,
              origemLeads: finalLead.origemLeads,
              crm: finalLead.crm,
              desafioPrincipal: finalLead.desafioPrincipal,
              momentoEmpresa: finalLead.momentoEmpresa,
              investimentoMarketing: finalLead.investimentoMarketing,
              equipeComercial: finalLead.equipeComercial,
              prazoInicio: finalLead.prazoInicio,
              createdAt: finalLead.createdAt,
              
              // Fallback fields for backwards integration support
              telefone: finalLead.whatsapp || '',
              data_cadastro: dataCadastro,
              hora_cadastro: horaCadastro,
              utm_source: finalLead.utmSource || '',
              utm_medium: finalLead.utmMedium || '',
              utm_campaign: finalLead.utmCampaign || '',
              lead_score: score,
              status: 'Novo'
            }
          ]);

        if (error) {
          throw error;
        }

        newLogs.push({
          id: Math.random().toString(),
          time: timestamp,
          action: 'Supabase',
          status: 'success' as const,
          message: `Salvo no banco de dados Supabase com sucesso na tabela "leads".`
        });
      } catch (err: any) {
        console.error('Erro ao salvar no Supabase:', err);
        newLogs.push({
          id: Math.random().toString(),
          time: timestamp,
          action: 'Supabase',
          status: 'error' as const,
          message: `Erro ao salvar no Supabase: ${err.message || err.details || 'Tabela "leads" ou credenciais inválidas'}`
        });
      }
    } else {
      newLogs.push({
        id: Math.random().toString(),
        time: timestamp,
        action: 'Supabase',
        status: 'warn' as const,
        message: `Não enviado: Supabase não está configurado com credenciais válidas.`
      });
    }

    localStorage.setItem('sensesales_integration_logs', JSON.stringify([...newLogs, ...existingLogs].slice(0, 50)));
  };

  const triggerWebhooks = async (finalLead: LeadData) => {
    // Collect settings
    let config: IntegrationConfig = DEFAULT_INTEGRATIONS_CONFIG;
    const storedConfig = localStorage.getItem('sensesales_integrations_config');
    if (storedConfig) {
      try {
        config = JSON.parse(storedConfig);
      } catch (err) {}
    }

    const payload = {
      event: 'lead.qualified',
      timestamp: new Date().toISOString(),
      lead: finalLead
    };

    // Standard webhook send
    if (config.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'no-cors'
        });
      } catch (e) {}
    }

    // N8N send
    if (config.n8nUrl) {
      try {
        await fetch(config.n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'no-cors'
        });
      } catch (e) {}
    }

    // Google Sheets App Script send
    if (config.googleSheetsUrl && config.googleSheetsUrl.startsWith('http')) {
      try {
        await fetch(config.googleSheetsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'no-cors'
        });
      } catch (e) {
        console.error('Error sending lead to Google Sheets:', e);
      }
    }
  };

  // Move backward
  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      setValidationError(null);
    }
  };

  // Handle choice selection with auto-advance!
  const handleOptionSelect = (option: string) => {
    if (currentQuestion) {
      setLead(prev => ({
        ...prev,
        [currentQuestion.variable]: option
      }));
      
      // Auto-advance with visual cue
      setTimeout(() => {
        if (currentStep < totalQuestionsCount) {
          setCurrentStep(prev => prev + 1);
        } else {
          setIsProcessing(true);
        }
      }, 250);
    }
  };

  // Handle multi-select choice toggling (no auto-advance allowed!)
  const handleMultiSelectToggle = (option: string) => {
    if (currentQuestion) {
      const variable = currentQuestion.variable;
      const currentSelected = Array.isArray(lead[variable]) 
        ? (lead[variable] as string[]) 
        : [];
      
      let updatedSelected: string[];
      if (currentSelected.includes(option)) {
        updatedSelected = currentSelected.filter(val => val !== option);
      } else {
        updatedSelected = [...currentSelected, option];
      }

      setLead(prev => ({
        ...prev,
        [variable]: updatedSelected
      }));
      setValidationError(null);
    }
  };

  // Intercept Keydown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNext();
    }
  };

  // Calculates visible progress
  const progressPercent = currentStep === 0 
    ? 0 
    : Math.round((currentStep / totalQuestionsCount) * 100);

  // Opens target sales WhatsApp
  const handleSpeakWithSpecialist = () => {
    const encodedMessage = buildWhatsAppMessage(lead);
    const link = `https://wa.me/5521972736030?text=${encodedMessage}`;
    
    // Log WhatsApp redirect audit
    const existingLogsRaw = localStorage.getItem('sensesales_integration_logs');
    const existingLogs = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
    const newLog = { 
      id: Math.random().toString(), 
      time: new Date().toLocaleTimeString(), 
      action: 'WhatsApp API', 
      status: 'success' as const, 
      message: `Lead iniciando contato direto no WhatsApp comercial.` 
    };
    localStorage.setItem('sensesales_integration_logs', JSON.stringify([newLog, ...existingLogs].slice(0, 50)));

    window.open(link, '_blank');
  };

  // Handles meeting scheduling callback from BookingCalendar
  const handleBookingComplete = async (date: string, hour: string, meetLink: string) => {
    // 1. Format date safely
    let formattedDate = date;
    if (date && date.includes('-')) {
      const parts = date.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    // 2. Set scheduled meeting credentials
    setBookedMeeting({ date, hour, meetLink });
    setShowBookingStep(false);

    // 3. Update active lead state
    let finalLead: LeadData = { ...lead };
    setLead(prev => {
      const updated = {
        ...prev,
        dataReuniao: formattedDate,
        horaReuniao: hour,
        googleMeetLink: meetLink,
        status: 'Reunião agendada' as const
      };
      finalLead = updated;
      return updated;
    });

    // 4. Update locally persisted leads lists
    const existingLeadsRaw = localStorage.getItem('sensesales_leads');
    if (existingLeadsRaw) {
      try {
        const existingLeads: LeadData[] = JSON.parse(existingLeadsRaw);
        const updatedLeads = existingLeads.map(l => l.id === lead.id ? {
          ...l,
          dataReuniao: formattedDate,
          horaReuniao: hour,
          googleMeetLink: meetLink,
          status: 'Reunião agendada' as const
        } : l);
        localStorage.setItem('sensesales_leads', JSON.stringify(updatedLeads));
      } catch (err) {
        console.error('Error updating local storage leads list:', err);
      }
    }

    // 5. Update supabase registry row if configured
    let config: IntegrationConfig = DEFAULT_INTEGRATIONS_CONFIG;
    const storedConfig = localStorage.getItem('sensesales_integrations_config');
    if (storedConfig) {
      try {
        config = JSON.parse(storedConfig);
      } catch (err) {}
    }

    const isSupabaseConfigured = config.supabaseUrl && 
      config.supabaseUrl !== 'https://xyz.supabase.co' && 
      config.supabaseAnonKey && 
      config.supabaseAnonKey !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9...';

    if (isSupabaseConfigured) {
      const activeId = lead.id || finalLead.id;
      try {
        const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
        const { error } = await supabase
          .from('leads')
          .update({
            data_reuniao: formattedDate,
            hora_reuniao: hour,
            google_meet_link: meetLink,
            status: 'Reunião agendada'
          })
          .eq('id', activeId);

        if (error) throw error;

        // Sync Audit Log
        const existingLogsRaw = localStorage.getItem('sensesales_integration_logs');
        const existingLogs = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
        const newLog = { 
          id: Math.random().toString(), 
          time: new Date().toLocaleTimeString(), 
          action: 'Supabase Update', 
          status: 'success' as const, 
          message: `Lead ${activeId} atualizado para status "Reunião agendada" no Supabase.` 
        };
        localStorage.setItem('sensesales_integration_logs', JSON.stringify([newLog, ...existingLogs].slice(0, 50)));
      } catch (err: any) {
        console.error('Error updating supabase event details:', err);
        const existingLogsRaw = localStorage.getItem('sensesales_integration_logs');
        const existingLogs = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
        const errorLog = { 
          id: Math.random().toString(), 
          time: new Date().toLocaleTimeString(), 
          action: 'Supabase Update', 
          status: 'error' as const, 
          message: `Falha ao atualizar agendamento no Supabase: ${err.message || 'Erro inesperado'}` 
        };
        localStorage.setItem('sensesales_integration_logs', JSON.stringify([errorLog, ...existingLogs].slice(0, 50)));
      }
    }
  };

  // Speaks with representative specifically about the scheduled time
  const handleSpeakWithSpecialistBooked = (date: string, hour: string, meetLink: string) => {
    let formattedDate = date;
    if (date && date.includes('-')) {
      const parts = date.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    
    // Check if hour looks like "Confirmado no Calendly" or similar
    const hourSuffix = hour && (hour.toLowerCase().includes('confirmado') || hour.toLowerCase().includes('calendly'))
      ? ''
      : ` às *${hour}h*`;

    const baseMessage = `Olá! Concluí minha análise estratégica da Será Cacau e agendei nossa reunião estratégica de diagnóstico para o dia *${formattedDate}*${hourSuffix}.

Aqui estão os detalhes da reunião:
📅 Data: ${formattedDate}
⏰ Horário: ${hour}${hour.toLowerCase().includes('confirmado') ? '' : 'h (Horário de Brasília)'}
🎥 Sala do Google Meet: ${meetLink}

O Instagram da minha empresa é *${lead.empresa}*.
Gostaria de falar com o estrategista que me atenderá para adiantar alguns pontos!`;

    const encodedMessage = encodeURIComponent(baseMessage);
    const link = `https://wa.me/5521972736030?text=${encodedMessage}`;
    
    window.open(link, '_blank');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    let correctPassword = 'sensesales@admin';
    const storedConfig = localStorage.getItem('sensesales_integrations_config');
    if (storedConfig) {
      try {
        const config: IntegrationConfig = JSON.parse(storedConfig);
        if (config.adminPassword) {
          correctPassword = config.adminPassword;
        }
      } catch (err) {
        console.error('Error parsing config password', err);
      }
    }

    if (adminPasswordInput === correctPassword) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('sensesales_admin_logged_in', 'true');
      setAdminLoginError(null);
    } else {
      setAdminLoginError('Senha incorreta. Por favor verifique e tente novamente.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('sensesales_admin_logged_in');
    setAdminPasswordInput('');
    window.location.hash = '';
    
    // Safely remove /admin from URL if present without refreshing if supported
    if (window.location.pathname.endsWith('/admin')) {
      window.history.pushState(null, '', window.location.pathname.replace(/\/admin$/, ''));
    }
    setIsAdminRoute(false);
  };

  if (isAdminRoute) {
    if (!isAdminAuthenticated) {
      return (
        <div className="min-h-screen grid-overlay bg-[#FAFAF8] flex flex-col items-center justify-center p-4 relative font-sans overflow-hidden">
          {/* Faint background gradients */}
          <div className="absolute inset-0 mesh-gradient pointer-events-none"></div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md p-8 md:p-10 glass-panel rounded-[32px] border border-gray-200 shadow-sm relative z-10 space-y-6 text-left"
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-[#008060]/10 border border-[#008060]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-5 h-5 text-[#008060]" />
              </div>
              <h1 className="font-display font-bold text-2xl text-gray-900 tracking-tight">Painel do Integrador</h1>
              <p className="text-xs text-gray-500">
                Insira a senha do administrador cadastrada para controlar webhooks, leads, analytics e tags.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">SENHA DE ACESSO</label>
                <input
                  type="password"
                  required
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    if (adminLoginError) setAdminLoginError(null);
                  }}
                  placeholder="Selecione ou insira a senha..."
                  className="w-full text-xs font-mono bg-white border border-gray-300 rounded-2xl p-4 text-gray-900 focus:border-[#008060] focus:outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              {adminLoginError && (
                <div className="text-xs text-rose-600 font-sans leading-relaxed bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-center">
                  {adminLoginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 bg-[#008060] hover:bg-[#00664d] text-white font-display font-medium text-sm tracking-wide rounded-2xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Acessar Painel</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '';
                  if (window.location.pathname.endsWith('/admin')) {
                    window.history.pushState(null, '', window.location.pathname.replace(/\/admin$/, ''));
                  }
                  setIsAdminRoute(false);
                }}
                className="text-xs font-mono text-gray-400 hover:text-gray-700 transition-colors"
              >
                ← VOLTAR PARA O DIAGNÓSTICO
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    // Authenticated admin view
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-gray-900 flex flex-col font-sans">
        <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center border border-[#14B8A6]/20">
              <Lock className="w-4 h-4 text-[#14B8A6]" />
            </div>
            <div className="text-left">
              <span className="text-[10px] font-mono text-[#14B8A6] font-bold tracking-widest uppercase block">PAINEL DO ADMINISTRADOR</span>
              <h1 className="text-xs font-display font-medium text-gray-900 tracking-tight">Será Cacau Integrador</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleAdminLogout}
              className="text-xs font-mono bg-gray-50 hover:bg-gray-100 px-4 py-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-all cursor-pointer"
            >
              SAIR DO PAINEL (LOGOUT)
            </button>
          </div>
        </header>

        <div className="flex-1 w-full bg-[#FAFAF8]">
          <AdminPanel onClose={handleAdminLogout} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-overlay bg-[#FAFAF8] flex flex-col justify-between p-4 sm:p-8 md:p-12 relative font-sans overflow-y-auto overflow-x-hidden text-gray-900">
      
      {/* Subtle Mesh Background Grid */}
      <div className="absolute inset-0 mesh-gradient pointer-events-none"></div>

      {/* Header bar */}
      <header className="w-full max-w-4xl mx-auto z-10 pt-2 pb-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-[0.15em] uppercase text-gray-900 font-display">Será Cacau</span>
          </div>

          <div className="flex items-center gap-4">
          </div>
        </div>

        {/* Discreet Modern Progress Bar */}
        {currentStep > 0 && !isCompleted && !isProcessing && (
          <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden transition-all duration-300">
            <div 
              className="h-full bg-gradient-to-r from-[#008060] to-[#14B8A6] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className={`w-full mx-auto flex-1 flex flex-col items-center justify-center z-10 py-6 my-auto transition-all duration-500 ${
        currentStep === 0 ? 'max-w-4xl px-2 sm:px-0' : 'max-w-2xl px-2 sm:px-0'
      }`}>
        <AnimatePresence mode="wait">
          
          {/* STATE 0: WELCOME SCREEN */}
          {currentStep === 0 && !isProcessing && !isCompleted && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ 
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1]
              }}
              className="w-full text-center space-y-10 py-8 md:py-24 relative z-10"
              id="welcome-screen"
            >
              {/* Headline & Subtitle */}
              <div className="space-y-6 max-w-4xl mx-auto w-full px-2">
                <h1 className="font-display font-bold text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.12] text-gray-950 tracking-tight antialiased flex flex-col items-center">
                  <span className="block">Vamos entender o cenário da sua</span>
                  <span className="bg-gradient-to-r from-[#008060] to-[#14B8A6] bg-clip-text text-transparent block">operação comercial</span>
                </h1>
                <p className="text-sm md:text-base lg:text-lg text-gray-500 max-w-2xl mx-auto font-sans font-normal leading-relaxed antialiased px-2">
                  Responda algumas perguntas rápidas e descubra onde estão as maiores oportunidades de crescimento da sua operação.
                </p>
              </div>

              {/* Principal CTA Button */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 px-2">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="w-full sm:w-auto px-10 py-4 bg-[#008060] hover:bg-[#00664d] text-white font-semibold text-[15px] tracking-wide rounded-2xl transition-all group flex items-center justify-center gap-2.5 hover:translate-y-[-1px] active:translate-y-[0px] cursor-pointer shadow-sm"
                  id="btn-start"
                >
                  <span>Começar diagnóstico</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              {/* Minor metadata */}
              <p className="text-[10px] font-mono text-gray-400 tracking-widest select-none uppercase pt-2">
                Leva menos de 2 minutos • Será Cacau
              </p>
            </motion.div>
          )}

          {/* STATE 1: CONVERSATIONAL QUESTIONS */}
          {currentStep > 0 && !isProcessing && !isCompleted && currentQuestion && (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ 
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1]
              }}
              className="w-full text-left space-y-6 p-5 sm:p-8 md:p-12 glass-panel rounded-2xl sm:rounded-[32px] shadow-sm relative overflow-hidden transition-all duration-300 border border-gray-250 bg-white"
              id={`question-step-${currentStep}`}
            >
              
              {/* Question Title with Indicator Arrow */}
              <div className="flex items-start gap-3 sm:gap-4 mb-2">
                <span className="text-[#008060] font-mono text-base sm:text-2xl font-bold shrink-0 mt-0.5 sm:mt-1">{currentStep.toString().padStart(2, '0')} →</span>
                <h2 className="font-display font-medium text-lg sm:text-2xl md:text-3xl leading-tight text-gray-900 tracking-tight max-w-2xl">
                  {currentQuestion.title}
                </h2>
              </div>

              {/* INPUT TYPE RENDERING */}
              <div className="space-y-4 pt-2">
                
                {/* 1. Standard text, email & phone inputs */}
                {(currentQuestion.type === 'text' || currentQuestion.type === 'email' || currentQuestion.type === 'tel') && (
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type={currentQuestion.type}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={currentQuestion.placeholder}
                      className="w-full bg-white border border-gray-300 hover:border-gray-450 focus:border-[#008060] focus:ring-2 focus:ring-[#008060]/10 rounded-2xl px-5 py-4 text-gray-950 text-base md:text-lg transition-all shadow-sm font-sans tracking-wide"
                      id={`input-variable-${currentQuestion.variable}`}
                    />
                    
                    {/* Corner checkmark decor if filled and valid */}
                    {inputValue.length > 3 && !validationError && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center text-[#14B8A6] animate-scaleIn">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Multiple choice options */}
                {currentQuestion.type === 'select' && currentQuestion.options && (
                  <div className="space-y-3" id={`select-options-${currentQuestion.variable}`}>
                    {currentQuestion.options.map((option, idx) => {
                      const isSelected = lead[currentQuestion.variable] === option;
                      const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D, E...
                      return (
                        <button
                          key={idx}
                          onClick={() => handleOptionSelect(option)}
                          className={`w-full option-btn flex items-center justify-between p-4 md:p-5 rounded-2xl text-left cursor-pointer group ${
                            isSelected 
                              ? 'border-[#008060] bg-[#008060]/5 option-btn-selected shadow-sm text-gray-950' 
                              : 'border-gray-250 text-gray-600 hover:text-gray-950 hover:bg-[#FAFAF8]'
                          }`}
                          id={`option-${idx}`}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-mono transition-all duration-300 ${
                              isSelected 
                                ? 'border-[#008060] bg-[#008060] text-white font-bold' 
                                : 'border-gray-200 text-gray-400 group-hover:border-[#008060] group-hover:text-[#008060]'
                            }`}>
                              {optionLetter}
                            </span>
                            <span className={`text-sm md:text-base font-light transition-colors ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-600 group-hover:text-gray-950'}`}>
                              {option}
                            </span>
                          </div>
                          <div className={`transition-all duration-300 ${isSelected ? 'opacity-100 scale-100 text-[#008060]' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 text-[#008060]'}`}>
                            <Check className="w-5 h-5 stroke-[2.5px]" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2.1 Multiple-selection options (Multiselect) */}
                {currentQuestion.type === 'multiselect' && currentQuestion.options && (
                  <div className="space-y-3" id={`multiselect-options-${currentQuestion.variable}`}>
                    {currentQuestion.options.map((option, idx) => {
                      const currentSelected = Array.isArray(lead[currentQuestion.variable])
                        ? (lead[currentQuestion.variable] as string[])
                        : [];
                      const isSelected = currentSelected.includes(option);
                      const optionLetter = String.fromCharCode(65 + idx); // A, B, C...
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleMultiSelectToggle(option)}
                          className={`w-full option-btn flex items-center justify-between p-4 md:p-5 rounded-2xl text-left cursor-pointer transition-all duration-300 group ${
                            isSelected 
                              ? 'border-[#008060] bg-[#008060]/5 option-btn-selected shadow-sm text-gray-950' 
                              : 'border-gray-250 text-gray-600 hover:text-gray-950 hover:bg-[#FAFAF8]'
                          }`}
                          id={`multi-option-${idx}`}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-mono transition-all duration-300 ${
                              isSelected 
                                ? 'border-[#008060] bg-[#008060] text-white font-bold' 
                                : 'border-gray-200 text-gray-400 group-hover:border-[#008060] group-hover:text-[#008060]'
                            }`}>
                              {optionLetter}
                            </span>
                            <span className={`text-sm md:text-base font-light transition-colors ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-600 group-hover:text-gray-950'}`}>
                              {option}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'border-[#008060] bg-[#008060] text-white' 
                                : 'border-gray-250 text-transparent group-hover:border-[#008060]'
                            }`}>
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    <p className="text-[10px] text-gray-400/80 font-mono text-center pt-2 select-none">
                      💡 Selecione todas as opções que se aplicam e depois clique em "AVANÇAR"
                    </p>
                  </div>
                )}

                {/* 3. Checkbox standard interface */}
                {currentQuestion.type === 'checkbox' && (
                  <label 
                    className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                      checkboxValue 
                        ? 'bg-[#008060]/5 border-[#008060]/40 font-medium' 
                        : 'bg-white border-gray-250 hover:bg-[#FAFAF8] hover:border-gray-350'
                    }`}
                    id="checkbox-wrapper"
                  >
                    <input
                      type="checkbox"
                      checked={checkboxValue}
                      onChange={(e) => {
                        setCheckboxValue(e.target.checked);
                        if (validationError) setValidationError(null);
                      }}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                      checkboxValue 
                        ? 'border-[#008060] bg-[#008060] text-white' 
                        : 'border-gray-300 bg-white'
                    }`}>
                      {checkboxValue && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 leading-relaxed select-none">
                        Autorizo o tratamento dos meus dados para contato comercial e análise estratégica da minha empresa.
                      </p>
                    </div>
                  </label>
                )}

              </div>

              {/* Error Warning */}
              <AnimatePresence>
                {validationError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-100 px-4 py-2.5 rounded-xl text-xs"
                    id="validation-error-alert"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{validationError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Interactive buttons */}
              <div className="flex items-center justify-between pt-5 border-t border-gray-200">
                {currentStep > 1 ? (
                  <button
                    onClick={handlePrev}
                    className="flex items-center gap-1.5 py-2 text-xs font-mono font-medium text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                    id="btn-back"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>VOLTAR</span>
                  </button>
                ) : (
                  <div className="w-12 h-4" />
                )}

                <div className="flex items-center gap-4">
                  {/* Hints for desktop and click callbacks */}
                  {currentQuestion.type !== 'select' && (
                    <span className="hidden md:inline-block text-[10px] font-mono text-gray-400 select-none">
                      (pressione Enter <kbd className="bg-gray-100 px-1 py-0.5 rounded border border-gray-250 font-sans">↵</kbd>)
                    </span>
                  )}
                  
                  <button
                    onClick={handleNext}
                    className="px-6 py-3 bg-[#008060] hover:bg-[#00664d] text-white font-display font-bold text-xs tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                    id="btn-next"
                  >
                    <span>{currentStep === totalQuestionsCount ? 'CONCLUIR' : 'AVANÇAR'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {/* STATE 2: LOADING/PROCESSING SEQUENCE (2 SECONDS) */}
          {isProcessing && (
            <motion.div
              key="loader"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ 
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1]
              }}
              className="w-full flex justify-center py-6"
            >
              <LoaderStep onComplete={handleLoaderComplete} />
            </motion.div>
          )}

          {/* STATE 3: FINAL DEBRIEF SCREEN & AGENDAMENTO */}
          {isCompleted && !isProcessing && (
            <div className="w-full max-w-3xl mx-auto space-y-6">
              {bookedMeeting ? (
                <ThankYouPage
                  lead={lead}
                  bookedMeeting={bookedMeeting}
                  onReset={() => {
                    setLead(INITIAL_LEAD_DATA);
                    setCurrentStep(1);
                    setIsCompleted(false);
                    setInputValue('');
                    setCheckboxValue(false);
                    setBookedMeeting(null);
                    setShowBookingStep(true);
                  }}
                />
              ) : showBookingStep ? (
                <motion.div
                  key="booking-step"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ 
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                >
                  <BookingCalendar
                    lead={lead}
                    onBookingComplete={handleBookingComplete}
                    onBackToSummary={() => setShowBookingStep(false)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="completed-screen"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  className="w-full space-y-6 p-5 sm:p-8 md:p-12 glass-panel rounded-2xl sm:rounded-[32px] shadow-sm relative overflow-hidden transition-all duration-300 border border-gray-250 bg-white text-left"
                  id="debrief-screen"
                >
                  {/* Badge */}
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-1.5 bg-[#14B8A6]/10 border border-[#14B8A6]/20 px-3 py-1 rounded-full text-[10px] font-mono text-[#14B8A6] uppercase tracking-widest font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{bookedMeeting ? 'CONEXÃO ESTABELECIDA' : 'ANÁLISE SUCEDIDA'}</span>
                    </div>
                  </div>

                  {/* Title & Sub */}
                  <div className="text-center space-y-4">
                    <h1 className="font-display font-bold text-2xl md:text-4xl text-gray-900 tracking-tight">
                      {bookedMeeting 
                        ? 'Reunião agendada com sucesso' 
                        : 'Sua análise foi concluída'}
                    </h1>
                    <p className="text-xs md:text-sm text-gray-500 leading-relaxed max-w-2xl mx-auto whitespace-pre-line">
                      {bookedMeeting 
                        ? `Seu horário foi reservado.\n\nVocê receberá um convite por e-mail contendo o link da reunião.\n\nNossa equipe também recebeu suas informações e analisará o perfil da sua empresa antes do encontro.` 
                        : 'Recebemos suas respostas para analisar sua empresa. Agora, reserve seu horário exclusivo com nossa equipe.'}
                    </p>
                  </div>

                  {/* Booked Meeting Detail Card */}
                  {bookedMeeting && (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="border border-[#14B8A6]/25 bg-[#14B8A6]/5 p-6 rounded-2xl space-y-4"
                      id="booked-meeting-details"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-150 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#14B8A6]/10 border border-[#14B8A6]/20 rounded-xl flex items-center justify-center text-[#14B8A6] shrink-0">
                            <Calendar className="w-5 h-5 text-[#14B8A6]" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-[#14B8A6] block font-bold">REUNIÃO CONFIRMADA</span>
                            <span className="text-sm font-bold text-gray-900 block">
                              {bookedMeeting.date.split('-').reverse().join('/')} às {bookedMeeting.hour}h
                            </span>
                          </div>
                        </div>

                        {bookedMeeting.meetLink && (
                          <a 
                            href={bookedMeeting.meetLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#008060] hover:bg-[#00664d] text-white font-mono text-[11px] font-bold rounded-xl transition-all shadow-sm hover:scale-[1.02]"
                          >
                            <Video className="w-4 h-4 text-white animate-pulse" />
                            <span>ENTRAR NO GOOGLE MEET</span>
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-light">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-1 shadow-sm">
                          <span className="text-[#14B8A6] block text-[10px] uppercase font-mono tracking-wider font-bold">📅 DATA DA REUNIÃO</span>
                          <span className="text-gray-950 block font-semibold text-sm">{bookedMeeting.date.split('-').reverse().join('/')}</span>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-1 shadow-sm">
                          <span className="text-[#14B8A6] block text-[10px] uppercase font-mono tracking-wider font-bold">⏰ HORÁRIO DA REUNIÃO</span>
                          <span className="text-gray-950 block font-semibold text-sm">{bookedMeeting.hour} (Horário de Brasília)</span>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-1 md:col-span-2 shadow-sm">
                          <span className="text-[#008060] block text-[10px] uppercase font-mono tracking-wider font-bold">🎥 LINK GOOGLE MEET</span>
                          {bookedMeeting.meetLink ? (
                            <a 
                              href={bookedMeeting.meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#008060] hover:underline hover:text-[#00664d] font-mono break-all font-medium block text-[11px]"
                            >
                              {bookedMeeting.meetLink}
                            </a>
                          ) : (
                            <span className="text-gray-400 block font-mono">Gerando link da sala...</span>
                          )}
                        </div>
                        <div className="p-1.5 md:col-span-2 grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-mono">Participante Lead</span>
                            <span className="text-gray-950 block font-medium truncate">{lead.nome} ({lead.email})</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-mono">Apoio Estratégico</span>
                            <span className="text-gray-950 block font-medium">Equipe Será Cacau</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Core visual summary of user replies */}
                  <LeadSummary lead={lead} />

                  {/* Interactive Buttons */}
                  <div className="flex flex-col items-center gap-3 pt-2 animate-fade-in">
                    {!bookedMeeting && (
                      /* CTA to schedule */
                      <button
                        onClick={() => setShowBookingStep(true)}
                        className="w-full py-4 bg-[#008060] hover:bg-[#00664d] text-white font-display font-bold text-sm tracking-wide rounded-2xl transition-all group flex items-center justify-center gap-2.5 scale-100 hover:scale-[1.01] shadow-sm cursor-pointer"
                        id="btn-trigger-scheduling"
                      >
                        <Calendar className="w-4 h-4 text-white animate-bounce" />
                        <span>RESERVAR HORÁRIO EXCLUSIVO</span>
                      </button>
                    )}
                    
                    <p className="text-[10px] text-gray-400 font-mono text-center">
                      {bookedMeeting 
                        ? 'Você receberá o convite com a sala direto no seu e-mail' 
                        : 'Você será direcionado para escolher o melhor momento para conversar'}
                    </p>
                  </div>

                  {/* Clear button to reset form */}
                  <div className="flex justify-center pt-3 gap-6 flex-wrap">
                    {!bookedMeeting && (
                      <button
                        onClick={handleSpeakWithSpecialist}
                        className="text-[10px] text-gray-400 hover:text-gray-900 font-mono tracking-wider transition-colors cursor-pointer"
                      >
                        PULAR AGENDAMENTO E FALAR ATRAVÉS DO WHATSAPP
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setLead(INITIAL_LEAD_DATA);
                        setCurrentStep(1);
                        setIsCompleted(false);
                        setInputValue('');
                        setCheckboxValue(false);
                        setBookedMeeting(null);
                        setShowBookingStep(true);
                      }}
                      className="text-[10px] text-gray-300 hover:text-gray-600 font-mono tracking-wider transition-colors cursor-pointer"
                    >
                      REINICIAR ANÁLISE COMPLETA
                    </button>
                  </div>

                </motion.div>
              )}
            </div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer bar */}
      <footer className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between text-[10px] font-mono text-gray-400 z-10 py-3 gap-2 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <span>SERÁ CACAU © 2026</span>
          <span className="hidden md:inline">•</span>
          <span className="hover:text-gray-900 transition-colors">POLÍTICA DE PRIVACIDADE</span>
          <span className="hidden md:inline">•</span>
          <span className="hover:text-gray-900 transition-colors">DIRETRIZES DE LGPD</span>
        </div>

        {/* Dynamic progress tracker indicator */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {currentStep > 0 && !isCompleted && !isProcessing && (
            <div className="flex items-center gap-2 w-full md:w-56">
              <span className="shrink-0 text-[10px] font-mono text-gray-500">{progressPercent}%</span>
              <div className="w-full h-[3px] bg-gray-200 border border-gray-300 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#008060] to-[#14B8A6] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </footer>

    </div>
  );
}
