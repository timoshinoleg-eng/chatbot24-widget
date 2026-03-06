/**
 * PDF API Route
 * Generates PDF proposals for HOT leads
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePDF } from '@/lib/pdf-generator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadData } = body;

    if (!leadData) {
      return NextResponse.json(
        { error: 'Lead data is required' },
        { status: 400 }
      );
    }

    // Generate PDF URL for the lead
    const pdfUrl = await generatePDF(leadData);

    return NextResponse.json({
      success: true,
      pdfUrl,
      message: 'PDF generated successfully'
    });

  } catch (error) {
    console.error('PDF API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return PDF template info
  return NextResponse.json({
    template: 'kp-template',
    available: true,
    description: 'PDF generation for HOT leads'
  });
}
