const portugueseLabels: Record<string, string> = {
  'Everyday account': 'Conta do dia a dia',
  'Savings account': 'Conta poupança',
  Rent: 'Aluguel',
  Condominium: 'Condomínio',
  Water: 'Água',
  Electricity: 'Energia',
  Internet: 'Internet',
  Phone: 'Telefone',
  Groceries: 'Mercado',
  Transport: 'Transporte',
  Health: 'Saúde',
  Education: 'Educação',
  Subscriptions: 'Assinaturas',
  Leisure: 'Lazer',
  Other: 'Outros',
  'Monthly salary': 'Salário mensal',
  'Expected monthly salary': 'Salário mensal previsto',
  'Emergency reserve': 'Reserva de emergência',
  'Personal goal': 'Meta pessoal',
};

export function demoLabel(value: string, language: 'pt-BR' | 'en'): string {
  return language === 'pt-BR' ? (portugueseLabels[value] ?? value) : value;
}
