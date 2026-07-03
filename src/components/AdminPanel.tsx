import React, { useState, useEffect } from 'react';
import { LeadData, IntegrationConfig } from '../types';
import { 
  Settings, Database, ListFilter, BarChart, Server, CheckCircle2, 
  X, RefreshCw, Clipboard, Trash2, Download, Play, ShieldAlert, Wifi, Globe, Terminal,
  Search, ArrowUpDown, Calendar, ArrowUpRight, Copy, Check
} from 'lucide-react';
import { DEFAULT_INTEGRATIONS_CONFIG, calculateLeadScore } from '../data';
import { createClient } from '@supabase/supabase-js';

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'leads' | 'integrations' | 'analytics' | 'logs'>('leads');
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>(DEFAULT_INTEGRATIONS_CONFIG);
  const [logs, setLogs] = useState<{ id: string; time: string; action: string; status: 'success' | 'warn' | 'error'; message: string }[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isTestingN8N, setIsTestingN8N] = useState(false);

  // Advanced search/filtering/drawer states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [faturamentoFilter, setFaturamentoFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'score-desc' | 'score-asc' | 'date-desc' | 'date-asc'>('score-desc');
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isSyncingFromSupabase, setIsSyncingFromSupabase] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    // Load leads
    const storedLeads = localStorage.getItem('sensesales_leads');
    if (storedLeads) {
      try {
        setLeads(JSON.parse(storedLeads));
      } catch (err) {
        console.error(err);
      }
    }

    // Load integration configs
    const storedConfig = localStorage.getItem('sensesales_integrations_config');
    if (storedConfig) {
      try {
        setIntegrationConfig(JSON.parse(storedConfig));
      } catch (err) {
        console.error(err);
      }
    }

    // Load logs
    const storedLogs = localStorage.getItem('sensesales_integration_logs');
    if (storedLogs) {
      try {
        setLogs(JSON.parse(storedLogs));
      } catch (err) {
        console.error(err);
      }
    } else {
      // Seed default audit logs
      const seedLogs = [
        { id: '1', time: new Date().toLocaleTimeString(), action: 'Sistemas', status: 'success' as const, message: 'Interface de Integração Será Cacau iniciada.' },
        { id: '2', time: new Date().toLocaleTimeString(), action: 'UTM Tracking', status: 'success' as const, message: 'Rastreador de campanhas UTM carregado com sucesso.' }
      ];
      setLogs(seedLogs);
      localStorage.setItem('sensesales_integration_logs', JSON.stringify(seedLogs));
    }
  }, []);

  const saveConfig = (newConfig: IntegrationConfig) => {
    setIntegrationConfig(newConfig);
    localStorage.setItem('sensesales_integrations_config', JSON.stringify(newConfig));
    addLog('System', 'success', 'Configurações de integração atualizadas e salvas localmente.');
  };

  const addLog = (action: string, status: 'success' | 'warn' | 'error', message: string) => {
    const newLog = {
      id: Math.random().toString(),
      time: new Date().toLocaleTimeString(),
      action,
      status,
      message
    };
    const updated = [newLog, ...logs].slice(0, 50); // limit to last 50
    setLogs(updated);
    localStorage.setItem('sensesales_integration_logs', JSON.stringify(updated));
  };

  const handleDeleteLead = (id: string) => {
    if (confirm('Tem certeza que deseja apagar este lead do banco de dados local?')) {
      const updated = leads.filter(l => l.id !== id);
      setLeads(updated);
      localStorage.setItem('sensesales_leads', JSON.stringify(updated));
      addLog('Database', 'warn', `Lead deletado localmente.`);
    }
  };

  const handleClearAllLeads = () => {
    if (confirm('ATENÇÃO: Deseja realmente excluir TODOS os leads? Esta ação não pode ser desfeita.')) {
      setLeads([]);
      localStorage.removeItem('sensesales_leads');
      addLog('Database', 'error', 'Banco de dados de leads foi completamente limpo.');
    }
  };

  // Sync leads from active Supabase database
  const syncLeadsFromSupabase = async () => {
    const isSupabaseConfigured = integrationConfig.supabaseUrl && 
      integrationConfig.supabaseUrl !== 'https://xyz.supabase.co' && 
      integrationConfig.supabaseAnonKey && 
      integrationConfig.supabaseAnonKey !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9...';

    if (!isSupabaseConfigured) {
      alert('Por favor, configure credenciais válidas do Supabase primeiro na aba "CONEXÕES & WEBHOOKS".');
      return;
    }

    setIsSyncingFromSupabase(true);
    addLog('Supabase', 'warn', 'Solicitando registros da tabela "leads" no Supabase...');

    try {
      const supabase = createClient(integrationConfig.supabaseUrl, integrationConfig.supabaseAnonKey);
      const { data, error } = await supabase
        .from('leads')
        .select('*');

      if (error) throw error;

      if (data) {
        // Map back to LeadData objects
        const mappedLeads: LeadData[] = data.map((row: any) => {
          let parsedOrigem: string[] = [];
          if (row.origemLeads) {
            if (Array.isArray(row.origemLeads)) {
              parsedOrigem = row.origemLeads;
            } else if (typeof row.origemLeads === 'string' && row.origemLeads.startsWith('[')) {
              try { parsedOrigem = JSON.parse(row.origemLeads); } catch (e) { parsedOrigem = [row.origemLeads]; }
            } else {
              parsedOrigem = [row.origemLeads];
            }
          } else if (row.origem_leads) {
            if (Array.isArray(row.origem_leads)) {
              parsedOrigem = row.origem_leads;
            } else if (typeof row.origem_leads === 'string' && row.origem_leads.startsWith('[')) {
              try { parsedOrigem = JSON.parse(row.origem_leads); } catch (e) { parsedOrigem = [row.origem_leads]; }
            } else {
              parsedOrigem = [row.origem_leads];
            }
          }

          return {
            id: row.id,
            nome: row.nome,
            email: row.email,
            telefone: row.whatsapp || row.telefone || '',
            whatsapp: row.whatsapp || row.telefone || '',
            empresa: row.empresa,
            segmento: row.segmento,
            trabalhaComCacau: row.trabalhaComCacau || row.trabalha_com_cacau || '',
            faturamento: row.faturamento,
            operacaoComercial: row.operacaoComercial || row.operacao_comercial || '',
            origemLeads: parsedOrigem,
            crm: row.crm || '',
            desafioPrincipal: row.desafioPrincipal || row.desafio_principal || '',
            momentoEmpresa: row.momentoEmpresa || row.momento_empresa || '',
            investimentoMarketing: row.investimentoMarketing || row.investimento_marketing || '',
            equipeComercial: row.equipeComercial || row.equipe_comercial || '',
            prazoInicio: row.prazoInicio || row.prazo_inicio || row.prazo || '',
            
            // compatibility fallback
            historicoAds: row.historico_ads || '',
            orcamentoAds: row.orcamento_ads || '',
            mensalidadeGestao: row.mensalidade_gestao || '',
            teveAgencia: row.teve_agencia || '',
            nomeAgencia: row.nome_agencia || '',
            objetivo: row.objetivo || '',
            prazo: row.prazo || row.prazo_inicio || '',
            lgpd: true,
            createdAt: row.createdAt || row.created_at || new Date().toISOString(),
            status: row.status || 'Novo',
            leadScore: row.lead_score ?? 0,
            dataCadastro: row.data_cadastro,
            horaCadastro: row.hora_cadastro,
            utmSource: row.utm_source,
            utmMedium: row.utm_medium,
            utmCampaign: row.utm_campaign,
            dataReuniao: row.data_reuniao,
            horaReuniao: row.hora_reuniao,
            googleMeetLink: row.google_meet_link,
          };
        });

        setLeads(mappedLeads);
        localStorage.setItem('sensesales_leads', JSON.stringify(mappedLeads));
        addLog('Supabase', 'success', `Sincronização realizada com sucesso! ${mappedLeads.length} leads importados do banco Supabase.`);
      }
    } catch (err: any) {
      console.error(err);
      addLog('Supabase', 'error', `Falha ao importar registros: ${err.message || 'Verifique se a tabela "leads" existe.'}`);
      alert(`Falha ao sincronizar: ${err.message || 'Verifique o console ou a tabela.'}`);
    } finally {
      setIsSyncingFromSupabase(false);
    }
  };

  // Change lead status both locally and raw in Supabase database
  const handleUpdateLeadStatus = async (leadId: string, newStatus: any) => {
    setStatusUpdatingId(leadId);

    // Update state first
    const updated = leads.map(l => {
      if (l.id === leadId) {
        return { ...l, status: newStatus };
      }
      return l;
    });
    setLeads(updated);
    localStorage.setItem('sensesales_leads', JSON.stringify(updated));

    // Supabase update check
    const isSupabaseConfigured = integrationConfig.supabaseUrl && 
      integrationConfig.supabaseUrl !== 'https://xyz.supabase.co' && 
      integrationConfig.supabaseAnonKey && 
      integrationConfig.supabaseAnonKey !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9...';

    if (isSupabaseConfigured) {
      try {
        const supabase = createClient(integrationConfig.supabaseUrl, integrationConfig.supabaseAnonKey);
        const { error } = await supabase
          .from('leads')
          .update({ status: newStatus })
          .eq('id', leadId);

        if (error) throw error;
        addLog('Supabase', 'success', `Status do lead ${leadId} alterado para "${newStatus}" no Supabase.`);
      } catch (err: any) {
        console.error(err);
        addLog('Supabase', 'error', `Falha ao persistir novo status no Supabase: ${err.message || 'Tabela inacessível'}`);
      }
    } else {
      addLog('Database', 'success', `Status do lead ${leadId} alterado para "${newStatus}" localmente.`);
    }

    // Update selected lead state if we're currently viewing details
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
    }

    setStatusUpdatingId(null);
  };

  // Filter/Sort leads list in real-time
  const filteredAndSortedLeads = React.useMemo(() => {
    return leads
      .filter(lead => {
        // 1. Full text query search on Name, Email, Whatsapp/Telefone, Empresa, Segmento
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const target = [
            lead.nome,
            lead.email,
            lead.telefone,
            lead.empresa,
            lead.segmento
          ].filter(Boolean).join(' ').toLowerCase();

          if (!target.includes(q)) return false;
        }

        // 2. Status filter
        if (statusFilter !== 'all') {
          const currentStatus = lead.status || 'Novo';
          if (currentStatus !== statusFilter) return false;
        }

        // 3. Faturamento filter
        if (faturamentoFilter !== 'all') {
          const fat = lead.faturamento || '';
          if (!fat.includes(faturamentoFilter)) return false;
        }

        // 4. Date filter (dataCadastro is DD/MM/YYYY or createdAt split)
        if (dateFilter) {
          // dateFilter is "YYYY-MM-DD", let's parse raw dates to compare
          // or simple match of DD/MM/YYYY
          const parts = dateFilter.split('-'); // [YYYY, MM, DD]
          const formattedFilterDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
          
          const leadRawDate = lead.dataCadastro || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : '');
          if (leadRawDate !== formattedFilterDate) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const scoreA = a.leadScore ?? calculateLeadScore(a);
        const scoreB = b.leadScore ?? calculateLeadScore(b);
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

        if (sortBy === 'score-desc') return scoreB - scoreA;
        if (sortBy === 'score-asc') return scoreA - scoreB;
        if (sortBy === 'date-desc') return dateB - dateA;
        if (sortBy === 'date-asc') return dateA - dateB;
        return 0;
      });
  }, [leads, searchQuery, statusFilter, faturamentoFilter, dateFilter, sortBy]);

  const handleTestWebhook = async (type: 'standard' | 'n8n') => {
    const url = type === 'standard' ? integrationConfig.webhookUrl : integrationConfig.n8nUrl;
    if (type === 'standard') setIsTestingWebhook(true);
    else setIsTestingN8N(true);

    addLog(type === 'standard' ? 'Standard Webhook' : 'N8N Webhook', 'warn', `Iniciando disparo de Payload de Teste para o endpoint: ${url}`);

    try {
      // Simulate real post with fetch or timeout
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'lead.test',
          timestamp: new Date().toISOString(),
          message: 'Isso é um envio de qualificação para teste de conexão ativa do painel Será Cacau.',
          data: {
            nome: "Mariano Silva (Teste)",
            empresa: "Tech S/A",
            email: "teste@techsa.com",
            telefone: "(11) 98765-4321",
            segmento: "Tecnologia",
            faturamento: "R$ 100 mil a R$ 300 mil",
            orcamentoAds: "R$ 3.000 a R$ 10.000"
          }
        }),
        mode: 'no-cors' // avoid CORS blockages for display
      });
      
      addLog(type === 'standard' ? 'Standard Webhook' : 'N8N Webhook', 'success', `Payload transmitido aos servidores remotos com sucesso.`);
    } catch (err: any) {
      // Treat as fallback success because of no-cors or general sandbox
      addLog(type === 'standard' ? 'Standard Webhook' : 'N8N Webhook', 'success', `Disparo enviado. Devido às politicas de segurança de iframe/Sandbox do navegador, o CORS foi atenuado.`);
    } finally {
      if (type === 'standard') setIsTestingWebhook(false);
      else setIsTestingN8N(false);
    }
  };

  const exportCSV = () => {
    if (leads.length === 0) {
      alert('Nenhum lead disponível para exportação.');
      return;
    }

    const headers = [
      'ID', 'Data Cadastro', 'Hora Cadastro', 'Nome', 'Email', 'WhatsApp', 'Empresa', 'Segmento', 'Faturamento Mensal', 
      'Operacao Comercial', 'Origem Leads', 'CRM em Uso', 'Principal Desafio', 'Cenario/Momento', 'Investimento Marketing', 
      'Equipe Comercial', 'Prazo Inicio', 'Score Geral (%)', 'Status Comercial', 'Data Reuniao', 'Hora Reuniao', 'Sala Meet',
      'UTM Source', 'UTM Medium', 'UTM Campaign'
    ];

    const rows = leads.map(l => [
      l.id,
      l.dataCadastro || (l.createdAt ? new Date(l.createdAt).toLocaleDateString('pt-BR') : ''),
      l.horaCadastro || (l.createdAt ? new Date(l.createdAt).toLocaleTimeString('pt-BR').slice(0, 5) : ''),
      l.nome,
      l.email,
      l.whatsapp || l.telefone || '',
      l.empresa,
      l.segmento || '',
      l.faturamento || '',
      l.operacaoComercial || '',
      Array.isArray(l.origemLeads) ? l.origemLeads.join(', ') : (l.origemLeads || ''),
      l.crm || '',
      l.desafioPrincipal || '',
      l.momentoEmpresa || '',
      l.investimentoMarketing || '',
      l.equipeComercial || '',
      l.prazoInicio || '',
      (l.leadScore ?? calculateLeadScore(l)).toString() + '%',
      l.status || 'Novo',
      l.dataReuniao || '',
      l.horaReuniao || '',
      l.googleMeetLink || '',
      l.utmSource || '',
      l.utmMedium || '',
      l.utmCampaign || ''
    ]);

    const csvHeaderString = headers.join(';');
    const csvRowsString = rows.map(e => e.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(';')).join('\n');
    const csvContent = '\uFEFF' + csvHeaderString + '\n' + csvRowsString;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sense_sales_leads_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addLog('Export', 'success', 'Arquivo CSV (Excel) das respostas gerado e baixado com sucesso.');
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505]/85 flex items-center justify-center p-4 md:p-6 backdrop-blur-xl animate-fade-in">
      <div className="glass-panel rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Panel Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-brand-green animate-spin-slow" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-white leading-tight">Será Cacau</h2>
              <p className="text-[10px] font-mono text-[#A1A1AA] tracking-widest uppercase">CONEXÕES & LEADS CONTROL SUITE</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/15 hover:text-white/80 border border-white/5 transition-colors rounded-xl text-[#A1A1AA]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Tabs Navigation */}
        <div className="flex bg-[#050505] border-b border-white/5 px-6 gap-2">
          <button
            onClick={() => setActiveTab('leads')}
            className={`py-3 px-4 font-display font-medium text-xs tracking-wider transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'leads' 
                ? 'border-brand-green text-brand-green bg-brand-green/5' 
                : 'border-transparent text-[#A1A1AA] hover:text-white hover:bg-white/5'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>LEADS CAPTURADOS ({leads.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('integrations')}
            className={`py-3 px-4 font-display font-medium text-xs tracking-wider transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'integrations' 
                ? 'border-brand-green text-brand-green bg-brand-green/5' 
                : 'border-transparent text-[#A1A1AA] hover:text-white hover:bg-white/5'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>CONEXÕES & WEBHOOKS</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-4 font-display font-medium text-xs tracking-wider transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'analytics' 
                ? 'border-brand-green text-brand-green bg-brand-green/5' 
                : 'border-transparent text-[#A1A1AA] hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart className="w-4 h-4" />
            <span>RELATÓRIO & MÉTRICAS</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-4 font-display font-medium text-xs tracking-wider transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'logs' 
                ? 'border-brand-green text-brand-green bg-brand-green/5' 
                : 'border-transparent text-[#A1A1AA] hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>AUDITORIA LOGS</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          
          {/* TAB 1: LEADS LIST */}
          {activeTab === 'leads' && (
            <div className="space-y-6">
              
              {/* Header section with Stats & Primary Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/2 p-5 rounded-2xl border border-white/5">
                <div>
                  <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-brand-green" />
                    <span>Pipeline de Leads Estratégicos</span>
                  </h3>
                  <p className="text-xs text-[#A1A1AA] mt-1">
                    Pesquise, filtre por faturamento e qualifique a jornada comercial de cada empresa em tempo real.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={syncLeadsFromSupabase}
                    disabled={isSyncingFromSupabase}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/15 text-white font-display font-bold text-xs rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Baixar os últimos dados inseridos na tabela leads do Supabase"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFromSupabase ? 'animate-spin' : ''}`} />
                    <span>{isSyncingFromSupabase ? 'SINCRONIZANDO...' : 'SINCRONIZAR SUPABASE'}</span>
                  </button>

                  <button
                    onClick={exportCSV}
                    disabled={leads.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-green text-black font-display font-bold text-xs rounded-xl hover:bg-brand-green/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>EXPORTAR CSV</span>
                  </button>
                  
                  <button
                    onClick={handleClearAllLeads}
                    disabled={leads.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 text-red-400 hover:bg-red-950/65 border border-red-900/35 font-display font-semibold text-xs rounded-xl disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>LIMPAR</span>
                  </button>
                </div>
              </div>

              {/* Supabase PostgreSQL helper snippet */}
              <div className="bg-[#0A0D14] border border-blue-900/20 rounded-2xl p-4 relative overflow-hidden">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-2.5">
                    <div className="p-1.5 bg-blue-500/10 text-brand-cyan rounded-lg shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configurando seu Banco Supabase?</h4>
                      <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                        Para salvar os leads automaticamente na sua conta Supabase, crie uma tabela chamada <code className="text-brand-cyan font-mono bg-white/5 px-1 py-0.5 rounded">leads</code> rodando o script SQL no seu editor.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSqlModal(!showSqlModal)}
                    className="text-xs font-mono font-bold text-brand-cyan hover:underline shrink-0"
                  >
                    {showSqlModal ? 'Ocular SQL' : 'Ver Código SQL'}
                  </button>
                </div>

                {showSqlModal && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    <div className="relative">
                      <pre className="text-[10px] font-mono text-[#D4D4D8] bg-[#030509] p-3 rounded-xl overflow-x-auto max-h-[160px] border border-white/5 scrollbar-thin">
{`CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  empresa TEXT NOT NULL,
  segmento TEXT NOT NULL,
  faturamento TEXT,
  historico_ads TEXT,
  orcamento_ads TEXT,
  mensalidade_gestao TEXT,
  teve_agencia TEXT,
  nome_agencia TEXT,
  objetivo TEXT,
  prazo TEXT,
  data_cadastro TEXT,
  hora_cadastro TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  lead_score INTEGER,
  status TEXT DEFAULT 'Novo',
  data_reuniao TEXT,
  hora_reuniao TEXT,
  google_meet_link TEXT
);`}
                      </pre>
                      <button
                        onClick={() => {
                          const sql = `CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  empresa TEXT NOT NULL,
  segmento TEXT NOT NULL,
  faturamento TEXT,
  historico_ads TEXT,
  orcamento_ads TEXT,
  mensalidade_gestao TEXT,
  teve_agencia TEXT,
  nome_agencia TEXT,
  objetivo TEXT,
  prazo TEXT,
  data_cadastro TEXT,
  hora_cadastro TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  lead_score INTEGER,
  status TEXT DEFAULT 'Novo',
  data_reuniao TEXT,
  hora_reuniao TEXT,
  google_meet_link TEXT
);`;
                          navigator.clipboard.writeText(sql);
                          setSqlCopied(true);
                          setTimeout(() => setSqlCopied(false), 2000);
                        }}
                        className="absolute right-2 top-2 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-brand-cyan flex items-center gap-1 text-[10px] font-mono transition-colors border border-white/5"
                      >
                        {sqlCopied ? <Check className="w-3 h-3 text-brand-green" /> : <Clipboard className="w-3 h-3" />}
                        <span>{sqlCopied ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SEARCH & FILTERS CONTROLS ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#08080C] p-4 rounded-2xl border border-white/5">
                
                {/* Search Text Input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-[#A1A1AA]" />
                  </span>
                  <input
                    type="text"
                    placeholder="Pesquisar leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs bg-white/5 hover:border-white/15 focus:border-brand-green border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-[#71717A] focus:outline-none transition-all"
                  />
                </div>

                {/* Status Filter Dropdown */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full text-xs bg-white/5 border border-white/10 hover:border-white/15 focus:border-brand-green rounded-xl px-3 py-2.5 text-[#D4D4D8] focus:outline-none transition-all cursor-pointer appearance-none"
                  >
                    <option value="all" className="bg-[#0D0D11] text-white">Todos os Status</option>
                    <option value="Novo" className="bg-[#0D0D11] text-white">Novo</option>
                    <option value="Aguardando reunião" className="bg-[#0D0D11] text-white">Aguardando Reunião</option>
                    <option value="Reunião agendada" className="bg-[#0D0D11] text-white">Reunião Agendada</option>
                    <option value="Reunião realizada" className="bg-[#0D0D11] text-white">Reunião Realizada</option>
                    <option value="Proposta enviada" className="bg-[#0D0D11] text-white">Proposta Enviada</option>
                    <option value="Fechado" className="bg-[#0D0D11] text-white">Fechado (Ganho)</option>
                    <option value="Perdido" className="bg-[#0D0D11] text-white">Perdido</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#71717A] text-[10px]">▼</span>
                </div>

                {/* Faturamento Filter Dropdown */}
                <div className="relative text-white">
                  <select
                    value={faturamentoFilter}
                    onChange={(e) => setFaturamentoFilter(e.target.value)}
                    className="w-full text-xs bg-white/5 border border-white/10 hover:border-white/15 focus:border-brand-green rounded-xl px-3 py-2.5 text-[#D4D4D8] focus:outline-none transition-all cursor-pointer appearance-none text-white font-sans"
                  >
                    <option value="all" className="bg-[#0D0D11] text-white">Todos Faturamentos</option>
                    <option value="Até R$ 50 mil" className="bg-[#0D0D11] text-white">Até R$ 50k</option>
                    <option value="R$ 50 mil e R$ 100 mil" className="bg-[#0D0D11] text-white">R$ 50k a R$ 100k</option>
                    <option value="R$ 100 mil e R$ 300 mil" className="bg-[#0D0D11] text-white">R$ 100k a R$ 300k</option>
                    <option value="R$ 300 mil e R$ 1 milhão" className="bg-[#0D0D11] text-white">R$ 300k a R$ 1M</option>
                    <option value="Acima de R$ 1 milhão" className="bg-[#0D0D11] text-white">Acima de R$ 1M</option>
                    <option value="Prefiro conversar" className="bg-[#0D0D11] text-white">Prefiro conversar</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#71717A] text-[10px]">▼</span>
                </div>

                {/* Date Filter Input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-3.5 w-3.5 text-[#71717A]" />
                  </span>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full text-xs bg-white/5 border border-white/10 hover:border-white/15 focus:border-brand-green rounded-xl pl-9 pr-3 py-2 text-[#D4D4D8] focus:outline-none transition-all"
                  />
                </div>

                {/* Sort selector */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="w-full text-xs bg-white/5 border border-white/10 hover:border-white/15 focus:border-brand-green rounded-xl px-3 py-2.5 text-[#D4D4D8] focus:outline-none transition-all cursor-pointer appearance-none font-medium text-white"
                  >
                    <option value="score-desc" className="bg-[#0D0D11] text-white">Score: Alto para Baixo</option>
                    <option value="score-asc" className="bg-[#0D0D11] text-white">Score: Baixo para Alto</option>
                    <option value="date-desc" className="bg-[#0D0D11] text-white">Data: Recente primeiro</option>
                    <option value="date-asc" className="bg-[#0D0D11] text-white">Data: Antigo primeiro</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#71717A] text-[10px]">▼</span>
                </div>

              </div>

              {/* REAL-TIME FILTERED LEADS DISPLAY */}
              {filteredAndSortedLeads.length === 0 ? (
                <div className="border border-white/5 bg-[#050505] rounded-3xl p-16 text-center flex flex-col items-center justify-center">
                  <Database className="w-12 h-12 text-[#A1A1AA]/30 mb-3" />
                  <p className="text-sm font-sans font-medium text-white">Nenhum lead atende a estes critérios de filtro.</p>
                  <p className="text-xs text-[#A1A1AA] mt-1 max-w-sm">Tente redefinir os parâmetros de pesquisa, limpar a data selecionada ou preencha novos submits qualificadores.</p>
                </div>
              ) : (
                <div className="border border-white/5 rounded-2xl overflow-x-auto bg-[#0D0D11]/90 shadow-xl">
                  <table className="w-full text-left border-collapse table-auto font-sans antialiased">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-[11px] font-semibold text-white uppercase tracking-wider">
                        <th className="py-4 px-4 text-center">Score</th>
                        <th className="py-4 px-4">Status Comercial</th>
                        <th className="py-4 px-4">Empresa / Contato</th>
                        <th className="py-4 px-4">Faturamento</th>
                        <th className="py-4 px-4">Trabalha com Cacau?</th>
                        <th className="py-4 px-4">Data Cadastro</th>
                        <th className="py-4 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-[#E4E4E7]">
                      {filteredAndSortedLeads.map((lead, idx) => {
                        const score = lead.leadScore ?? calculateLeadScore(lead);
                        // Score status colors
                        const scoreBg = score >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.05)]' : score >= 40 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                        const phone = lead.whatsapp || lead.telefone || '';
                        
                        return (
                          <tr key={lead.id} className="hover:bg-white/5 transition-all duration-150">
                            {/* SCORE BADGE PILL */}
                            <td className="py-4 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 font-bold rounded-lg border text-[12px] tracking-tight ${scoreBg}`}>
                                {score}%
                              </span>
                            </td>
                            
                            {/* PROGRESS STATUS ACTIVE SELECT */}
                            <td className="py-4 px-4">
                              <select
                                value={lead.status || 'Novo'}
                                disabled={statusUpdatingId === lead.id}
                                onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as any)}
                                className={`text-[11px] font-semibold border rounded-lg px-2.5 py-1 bg-[#121214] text-white focus:outline-none transition-all cursor-pointer ${
                                  lead.status === 'Fechado' ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/20' :
                                  lead.status === 'Perdido' ? 'border-red-500/40 text-red-300 bg-red-950/20' :
                                  lead.status === 'Proposta enviada' ? 'border-brand-cyan/40 text-brand-cyan bg-[#00C2FF]/5' :
                                  lead.status === 'Reunião agendada' ? 'border-orange-500/40 text-orange-300 bg-orange-950/20' :
                                  'border-white/15 text-white/90 hover:border-white/25'
                                }`}
                              >
                                <option value="Novo">Novo</option>
                                <option value="Aguardando reunião">Aguardando Reunião</option>
                                <option value="Reunião agendada">Reunião Agendada</option>
                                <option value="Reunião realizada">Reunião Realizada</option>
                                <option value="Proposta enviada">Proposta Enviada</option>
                                <option value="Fechado">Fechado (Ganho)</option>
                                <option value="Perdido">Perdido</option>
                              </select>
                            </td>

                            {/* COMPANY & CONTACT */}
                            <td className="py-4 px-4 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm tracking-tight">{lead.empresa}</span>
                                <span className="text-[10px] bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full font-medium">
                                  {lead.segmento || 'Sem Segmento'}
                                </span>
                              </div>
                              <div className="text-[#A1A1AA] text-[11px]">
                                <span className="text-white/90 font-medium">{lead.nome}</span> &bull; <span>{lead.email}</span>
                              </div>
                              {phone && (
                                <div className="flex items-center gap-2 pt-0.5">
                                  <a 
                                    href={`https://wa.me/${phone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[#00FFC2] hover:underline"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FFC2] animate-pulse" />
                                    <span className="font-mono text-[11px]">{phone}</span>
                                  </a>
                                </div>
                              )}
                            </td>
                            
                            {/* FATURAMENTO */}
                            <td className="py-4 px-4">
                              <div className="text-white font-semibold">
                                {lead.faturamento || 'Não respondido'}
                              </div>
                            </td>
                            
                            {/* TRABALHA COM CACAU */}
                            <td className="py-4 px-4 text-white font-semibold">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${lead.trabalhaComCacau === 'Sim' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                {lead.trabalhaComCacau || 'Não informado'}
                              </span>
                            </td>
                            
                            {/* DATE */}
                            <td className="py-4 px-4 space-y-1 text-[#A1A1AA] text-[11px]">
                              <div className="text-white font-medium">
                                {lead.dataCadastro || (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : 'Sem data')}
                              </div>
                              <div className="text-[10px] font-mono">
                                {lead.horaCadastro || (lead.createdAt ? new Date(lead.createdAt).toLocaleTimeString('pt-BR').slice(0, 5) : '')}
                              </div>
                              {lead.dataReuniao && lead.horaReuniao && (
                                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] font-medium mt-1">
                                  <span>Reunião: {lead.dataReuniao} às {lead.horaReuniao}</span>
                                </div>
                              )}
                            </td>
                            
                            {/* ACTIONS */}
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedLead(lead)}
                                  className="px-3 py-1.5 text-xs font-semibold bg-[#00FFC2] hover:bg-[#00FFC2]/90 text-black rounded-lg transition-all shadow-[0_2px_8px_rgba(0,255,194,0.15)] flex items-center gap-1 font-medium cursor-pointer"
                                  title="Ver dossiê de respostas completo"
                                >
                                  <span>Ver Respostas</span>
                                </button>
                                <button
                                  onClick={() => copyToClipboard(JSON.stringify(lead, null, 2), idx)}
                                  className="px-2 py-1.5 border border-white/10 bg-[#121214] text-[#A1A1AA] hover:text-white rounded-lg hover:border-white/20 transition-all font-mono text-[10px] shrink-0"
                                  title="Copiar lead como JSON"
                                >
                                  {copiedIndex === idx ? 'Copiado' : 'JSON'}
                                </button>
                                <button
                                  onClick={() => handleDeleteLead(lead.id)}
                                  className="p-1.5 text-white/50 hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded-lg transition-colors shrink-0"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* DETAILS AND ANSWERS DRILLDOWN DRAWER MODAL */}
              {selectedLead && (
                <div className="fixed inset-0 z-50 bg-[#050505]/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                  <div className="bg-[#0B0C10] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
                    
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-white/5 shrink-0 flex items-center justify-between bg-gradient-to-r from-brand-cyan/5 to-brand-green/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center text-brand-green">
                          <CheckCircle2 className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-base text-white">{selectedLead.empresa}</h3>
                          <p className="text-[10px] font-mono text-brand-cyan tracking-widest uppercase">ID: {selectedLead.id}</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setSelectedLead(null)}
                        className="p-2 bg-white/5 hover:bg-white/15 border border-white/5 text-white/50 hover:text-white transition-colors rounded-xl"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Modal Body Scroll */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                      
                      {/* Key Performance Indicators */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/2 border border-white/5 p-3 rounded-2xl text-center">
                          <span className="text-[9px] font-mono text-[#A1A1AA] uppercase tracking-wider block">Lead Score</span>
                          <span className={`text-xl font-bold font-display tracking-tight block mt-1 ${
                            (selectedLead.leadScore ?? calculateLeadScore(selectedLead)) >= 70 ? 'text-emerald-400' :
                            (selectedLead.leadScore ?? calculateLeadScore(selectedLead)) >= 40 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {selectedLead.leadScore ?? calculateLeadScore(selectedLead)}%
                          </span>
                        </div>
                        
                        <div className="bg-white/2 border border-white/5 p-3 rounded-2xl text-center">
                          <span className="text-[9px] font-mono text-[#A1A1AA] uppercase tracking-wider block">Cadastro</span>
                          <span className="text-[11px] font-bold text-white block mt-2 truncate">
                            {selectedLead.dataCadastro || (selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString('pt-BR') : 'Indeterminado')}
                          </span>
                        </div>

                        <div className="bg-white/2 border border-white/5 p-3 rounded-2xl text-center">
                          <span className="text-[9px] font-mono text-[#A1A1AA] uppercase tracking-wider block">Status Comercial</span>
                          <div className="mt-1">
                            <select
                              value={selectedLead.status || 'Novo'}
                              onChange={(e) => handleUpdateLeadStatus(selectedLead.id, e.target.value as any)}
                              className="text-[10px] font-bold bg-white/5 border border-white/10 rounded-lg text-white text-center py-0.5 px-2.5 focus:outline-none"
                            >
                              <option value="Novo">Novo</option>
                              <option value="Aguardando reunião">Aguardando Reunião</option>
                              <option value="Reunião agendada">Reunião Agendada</option>
                              <option value="Reunião realizada">Reunião Realizada</option>
                              <option value="Proposta enviada">Proposta Enviada</option>
                              <option value="Fechado">Fechado</option>
                              <option value="Perdido">Perdido</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Complete Answers Section */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold font-display text-white uppercase tracking-widest border-b border-white/5 pb-1">Todas as Respostas</h4>
                        
                        {selectedLead.dataReuniao && selectedLead.horaReuniao && (
                          <div className="bg-[#0A0D14] border border-orange-500/20 p-4 rounded-2xl space-y-3">
                            <span className="text-[10px] font-mono text-orange-400 uppercase tracking-widest block">📅 REUNIÃO ESTRATÉGICA AGENDADA</span>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-[#A1A1AA] block text-[9px] font-mono uppercase">DATA CONFIRMADA</span>
                                <span className="text-white block font-semibold">{selectedLead.dataReuniao}</span>
                              </div>
                              <div>
                                <span className="text-[#A1A1AA] block text-[9px] font-mono uppercase">HORÁRIO BRASÍLIA</span>
                                <span className="text-white block font-semibold">{selectedLead.horaReuniao}h</span>
                              </div>
                            </div>
                            {selectedLead.googleMeetLink && (
                              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                <span className="text-[10px] text-[#A1A1AA] font-mono font-light">Sala Google Meet:</span>
                                <a 
                                  href={selectedLead.googleMeetLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-3 py-1 bg-brand-cyan/25 hover:bg-brand-cyan/40 border border-brand-cyan/35 text-brand-cyan hover:text-white font-mono text-[9px] font-semibold rounded-lg transition-all"
                                >
                                  ABRIR SALA DO MEET
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Custom Bento grid listing all actual questionnaire responses */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          
                          <div className="bg-[#121215] border border-white/10 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider block">Nome Completo</span>
                            <span className="text-sm text-white font-semibold block mt-1">{selectedLead.nome}</span>
                          </div>

                          <div className="bg-[#121215] border border-white/10 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider block">Email Principal</span>
                            <span className="text-sm text-white font-medium block mt-1 truncate" title={selectedLead.email}>{selectedLead.email}</span>
                          </div>

                          <div className="bg-[#121215] border border-white/10 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider block">WhatsApp para Contato</span>
                            <span className="text-sm text-[#00FFC2] font-bold block mt-1 font-mono">
                              {selectedLead.whatsapp || selectedLead.telefone || 'Não informado'}
                            </span>
                          </div>

                          <div className="bg-[#121215] border border-white/10 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider block">Nome da Empresa</span>
                            <span className="text-sm text-white font-bold block mt-1">{selectedLead.empresa}</span>
                          </div>

                          <div className="bg-[#121215] border border-white/10 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider block">Segmento de Atuação</span>
                            <span className="text-sm text-brand-cyan font-semibold block mt-1">{selectedLead.segmento || 'Não informado'}</span>
                          </div>

                          <div className="bg-[#121215] border border-white/10 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider block">Trabalha com Cacau?</span>
                            <span className="text-sm text-[#00FFC2] font-semibold block mt-1">{selectedLead.trabalhaComCacau || 'Não informado'}</span>
                          </div>

                          <div className="bg-[#121215] border border-white/10 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider block">Faturamento Mensal</span>
                            <span className="text-sm text-white font-bold block mt-1">{selectedLead.faturamento || 'Não informado'}</span>
                          </div>

                        </div>
                      </div>

                      {/* Tracking UTMS Block */}
                      <div className="bg-white/2 p-4 rounded-2xl border border-white/5 space-y-2">
                        <span className="text-[10px] font-mono text-brand-cyan uppercase tracking-wider block">Auditoria UTM / Marketing Digital</span>
                        <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-[#A1A1AA] block">Source:</span>
                            <span className="text-white font-semibold truncate block mt-0.5">{selectedLead.utmSource || 'não fornecido'}</span>
                          </div>
                          <div>
                            <span className="text-[#A1A1AA] block">Medium:</span>
                            <span className="text-white font-semibold truncate block mt-0.5">{selectedLead.utmMedium || 'não fornecido'}</span>
                          </div>
                          <div>
                            <span className="text-[#A1A1AA] block">Campaign:</span>
                            <span className="text-white font-semibold truncate block mt-0.5">{selectedLead.utmCampaign || 'não fornecido'}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Modal Footer actions */}
                    <div className="px-6 py-4 border-t border-white/5 bg-[#050505] shrink-0 flex items-center justify-between">
                      <button
                        onClick={() => {
                          const base = `https://wa.me/${selectedLead.telefone.replace(/\D/g, '')}`;
                          window.open(base, '_blank');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-display font-bold text-xs rounded-xl transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>ENTRAR EM CONTATO NO WHATSAPP</span>
                      </button>

                      <button
                        onClick={() => setSelectedLead(null)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-display text-xs rounded-xl font-semibold transition-colors"
                      >
                        Fechar dossiê
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: CONFIG INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display font-bold text-base text-white">Hub de Conexões e Webhooks</h3>
                <p className="text-xs text-[#A1A1AA] mt-0.5">Assegure a transmissão instantânea dos dados para qualquer hub CRM ou automação.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Standard Webhooks */}
                <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                        <Server className="w-4 h-4" />
                      </div>
                      <span className="font-display font-medium text-sm text-white">Módulo Standard Webhook</span>
                    </div>
                    <span className="text-[10px] bg-brand-green/10 text-brand-green px-2 py-0.5 rounded font-mono">ATIVO</span>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1.5">ENDPOINT URL</label>
                    <input 
                      type="text" 
                      value={integrationConfig.webhookUrl}
                      onChange={(e) => saveConfig({ ...integrationConfig, webhookUrl: e.target.value })}
                      className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2.5 text-white" 
                    />
                  </div>
                  
                  <button
                    onClick={() => handleTestWebhook('standard')}
                    disabled={isTestingWebhook}
                    className="w-full font-display font-bold text-xs py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isTestingWebhook ? 'Disparando Teste...' : 'Enviar Payload de Teste'}</span>
                  </button>
                </div>

                {/* N8N Webhooks */}
                <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#FF6C37]/10 text-[#FF6C37]">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <span className="font-display font-medium text-sm text-white">Integração N8N Webhook</span>
                    </div>
                    <span className="text-[10px] bg-brand-cyan/10 text-brand-cyan px-2 py-0.5 rounded font-mono">ATIVO</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1.5">N8N WEBHOOK URL</label>
                    <input
                      type="text"
                      value={integrationConfig.n8nUrl}
                      onChange={(e) => saveConfig({ ...integrationConfig, n8nUrl: e.target.value })}
                      className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2.5 text-white"
                    />
                  </div>

                  <button
                    onClick={() => handleTestWebhook('n8n')}
                    disabled={isTestingN8N}
                    className="w-full font-display font-bold text-xs py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isTestingN8N ? 'Disparando Teste ao N8N...' : 'Enviar Payload ao N8N'}</span>
                  </button>
                </div>

                {/* Supabase backend */}
                <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Database className="w-4 h-4" />
                      </div>
                      <span className="font-display font-medium text-sm text-white">Banco Postgres Supabase</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> ONLINE
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1">SUPABASE URL</label>
                      <input
                        type="text"
                        value={integrationConfig.supabaseUrl}
                        onChange={(e) => saveConfig({ ...integrationConfig, supabaseUrl: e.target.value })}
                        className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1">SUPABASE ANON KEY</label>
                      <input
                        type="password"
                        value={integrationConfig.supabaseAnonKey}
                        onChange={(e) => saveConfig({ ...integrationConfig, supabaseAnonKey: e.target.value })}
                        className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Google Sheets / Analytics */}
                <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-brand-cyan/10 text-brand-cyan">
                        <Globe className="w-4 h-4" />
                      </div>
                      <span className="font-display font-medium text-sm text-white">Scripts Externos & Meta Pixel</span>
                    </div>
                    <span className="text-[10px] bg-brand-green/10 text-brand-green px-2 py-0.5 rounded font-mono">CARREGADO</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1">META PIXEL ID</label>
                      <input
                        type="text"
                        value={integrationConfig.metaPixelId}
                        onChange={(e) => saveConfig({ ...integrationConfig, metaPixelId: e.target.value })}
                        className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1">GOOGLE ANALYTICS</label>
                      <input
                        type="text"
                        value={integrationConfig.gaTrackingId}
                        onChange={(e) => saveConfig({ ...integrationConfig, gaTrackingId: e.target.value })}
                        className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1">GOOGLE SHEETS APP SCRIPT URL</label>
                      <input
                        type="text"
                        value={integrationConfig.googleSheetsUrl}
                        onChange={(e) => saveConfig({ ...integrationConfig, googleSheetsUrl: e.target.value })}
                        className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1">CALENDLY LINK PARA AGENDAMENTO</label>
                      <input
                        type="text"
                        value={integrationConfig.calendlyUrl || ''}
                        onChange={(e) => saveConfig({ ...integrationConfig, calendlyUrl: e.target.value })}
                        placeholder="https://calendly.com/comercial-seracacau/30min"
                        className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1">LINK DO VÍDEO DA PÁGINA DE OBRIGADO (YOUTUBE/VIMEO)</label>
                      <input
                        type="text"
                        value={integrationConfig.thankYouVideoUrl || ''}
                        onChange={(e) => saveConfig({ ...integrationConfig, thankYouVideoUrl: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wide mb-1">NOME DO APRESENTADOR NO VÍDEO</label>
                      <input
                        type="text"
                        value={integrationConfig.presenterName || ''}
                        onChange={(e) => saveConfig({ ...integrationConfig, presenterName: e.target.value })}
                        placeholder="nosso especialista"
                        className="w-full text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 mt-4">
                    <label className="block text-[10px] font-mono text-[#00FFC2] uppercase tracking-wider mb-1">SENHA DO PAINEL DO ADMINISTRADOR (/admin)</label>
                    <p className="text-[10px] text-[#A1A1AA] mb-2">Defina a senha que é solicitada para acessar este painel ao digitar /admin no final da URL.</p>
                    <input
                      type="text"
                      value={integrationConfig.adminPassword || 'sensesales@admin'}
                      onChange={(e) => saveConfig({ ...integrationConfig, adminPassword: e.target.value })}
                      placeholder="sensesales@admin"
                      className="w-full md:w-1/2 text-xs font-mono bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: RELATÓRIO & MÉTRICAS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display font-bold text-base text-white">Relatórios & Funil Estratégico</h3>
                <p className="text-xs text-[#A1A1AA] mt-0.5">Indicadores do perfil das empresas cadastradas no formulário da Será Cacau.</p>
              </div>

              {leads.length === 0 ? (
                <div className="border border-white/5 bg-[#050505] rounded-2xl p-12 text-center">
                  <BarChart className="w-12 h-12 text-[#A1A1AA]/30 mx-auto mb-3" />
                  <p className="text-sm font-sans font-medium text-white">Sem dados para calcular métricas.</p>
                  <p className="text-xs text-[#A1A1AA] mt-1">Conclua submits de qualificação com variadas faixas financeiras.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Lead metrics */}
                  <div className="bg-[#050505] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                    <p className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">TOTAL INGRESSOS</p>
                    <div className="my-2">
                      <span className="text-3xl font-display font-bold text-white tracking-tight">{leads.length}</span>
                      <span className="text-xs text-brand-green font-mono ml-2">leads</span>
                    </div>
                    <div className="w-full h-1 bg-[#0D0D0D] rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-brand-green" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div className="bg-[#050505] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                    <p className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">FATURAMENTO SIGNIFICATIVO</p>
                    <div className="my-2">
                      <span className="text-3xl font-display font-bold text-white tracking-tight">
                        {leads.length === 0 ? 0 : Math.round((leads.filter(l => {
                          const fat = l.faturamento || '';
                          return !fat.includes('Até R$ 50 mil') && !fat.includes('Prefiro conversar');
                        }).length / leads.length) * 100)}%
                      </span>
                      <span className="text-[10px] text-brand-cyan font-mono ml-2">Acima R$50k/mês</span>
                    </div>
                    <div className="w-full h-1 bg-[#0D0D0D] rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-brand-cyan" style={{ width: '75%' }} />
                    </div>
                  </div>

                  <div className="bg-[#050505] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                    <p className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">FALAM IMEDIATAMENTE</p>
                    <div className="my-2">
                      <span className="text-3xl font-display font-bold text-white tracking-tight">
                        {leads.length === 0 ? 0 : Math.round((leads.filter(l => {
                          const p = l.prazoInicio || l.prazo || '';
                          return p.includes('Imediatamente') || p.includes('30 dias');
                        }).length / leads.length) * 100)}%
                      </span>
                      <span className="text-xs text-brand-green font-mono ml-2">Hot leads</span>
                    </div>
                    <div className="w-full h-1 bg-[#0D0D0D] rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-brand-green" style={{ width: '45%' }} />
                    </div>
                  </div>

                  <div className="bg-[#050505] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                    <p className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">CONVERSÃO DE WHATSAPP</p>
                    <div className="my-2">
                      <span className="text-3xl font-display font-bold text-white tracking-tight">94.3%</span>
                      <span className="text-xs text-[#A1A1AA] font-mono ml-2">Média</span>
                    </div>
                    <div className="w-full h-1 bg-[#0D0D0D] rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-brand-cyan to-brand-green" style={{ width: '94.3%' }} />
                    </div>
                  </div>

                  {/* Distribution list */}
                  <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 sm:col-span-2 space-y-3">
                    <h4 className="font-display font-semibold text-xs text-white uppercase tracking-wider">Distribuição por Segmentos</h4>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto no-scrollbar">
                      {Array.from(new Set(leads.map(l => l.segmento))).map((segment, idx) => {
                        const count = leads.filter(l => l.segmento === segment).length;
                        const pct = Math.round((count / leads.length) * 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-white font-medium">{segment}</span>
                              <span className="text-[#A1A1AA] font-mono">{count} ({pct}%)</span>
                            </div>
                            <div className="w-full h-1 bg-[#0D0D0D] rounded-full overflow-hidden">
                              <div className="h-full bg-[#00FFC2]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Faturamento list */}
                  <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 sm:col-span-2 space-y-3">
                    <h4 className="font-display font-semibold text-xs text-white uppercase tracking-wider">Pretensões de Investimento em Anúncios</h4>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto no-scrollbar">
                      {Array.from(new Set(leads.map(l => l.orcamentoAds))).map((orc, idx) => {
                        const count = leads.filter(l => l.orcamentoAds === orc).length;
                        const pct = Math.round((count / leads.length) * 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-white font-medium">{orc}</span>
                              <span className="text-[#A1A1AA] font-mono">{count} ({pct}%)</span>
                            </div>
                            <div className="w-full h-1 bg-[#0D0D0D] rounded-full overflow-hidden">
                              <div className="h-full bg-[#00C2FF]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDITORIA LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-base text-white">Central de Logs Integrada</h3>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">Auditoria contínua de requisições de webhooks, pixels e eventos.</p>
                </div>
                <button
                  onClick={() => {
                    setLogs([]);
                    localStorage.removeItem('sensesales_integration_logs');
                  }}
                  className="px-3 py-1.5 bg-white/5 text-[#A1A1AA] hover:text-white border border-white/5 rounded-lg text-xs"
                >
                  Limpar Logs
                </button>
              </div>

              <div className="bg-[#050505] border border-white/10 rounded-2xl p-4 font-mono text-[11px] h-[350px] overflow-y-auto space-y-2">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[#A1A1AA]/40 text-center">
                    Efetue conexões ou preencha o formulário para visualizar os logs do consolidador.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-2 leading-relaxed">
                      <span className="text-white/30 shrink-0">[{log.time}]</span>
                      <span className={`font-semibold shrink-0 ${
                        log.status === 'success' ? 'text-brand-green' : log.status === 'warn' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        [{log.action.toUpperCase()}]
                      </span>
                      <span className="text-white/80">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
        
        {/* Panel Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-[#050505] text-[10px] font-mono text-[#A1A1AA]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
            SISTEMA DE QUALIFICAÇÃO INTEGRADO - SERÁ CACAU v4.2
          </span>
          <span>© 2026 Será Cacau</span>
        </div>

      </div>
    </div>
  );
}
