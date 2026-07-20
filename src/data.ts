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
      'Abaixo de R$30mil',
      'Entre R$ 30mil a R$50mil',
      'Entre R$50mil a R$80mil',
      'Acima de R$80mil'
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

export function buildWhatsAppMessage(lead: LeadData): string {
  const baseMessage = `Olá, sou ${lead.nome}.

Acabei de preencher as informações de qualificação!

📋 RESUMO DOS MEUS DADOS:
- Empresa: ${lead.empresa}
- E-mail: ${lead.email}
- WhatsApp: ${lead.whatsapp}
- Segmento: ${lead.segmento}
- Já trabalha com cacau?: ${lead.trabalhaComCacau || 'Não informado'}
- Faturamento mensal: ${lead.faturamento}

📊 Score de Qualificação: ${lead.leadScore ?? 0}%

Desejo dar prosseguimento e conversar com o especialista responsável!`;

  return encodeURIComponent(baseMessage);
}

export function calculateLeadScore(lead: Partial<LeadData>): number {
  let score = 0;

  // 1. Faturamento médio mensal (Max 100)
  const faturamento = lead.faturamento || '';
  if (faturamento.includes('Abaixo de R$30mil')) score += 30;
  else if (faturamento.includes('R$ 30mil a R$50mil')) score += 60;
  else if (faturamento.includes('R$50mil a R$80mil')) score += 85;
  else if (faturamento.includes('Acima de R$80mil')) score += 100;

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
