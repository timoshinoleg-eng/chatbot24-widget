/**
 * PDF Generator Module
 * Creates dynamic proposals using @react-pdf/renderer
 * Server-compatible version (no FileReader)
 */

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import React from 'react';

export interface ProposalData {
  name: string;
  company: string;
  budget: string;
  timeline: string;
  selectedServices: string[];
  email: string;
  phone: string;
  date: string;
}

// Styles for PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2px solid #2563eb',
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
    backgroundColor: '#f3f4f6',
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: 150,
    fontSize: 12,
    color: '#6b7280',
  },
  value: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    fontWeight: 'medium',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  serviceName: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
  },
  servicePrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#059669',
  },
  totalSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTop: '2px solid #e5e7eb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1px solid #e5e7eb',
  },
  footerText: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
  contactInfo: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
  },
  contactTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 11,
    color: '#4b5563',
    marginBottom: 4,
  },
});

// Service prices
const servicePrices: Record<string, number> = {
  'Веб-разработка': 150000,
  'Мобильное приложение': 200000,
  'Дизайн UI/UX': 80000,
  'SEO-оптимизация': 50000,
  'Контекстная реклама': 40000,
  'Техническая поддержка': 30000,
  'Консультация': 15000,
};

// Create Proposal Document Component
function createProposalDocument(data: ProposalData) {
  const totalAmount = data.selectedServices.reduce((sum, service) => {
    return sum + (servicePrices[service] || 0);
  }, 0);

  return React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, 'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ'),
        React.createElement(Text, { style: styles.subtitle }, `№ KP-${Date.now().toString().slice(-6)} от ${data.date}`)
      ),
      // Client Info
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Информация о клиенте'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Клиент:'),
          React.createElement(Text, { style: styles.value }, data.name)
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Компания:'),
          React.createElement(Text, { style: styles.value }, data.company)
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Email:'),
          React.createElement(Text, { style: styles.value }, data.email)
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Телефон:'),
          React.createElement(Text, { style: styles.value }, data.phone)
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Бюджет:'),
          React.createElement(Text, { style: styles.value }, data.budget)
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Сроки:'),
          React.createElement(Text, { style: styles.value }, data.timeline)
        )
      ),
      // Services
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Выбранные услуги'),
        ...data.selectedServices.map((service, index) =>
          React.createElement(
            View,
            { key: index, style: styles.serviceItem },
            React.createElement(Text, { style: styles.serviceName }, service),
            React.createElement(
              Text,
              { style: styles.servicePrice },
              `${(servicePrices[service] || 0).toLocaleString('ru-RU')} ₽`
            )
          )
        )
      ),
      // Total
      React.createElement(
        View,
        { style: styles.totalSection },
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'ИТОГО:'),
          React.createElement(
            Text,
            { style: styles.totalValue },
            `${totalAmount.toLocaleString('ru-RU')} ₽`
          )
        )
      ),
      // Contact Info
      React.createElement(
        View,
        { style: styles.contactInfo },
        React.createElement(Text, { style: styles.contactTitle }, 'Контакты для связи'),
        React.createElement(Text, { style: styles.contactText }, 'Телефон: +7 (999) 123-45-67'),
        React.createElement(Text, { style: styles.contactText }, 'Email: info@company.ru'),
        React.createElement(Text, { style: styles.contactText }, 'Сайт: www.company.ru')
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          { style: styles.footerText },
          'Данное предложение действительно в течение 30 дней с момента выдачи. По всем вопросам обращайтесь по указанным контактам.'
        )
      )
    )
  );
}

// Generate PDF as Buffer (server-compatible)
export async function generateProposalPDF(data: ProposalData): Promise<Buffer> {
  const doc = createProposalDocument(data);
  const blob = await pdf(doc).toBlob();
  
  // Convert Blob to Buffer using arrayBuffer
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Generate PDF as base64 (server-compatible, no FileReader)
export async function generateProposalBase64(data: ProposalData): Promise<string> {
  const buffer = await generateProposalPDF(data);
  return buffer.toString('base64');
}

/**
 * Simple PDF generation for HOT leads (ТЗ version)
 * Returns a template URL for the proposal
 */
export async function generatePDF(leadData: any): Promise<string | null> {
  // In production, this would generate an actual PDF
  // For now, return a URL to a template with query params
  const params = new URLSearchParams({
    name: leadData.name || '',
    phone: leadData.phone || '',
    email: leadData.email || '',
    budget: leadData.budget || '',
    timeline: leadData.timeline || '',
    businessType: leadData.businessType || '',
    score: String(leadData.scoreValue || 0),
    category: leadData.scoreCategory || '',
    date: new Date().toLocaleDateString('ru-RU'),
  });

  // Return a template URL - in production this would be your actual PDF service
  return `https://www.chatbot24.su/kp-template?${params.toString()}`;
}

export { createProposalDocument };
