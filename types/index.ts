/**
 * Brief data collected from user
 */
export interface BriefData {
  businessType: string;
  channels: string[];
  dailyRequests: string;
  botTasks: string[];
  referenceBots?: string;
  budget: string;
  contacts: {
    name?: string;
    phone: string;
    email?: string;
  };
}

/**
 * Lead scoring result
 */
export interface LeadScore {
  status: 'HOT' | 'WARM' | 'COLD';
  confidence: number;
  justification: string;
  extractedData?: {
    budget?: { value: number; currency: string; confidence: number };
    timeline?: { urgency: 'critical' | 'high' | 'medium' | 'low' };
    projectType?: string;
    decisionMaker?: boolean;
  };
  recommendedAction?: {
    priority: number;
    timeframe: 'сейчас' | 'в течение часа' | 'сегодня' | 'неделя';
    channel: 'звонок' | 'email' | 'мессенджер';
  };
  redFlags?: string[];
}

/**
 * Knowledge base case example
 */
export interface CaseExample {
  title: string;
  description: string;
  features: string[];
  budget: string;
  duration: string;
  results: string;
}

/**
 * Knowledge base industry
 */
export interface IndustryCases {
  name: string;
  description: string;
  cases: CaseExample[];
}

/**
 * Channel info
 */
export interface ChannelInfo {
  name: string;
  description: string;
  features: string[];
  useCases: string[];
}

/**
 * Pricing package
 */
export interface PricingPackage {
  name: string;
  price: string;
  duration: string;
  description: string;
  includes: string[];
  bestFor: string[];
}

/**
 * Brief question
 */
export interface BriefQuestion {
  id: string;
  question: string;
  type: 'buttons' | 'multi_select' | 'text_input';
  options?: string[];
  placeholder?: string;
}
