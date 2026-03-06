/**
 * Proposal API Route
 * Generates PDF proposals dynamically
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateProposalBase64 } from '@/lib/pdf-generator';
import type { ProposalData } from '@/lib/pdf-generator';

export const dynamic = 'force-dynamic';

interface ProposalRequest {
  name: string;
  company: string;
  email: string;
  phone: string;
  budget: string;
  timeline: string;
  selectedServices: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ProposalRequest = await request.json();
    const { name, company, email, phone, budget, timeline, selectedServices } = body;

    // Validation
    const errors: Record<string, string> = {};

    if (!name || name.trim().length < 2) {
      errors.name = 'Имя обязательно';
    }

    if (!company || company.trim().length < 2) {
      errors.company = 'Компания обязательна';
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Корректный email обязателен';
    }

    if (!phone || phone.trim().length < 5) {
      errors.phone = 'Телефон обязателен';
    }

    if (!selectedServices || selectedServices.length === 0) {
      errors.services = 'Выберите хотя бы одну услугу';
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }

    // Prepare proposal data
    const proposalData: ProposalData = {
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      budget: budget || 'Не указан',
      timeline: timeline || 'Не указаны',
      selectedServices,
      date: new Date().toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    };

    // Generate PDF
    const pdfBase64 = await generateProposalBase64(proposalData);

    return NextResponse.json({
      success: true,
      pdfBase64,
      filename: `KP_${company}_${Date.now()}.pdf`,
      proposalId: `KP-${Date.now().toString().slice(-6)}`,
      message: 'КП успешно сгенерировано'
    });

  } catch (error) {
    console.error('Proposal API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate proposal' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return available services for proposals
  const services = [
    { id: 'web', name: 'Веб-разработка', price: 150000 },
    { id: 'mobile', name: 'Мобильное приложение', price: 200000 },
    { id: 'design', name: 'Дизайн UI/UX', price: 80000 },
    { id: 'seo', name: 'SEO-оптимизация', price: 50000 },
    { id: 'ads', name: 'Контекстная реклама', price: 40000 },
    { id: 'support', name: 'Техническая поддержка', price: 30000 },
    { id: 'consult', name: 'Консультация', price: 15000 },
  ];

  return NextResponse.json({
    services,
    budgets: [
      'до 50 000₽',
      '50 000₽ - 100 000₽',
      '100 000₽ - 250 000₽',
      '250 000₽+'
    ],
    timelines: [
      'Срочно',
      '1 неделя',
      '1 месяц',
      'Не определено'
    ]
  });
}
