import { Question, LeadData, IntegrationConfig } from './types';

export const QUESTIONS_LIST: Question[] = [
  {
    id: 'p1',
    variable: 'nome',
    type: 'text',
    title: 'Qual é o seu nome?',
    placeholder: 'Digite seu nome completo...',
    required: true,
  },
  {
    id: 'p2',
    variable: 'empresa',
    type: 'text',
    title: 'Qual é o nome da sua empresa?',
    placeholder: 'Digite o nome da empresa...',
    required: true,
  },
  {
    id: 'p3',
    variable: 'email',
    type: 'email',
    title: 'Qual é o seu e-mail?',
    placeholder: 'exemplo@empresa.com.br',
    required: true,
  },
  {
    id: 'p4',
    variable: 'whatsapp',
    type: 'tel',
    title: 'Qual é o seu número do WhatsApp?',
    placeholder: '(11) 99999-9999',
    required: true,
  },
  {
    id: 'p5',
    variable: 'segmento',
    type: 'select',
    title: 'Qual segmento da sua empresa?',
    options: [
      'Hotel/Pousada',
      'Cafeteria',
      'Emporio/cerealista',
      'Mercados/Supermercado'
    ],
    required: true,
  },
  {
    id: 'p6',
    variable: 'trabalhaComCacau',
    type: 'select',
    title: 'Você já trabalha ou trabalhou com cacau?',
    options: [
      'Sim',
      'Não'
    ],
    required: true,
  },
  {
    id: 'p7',
    variable: 'faturamento',
    type: 'select',
    title: 'Qual faturamento médio por mês da sua empresa?',
    options: [
      'R$ 50 mil',
      'Entre R$50 mil e R$80mil',
      'Entre R$80mil e R$100mil',
      'Acima de R$100mil'
    ],
    required: true,
  }
];

export const DEFAULT_INTEGRATIONS_CONFIG: IntegrationConfig = {
  webhookUrl: 'https://seu-webhook.com/leads',
  n8nUrl: 'https://n8n.suaempresa.com/webhook/sense-sales',
  supabaseUrl: 'https://xyz.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9...',
  metaPixelId: '1234567890',
  gaTrackingId: 'G-XXXXXXXXXX',
  gtmId: 'GTM-XXXXXXX',
  googleSheetsUrl: 'https://script.google.com/macros/s/AKfycbyJSBeAgSpjnOhdYfHUZbSCSVuAGjuxMrJPjzohtECTipLlDxZsdjWCRv9Rg-NrIu6h/exec',
  calendlyUrl: 'https://calendly.com/comercial-seracacau/30min',
  redirectUrl: 'https://contato.seracacau.com.br/',
  adminPassword: 'sensesales@admin',
  thankYouVideoUrl: 'https://vimeo.com/1206543972',
  presenterName: 'nosso especialista',
};

export const INITIAL_LEAD_DATA: LeadData = {
  nome: '',
  whatsapp: '',
  email: '',
  empresa: '',
  segmento: '',
  trabalhaComCacau: '',
  faturamento: '',
  operacaoComercial: '',
  origemLeads: [],
  crm: '',
  desafioPrincipal: '',
  momentoEmpresa: '',
  investimentoMarketing: '',
  equipeComercial: '',
  prazoInicio: '',
  lgpd: true,
  id: '',
  createdAt: '',
};

// Mask WhatsApp input to (XX) XXXXX-XXXX
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

export function buildFormattedMessageText(lead?: LeadData | Partial<LeadData> | null): string {
  if (!lead) return '';
  const score = lead.leadScore !== undefined && lead.leadScore !== null
    ? lead.leadScore
    : calculateLeadScore(lead);

  const phone = lead.whatsapp || lead.telefone || 'Não informado';
  const trabalhaCacau = lead.trabalhaComCacau || 'Não informado';

  const origens = Array.isArray(lead.origemLeads)
    ? lead.origemLeads.filter(Boolean).join(', ')
    : (lead.origemLeads || '');

  const lines: string[] = [
    `Olá, sou ${lead.nome || 'Cliente'}.`,
    ``,
    `Acabei de preencher as informações de qualificação no formulário!`,
    ``,
    `📋 RESUMO DAS RESPOSTAS DO FORMULÁRIO:`,
    `• Nome: ${lead.nome || 'Não informado'}`,
    `• Empresa: ${lead.empresa || 'Não informada'}`,
    `• E-mail: ${lead.email || 'Não informado'}`,
    `• WhatsApp / Telefone: ${phone}`,
    `• Segmento da Empresa: ${lead.segmento || 'Não informado'}`,
    `• Já trabalha com cacau?: ${trabalhaCacau}`,
    `• Faturamento médio mensal: ${lead.faturamento || 'Não informado'}`
  ];

  if (lead.operacaoComercial) {
    lines.push(`• Operação Comercial: ${lead.operacaoComercial}`);
  }
  if (origens) {
    lines.push(`• Origem de Leads: ${origens}`);
  }
  if (lead.crm) {
    lines.push(`• Usa CRM?: ${lead.crm}`);
  }
  if (lead.desafioPrincipal) {
    lines.push(`• Principal Desafio: ${lead.desafioPrincipal}`);
  }
  if (lead.momentoEmpresa) {
    lines.push(`• Momento Atual da Empresa: ${lead.momentoEmpresa}`);
  }
  if (lead.investimentoMarketing) {
    lines.push(`• Investimento em Marketing: ${lead.investimentoMarketing}`);
  }
  if (lead.equipeComercial) {
    lines.push(`• Tamanho da Equipe Comercial: ${lead.equipeComercial}`);
  }
  if (lead.prazoInicio) {
    lines.push(`• Prazo de Início Desejado: ${lead.prazoInicio}`);
  }
  if (lead.dataReuniao) {
    lines.push(`• Reunião Agendada: ${lead.dataReuniao} às ${lead.horaReuniao || ''}`);
  }

  lines.push(``);
  lines.push(`📊 Score de Qualificação: ${score}%`);
  lines.push(``);
  lines.push(`Desejo dar prosseguimento e conversar com o especialista responsável!`);

  return lines.join('\n');
}

export function buildWhatsAppMessage(lead?: LeadData | Partial<LeadData> | null): string {
  if (!lead) return '';
  return encodeURIComponent(buildFormattedMessageText(lead));
}

export function calculateLeadScore(lead?: Partial<LeadData> | null): number {
  if (!lead) return 0;
  let score = 0;

  // 1. Faturamento médio mensal (Max 100)
  const faturamento = lead.faturamento || '';
  if (faturamento.includes('Acima de R$100mil') || faturamento.includes('100mil') || faturamento.includes('100 mil')) {
    if (faturamento.includes('Acima')) {
      score += 100; // Acima de R$100mil
    } else {
      score += 85;  // Entre R$80mil e R$100mil
    }
  } else if (faturamento.includes('80mil') || faturamento.includes('80 mil')) {
    score += 70;    // Entre R$50 mil e R$80mil
  } else if (faturamento) {
    score += 40;    // Até R$ 50 mil
  }

  // 2. Trabalha com cacau (Max 100)
  const trabalhaComCacau = lead.trabalhaComCacau || '';
  if (trabalhaComCacau === 'Sim') score += 100;
  else if (trabalhaComCacau === 'Não') score += 50;
  else score += 30; // undefined/empty fallback

  // 3. Segmento (Max 100)
  const segmento = lead.segmento || '';
  if (segmento) score += 100; // All requested segments qualify.

  // Normalize by sum of weights (max 300) -> scale to percentage 0-100
  return Math.round((score / 3) || 0);
}
